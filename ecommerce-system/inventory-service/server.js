// ============================================
// INVENTORY SERVICE - Manages product stock
// Database: PostgreSQL (strong consistency for stock)
// ============================================

const express = require('express');
const { Pool } = require('pg');
const { createProducer, createConsumer, TOPICS } = require('../../shared/kafka-config');
const Redis = require('ioredis');

const app = express();
app.use(express.json());

// ============ DATABASE CONNECTION ============

const db = new Pool({
    host: 'localhost',
    port: 5433,  // Separate database for inventory
    database: 'ecommerce_inventory',
    user: 'inventory_user',
    password: 'inventory_password_123',
    max: 20
});

// ============ DATABASE SCHEMA ============

const initDatabase = async () => {
    // Inventory table
    await db.query(`
        CREATE TABLE IF NOT EXISTS inventory (
            product_id INTEGER PRIMARY KEY,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            reserved_quantity INTEGER NOT NULL DEFAULT 0,
            low_stock_threshold INTEGER DEFAULT 10,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Inventory transactions log (for audit)
    await db.query(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL,
            order_id INTEGER,
            transaction_type VARCHAR(50) NOT NULL,  -- RESERVE, RELEASE, PURCHASE, RESTOCK
            quantity INTEGER NOT NULL,
            previous_stock INTEGER,
            new_stock INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Inventory database tables ready');
};

initDatabase();

// ============ REDIS FOR RAPID STOCK CHECKS ============
const redis = new Redis({ host: 'localhost', port: 6379 });

// ============ KAFKA SETUP ============

let kafkaProducer = null;
let kafkaConsumer = null;

const setupKafka = async () => {
    kafkaProducer = await createProducer('inventory-service');
    kafkaConsumer = await createConsumer(
        'inventory-service',
        'inventory-service-group',
        [TOPICS.ORDER_EVENTS, TOPICS.INVENTORY_UPDATES]
    );
    
    await kafkaConsumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            console.log(`📦 Inventory service received: ${event.eventType}`);
            
            switch (event.eventType) {
                case 'ORDER_CREATED':
                    await reserveInventory(event);
                    break;
                    
                case 'RELEASE_INVENTORY':
                    await releaseInventory(event);
                    break;
                    
                case 'PRODUCT_UPDATED':
                    if (event.stock !== undefined) {
                        await updateStock(event.productId, event.stock);
                    }
                    break;
                    
                default:
                    console.log('Unknown inventory event:', event.eventType);
            }
        }
    });
    
    console.log('✅ Kafka setup complete');
};

setupKafka();

// ============ HELPER FUNCTIONS ============

// Check stock with caching
const getStockWithCache = async (productId) => {
    // Try cache first
    const cached = await redis.get(`stock:${productId}`);
    if (cached !== null) {
        return JSON.parse(cached);
    }
    
    // Get from database
    const result = await db.query(
        'SELECT stock_quantity, reserved_quantity FROM inventory WHERE product_id = $1',
        [productId]
    );
    
    let stock = { stock: 0, reserved: 0 };
    
    if (result.rows.length > 0) {
        stock = {
            stock: result.rows[0].stock_quantity,
            reserved: result.rows[0].reserved_quantity
        };
    }
    
    // Cache for 30 seconds (stock changes frequently)
    await redis.setex(`stock:${productId}`, 30, JSON.stringify(stock));
    
    return stock;
};

// Update stock in database with optimistic locking
const updateStock = async (productId, newStock) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get current stock
        const currentResult = await client.query(
            'SELECT stock_quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
            [productId]
        );
        
        let currentStock = 0;
        
        if (currentResult.rows.length === 0) {
            // Create inventory record if doesn't exist
            await client.query(
                `INSERT INTO inventory (product_id, stock_quantity) 
                 VALUES ($1, $2)`,
                [productId, newStock]
            );
        } else {
            // Update existing
            currentStock = currentResult.rows[0].stock_quantity;
            
            await client.query(
                `UPDATE inventory 
                 SET stock_quantity = $1, last_updated = NOW()
                 WHERE product_id = $2`,
                [newStock, productId]
            );
        }
        
        // Log transaction
        await client.query(
            `INSERT INTO inventory_transactions 
             (product_id, transaction_type, quantity, previous_stock, new_stock)
             VALUES ($1, $2, $3, $4, $5)`,
            [productId, 'RESTOCK', newStock - currentStock, currentStock, newStock]
        );
        
        await client.query('COMMIT');
        
        // Invalidate cache
        await redis.del(`stock:${productId}`);
        
        return true;
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Reserve inventory for an order
const reserveInventory = async (event) => {
    const { orderId, items } = event;
    
    const client = await db.connect();
    let allReserved = true;
    const failedItems = [];
    
    try {
        await client.query('BEGIN');
        
        for (const item of items) {
            // Lock the row for update (prevents race conditions)
            const result = await client.query(
                `SELECT stock_quantity, reserved_quantity 
                 FROM inventory 
                 WHERE product_id = $1 
                 FOR UPDATE`,
                [item.productId]
            );
            
            let currentStock = 0;
            let currentReserved = 0;
            
            if (result.rows.length === 0) {
                // Product not in inventory (out of stock)
                allReserved = false;
                failedItems.push({
                    productId: item.productId,
                    reason: 'Product not found in inventory'
                });
                continue;
            }
            
            currentStock = result.rows[0].stock_quantity;
            currentReserved = result.rows[0].reserved_quantity;
            
            const availableStock = currentStock - currentReserved;
            
            if (availableStock >= item.quantity) {
                // Reserve the items
                await client.query(
                    `UPDATE inventory 
                     SET reserved_quantity = reserved_quantity + $1,
                         last_updated = NOW()
                     WHERE product_id = $2`,
                    [item.quantity, item.productId]
                );
                
                // Log transaction
                await client.query(
                    `INSERT INTO inventory_transactions 
                     (product_id, order_id, transaction_type, quantity, previous_stock, new_stock)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [item.productId, orderId, 'RESERVE', item.quantity,
                     currentStock, currentStock]
                );
                
                // Invalidate cache
                await redis.del(`stock:${item.productId}`);
                
            } else {
                allReserved = false;
                failedItems.push({
                    productId: item.productId,
                    available: availableStock,
                    requested: item.quantity,
                    reason: 'Insufficient stock'
                });
            }
        }
        
        if (allReserved) {
            await client.query('COMMIT');
            
            // Send success event
            await kafkaProducer.send({
                topic: TOPICS.INVENTORY_EVENTS,
                messages: [{
                    key: orderId.toString(),
                    value: JSON.stringify({
                        eventType: 'INVENTORY_RESERVED',
                        orderId: orderId,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        } else {
            await client.query('ROLLBACK');
            
            // Send failure event
            await kafkaProducer.send({
                topic: TOPICS.INVENTORY_EVENTS,
                messages: [{
                    key: orderId.toString(),
                    value: JSON.stringify({
                        eventType: 'INVENTORY_FAILED',
                        orderId: orderId,
                        failedItems: failedItems,
                        reason: 'Stock reservation failed',
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reserve inventory error:', error);
        
        await kafkaProducer.send({
            topic: TOPICS.INVENTORY_EVENTS,
            messages: [{
                key: orderId.toString(),
                value: JSON.stringify({
                    eventType: 'INVENTORY_FAILED',
                    orderId: orderId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            }]
        });
    } finally {
        client.release();
    }
};

// Release inventory (when order is cancelled or payment fails)
const releaseInventory = async (event) => {
    const { orderId, items } = event;
    
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        for (const item of items) {
            const result = await client.query(
                `SELECT reserved_quantity, stock_quantity 
                 FROM inventory 
                 WHERE product_id = $1 
                 FOR UPDATE`,
                [item.productId]
            );
            
            if (result.rows.length > 0) {
                const currentReserved = result.rows[0].reserved_quantity;
                const newReserved = Math.max(0, currentReserved - item.quantity);
                
                await client.query(
                    `UPDATE inventory 
                     SET reserved_quantity = $1, last_updated = NOW()
                     WHERE product_id = $2`,
                    [newReserved, item.productId]
                );
                
                // Log transaction
                await client.query(
                    `INSERT INTO inventory_transactions 
                     (product_id, order_id, transaction_type, quantity)
                     VALUES ($1, $2, $3, $4)`,
                    [item.productId, orderId, 'RELEASE', item.quantity]
                );
                
                // Invalidate cache
                await redis.del(`stock:${item.productId}`);
            }
        }
        
        await client.query('COMMIT');
        
        console.log(`Inventory released for order ${orderId}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Release inventory error:', error);
    } finally {
        client.release();
    }
};

// ============ API ROUTES ============

// Check stock for a product
app.get('/api/v1/inventory/check/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        const stock = await getStockWithCache(productId);
        
        const available = stock.stock - stock.reserved;
        
        res.json({
            productId: productId,
            stockQuantity: stock.stock,
            reservedQuantity: stock.reserved,
            availableQuantity: available,
            isInStock: available > 0
        });
        
    } catch (error) {
        console.error('Check stock error:', error);
        res.status(500).json({ error: 'Failed to check stock' });
    }
});

// Reserve stock (direct API call, mostly for testing)
app.post('/api/v1/inventory/reserve', async (req, res) => {
    try {
        const { orderId, items } = req.body;
        
        // This would be called by order service
        // In production, this is handled via Kafka
        
        res.json({ success: true, message: 'Reservation request received' });
        
    } catch (error) {
        console.error('Reserve API error:', error);
        res.status(500).json({ error: 'Failed to reserve stock' });
    }
});

// ========== START SERVER ==========

const PORT = 3006;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   📦 INVENTORY SERVICE STARTED       ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Database: PostgreSQL (separate)    ║
    ║   Cache: Redis (30s TTL)             ║
    ╚══════════════════════════════════════╝
    `);
});
// ============================================
// ORDER SERVICE - Manages orders and coordinates payment/inventory
// Database: PostgreSQL (ACID compliance for orders)
// ============================================

const express = require('express');
const { Pool } = require('pg');
const { createProducer, createConsumer, TOPICS } = require('../shared/kafka-config');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');  // For idempotency keys
const { devCors } = require('../shared/dev-cors');

const app = express();
app.use(devCors());
app.use(express.json());

// ============ DATABASE CONNECTION ============

const db = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ecommerce_main',
    user: 'ecommerce_user',
    password: 'secure_password_123',
    max: 20
});

// ============ DATABASE SCHEMA ============

const initDatabase = async () => {
    // Orders table
    await db.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            order_number VARCHAR(50) UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            subtotal DECIMAL(10, 2) NOT NULL,
            tax DECIMAL(10, 2) DEFAULT 0,
            shipping_cost DECIMAL(10, 2) DEFAULT 0,
            total_amount DECIMAL(10, 2) NOT NULL,
            shipping_address JSONB NOT NULL,
            payment_method VARCHAR(50),
            payment_status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    `);
    
    // Order items table
    await db.query(`
        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10, 2) NOT NULL,
            total_price DECIMAL(10, 2) NOT NULL
        )
    `);
    
    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');
    
    console.log('✅ Order database tables ready');
};

initDatabase().catch((e) => console.error('Order initDatabase:', e.message));

// ============ KAFKA SETUP ============

let kafkaProducer = null;
let kafkaConsumer = null;

const safeKafkaSend = async (payload) => {
    if (!kafkaProducer) return;
    try {
        await kafkaProducer.send(payload);
    } catch (e) {
        console.warn('Kafka send:', e.message);
    }
};

const setupKafka = async () => {
    try {
        kafkaProducer = await createProducer('order-service');
        kafkaConsumer = await createConsumer(
            'order-service',
            'order-service-group',
            [TOPICS.ORDER_PAYMENT, TOPICS.INVENTORY_EVENTS]
        );

        await kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                console.log(`📨 Order service received: ${event.eventType}`);

                switch (event.eventType) {
                    case 'PAYMENT_SUCCESS':
                        await handlePaymentSuccess(event);
                        break;

                    case 'PAYMENT_FAILED':
                        await handlePaymentFailure(event);
                        break;

                    case 'INVENTORY_RESERVED':
                        await handleInventoryReserved(event);
                        break;

                    case 'INVENTORY_FAILED':
                        await handleInventoryFailed(event);
                        break;

                    default:
                        console.log('Unknown event:', event.eventType);
                }
            }
        });

        console.log('✅ Kafka setup complete');
    } catch (e) {
        console.warn('⚠️ Order Kafka unavailable:', e.message);
        kafkaProducer = null;
        kafkaConsumer = null;
    }
};

setupKafka().catch((e) => console.warn('Kafka setup:', e.message));

// ============ EVENT HANDLERS ============

const handlePaymentSuccess = async (event) => {
    const { orderId, paymentIntentId } = event;
    
    await db.query(
        `UPDATE orders 
         SET payment_status = 'paid',
             status = 'confirmed',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
    );
    
    // Notify user via Kafka
    await safeKafkaSend({
        topic: TOPICS.NOTIFICATION_EVENTS,
        messages: [{
            key: orderId.toString(),
            value: JSON.stringify({
                eventType: 'ORDER_CONFIRMED',
                orderId: orderId,
                timestamp: new Date().toISOString()
            })
        }]
    });
};

const handlePaymentFailure = async (event) => {
    const { orderId, error } = event;
    
    await db.query(
        `UPDATE orders 
         SET status = 'payment_failed',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
    );
    
    // Release inventory (if it was reserved)
    await safeKafkaSend({
        topic: TOPICS.INVENTORY_EVENTS,
        messages: [{
            key: orderId.toString(),
            value: JSON.stringify({
                eventType: 'RELEASE_INVENTORY',
                orderId: orderId,
                reason: error,
                timestamp: new Date().toISOString()
            })
        }]
    });
};

const handleInventoryReserved = async (event) => {
    const { orderId } = event;
    
    // Inventory is reserved, now process payment
    await processPayment(orderId);
};

const handleInventoryFailed = async (event) => {
    const { orderId, reason } = event;
    
    await db.query(
        `UPDATE orders 
         SET status = 'failed',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
    );
    
    // Notify user
    await safeKafkaSend({
        topic: TOPICS.NOTIFICATION_EVENTS,
        messages: [{
            key: orderId.toString(),
            value: JSON.stringify({
                eventType: 'ORDER_FAILED',
                orderId: orderId,
                reason: reason,
                timestamp: new Date().toISOString()
            })
        }]
    });
};

// ============ HELPER FUNCTIONS ============

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
};

// Process payment (call payment service)
const processPayment = async (orderId) => {
    try {
        // Get order details
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            console.error(`Order ${orderId} not found`);
            return;
        }
        
        const order = orderResult.rows[0];
        
        // Call payment service
        const paymentResponse = await axios.post(
            'http://localhost:3005/api/v1/payments/process',
            {
                orderId: order.id,
                orderNumber: order.order_number,
                amount: parseFloat(order.total_amount),
                currency: 'USD',
                paymentMethod: order.payment_method
            },
            {
                headers: {
                    'idempotency-key': uuidv4()  // Prevent duplicate payments
                },
                timeout: 10000
            }
        );
        
        // Payment initiated - result will come via Kafka
        console.log(`Payment initiated for order ${orderId}`);
        
    } catch (error) {
        console.error(`Payment processing failed for order ${orderId}:`, error.message);
        
        // Send payment failed event
        await safeKafkaSend({
            topic: TOPICS.ORDER_PAYMENT,
            messages: [{
                key: orderId.toString(),
                value: JSON.stringify({
                    eventType: 'PAYMENT_FAILED',
                    orderId: orderId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            }]
        });
    }
};

// ============ API ROUTES ============

// ========== CREATE ORDER ==========
app.post('/api/v1/orders', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { shippingAddress, paymentMethod } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        if (!shippingAddress || !paymentMethod) {
            return res.status(400).json({ 
                error: 'Shipping address and payment method required' 
            });
        }
        
        // Get cart from Cart Service
        const cartResponse = await axios.get(
            'http://localhost:3003/api/v1/cart',
            { headers: { 'x-user-id': userId } }
        );
        
        const cart = cartResponse.data;
        
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        // Calculate totals
        const subtotal = cart.totalPrice;
        const tax = subtotal * 0.1;  // 10% tax
        const shippingCost = subtotal > 50 ? 0 : 5.99;  // Free shipping over $50
        const totalAmount = subtotal + tax + shippingCost;
        
        // Generate order number
        const orderNumber = generateOrderNumber();
        
        // Create order in database (transaction)
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');  // Start transaction
            
            // Insert order
            const orderResult = await client.query(
                `INSERT INTO orders 
                 (order_number, user_id, subtotal, tax, shipping_cost, total_amount, 
                  shipping_address, payment_method, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [orderNumber, userId, subtotal, tax, shippingCost, totalAmount,
                 JSON.stringify(shippingAddress), paymentMethod, 'pending']
            );
            
            const order = orderResult.rows[0];
            
            // Insert order items
            for (const item of cart.items) {
                await client.query(
                    `INSERT INTO order_items 
                     (order_id, product_id, product_name, quantity, unit_price, total_price)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [order.id, item.productId, item.name, item.quantity, 
                     item.price, item.total]
                );
            }
            
            await client.query('COMMIT');  // Commit transaction
            
            // Clear cart after order creation
            await axios.delete('http://localhost:3003/api/v1/cart/clear', {
                headers: { 'x-user-id': userId }
            });
            
            // Send order created event to Kafka
            await safeKafkaSend({
                topic: TOPICS.ORDER_EVENTS,
                messages: [{
                    key: order.id.toString(),
                    value: JSON.stringify({
                        eventType: 'ORDER_CREATED',
                        orderId: order.id,
                        orderNumber: order.order_number,
                        userId: userId,
                        items: cart.items,
                        totalAmount: totalAmount,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
            
            // Request inventory reservation
            await safeKafkaSend({
                topic: TOPICS.INVENTORY_EVENTS,
                messages: [{
                    key: order.id.toString(),
                    value: JSON.stringify({
                        eventType: 'RESERVE_INVENTORY',
                        orderId: order.id,
                        items: cart.items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity
                        })),
                        timestamp: new Date().toISOString()
                    })
                }]
            });
            
            res.status(201).json({
                order: order,
                message: 'Order created. Processing payment...'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');  // Rollback on error
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// ========== GET ORDER ==========
app.get('/api/v1/orders/:id', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const orderId = parseInt(req.params.id);
        
        const orderResult = await db.query(
            `SELECT * FROM orders 
             WHERE id = $1 AND user_id = $2`,
            [orderId, userId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderResult.rows[0];
        
        // Get order items
        const itemsResult = await db.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [orderId]
        );
        
        order.items = itemsResult.rows;
        
        res.json(order);
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// ========== LIST USER ORDERS ==========
app.get('/api/v1/orders', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { page = 1, limit = 20, status } = req.query;
        
        let query = 'SELECT * FROM orders WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        
        // Get total count
        const countResult = await db.query(
            'SELECT COUNT(*) FROM orders WHERE user_id = $1',
            [userId]
        );
        
        res.json({
            orders: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
        
    } catch (error) {
        console.error('List orders error:', error);
        res.status(500).json({ error: 'Failed to list orders' });
    }
});

// ========== CANCEL ORDER ==========
app.put('/api/v1/orders/:id/cancel', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const orderId = parseInt(req.params.id);
        
        // Check if order can be cancelled
        const orderResult = await db.query(
            'SELECT status FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const currentStatus = orderResult.rows[0].status;
        const cancellableStatuses = ['pending', 'confirmed'];
        
        if (!cancellableStatuses.includes(currentStatus)) {
            return res.status(400).json({ 
                error: `Order cannot be cancelled in status: ${currentStatus}` 
            });
        }
        
        // Update order status
        await db.query(
            `UPDATE orders 
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
            [orderId]
        );
        
        // Release inventory
        await safeKafkaSend({
            topic: TOPICS.INVENTORY_EVENTS,
            messages: [{
                key: orderId.toString(),
                value: JSON.stringify({
                    eventType: 'RELEASE_INVENTORY',
                    orderId: orderId,
                    reason: 'Order cancelled by user',
                    timestamp: new Date().toISOString()
                })
            }]
        });
        
        res.json({ success: true, message: 'Order cancelled' });
        
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========

const PORT = 3004;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   📋 ORDER SERVICE STARTED           ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Database: PostgreSQL               ║
    ║   Transactions: ACID compliant       ║
    ╚══════════════════════════════════════╝
    `);
});
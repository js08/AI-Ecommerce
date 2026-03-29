const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const axios = require('axios');  // HTTP client for calling other services

const app = express();
app.use(express.json());

// PostgreSQL for orders - needs ACID compliance (Atomicity, Consistency, Isolation, Durability)
// Orders involve money and inventory - cannot lose data
const db = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ecommerce',
    user: 'postgres',
    password: 'password'
});

// Create orders table
const initDatabase = async () => {
    const createOrdersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            total_price DECIMAL(10, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',  -- pending, confirmed, shipped, delivered, cancelled
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    await db.query(createOrdersTable);
    console.log('✅ Orders table ready');
};
initDatabase();

// Kafka setup
const kafka = new Kafka({
    clientId: 'order-service',
    brokers: ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'order-service-group' });

const connectKafka = async () => {
    await producer.connect();
    await consumer.connect();
    
    // Subscribe to inventory events
    // Consumer "listens" to messages from Kafka
    await consumer.subscribe({ topic: 'inventory-events', fromBeginning: false });
    
    // Process incoming messages
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            console.log('Received inventory event:', event);
            
            if (event.eventType === 'INVENTORY_RESERVED') {
                // Update order status to confirmed
                await db.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['confirmed', event.orderId]
                );
            } else if (event.eventType === 'INVENTORY_FAILED') {
                // Update order status to failed
                await db.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['failed', event.orderId]
                );
            }
        }
    });
    
    console.log('✅ Kafka connected');
};
connectKafka();

// CREATE ORDER - Main order placement flow
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;
        
        // Step 1: Get product details from Product Service (via HTTP)
        // This is synchronous - we need price before creating order
        const productResponse = await axios.get(`http://localhost:3002/api/products/${productId}`);
        const product = productResponse.data;
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Calculate total price
        const totalPrice = product.price * quantity;
        
        // Step 2: Create order with 'pending' status
        const result = await db.query(
            `INSERT INTO orders (user_id, product_id, quantity, total_price, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, productId, quantity, totalPrice, 'pending']
        );
        
        const order = result.rows[0];
        
        // Step 3: Send event to Inventory Service to reserve stock
        // This is asynchronous - inventory service will process and respond
        await producer.send({
            topic: 'order-events',
            messages: [
                {
                    key: order.id.toString(),
                    value: JSON.stringify({
                        eventType: 'ORDER_CREATED',
                        orderId: order.id,
                        userId: order.user_id,
                        productId: order.product_id,
                        quantity: order.quantity,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
        
        // Return order immediately (inventory reservation happening in background)
        res.status(201).json({
            order: order,
            message: 'Order created, waiting for inventory confirmation'
        });
        
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET ORDER - Retrieve order details
app.get('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.body.userId;  // From API Gateway
        
        const result = await db.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start order service
const PORT = 3003;
app.listen(PORT, () => {
    console.log(`📦 Order Service running on port ${PORT}`);
});
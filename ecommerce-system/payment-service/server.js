// ============================================
// PAYMENT SERVICE - Processes payments via Stripe
// Database: PostgreSQL (for payment records)
// ============================================

const express = require('express');
const { Pool } = require('pg');
const { createProducer, TOPICS } = require('../shared/kafka-config');
const Stripe = require('stripe');
const crypto = require('crypto');
const { devCors } = require('../shared/dev-cors');

const app = express();
app.use(devCors());
app.use(express.json());

// Initialize Stripe with secret key
// Get this from https://dashboard.stripe.com/test/apikeys
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_...', {
    apiVersion: '2023-10-16',
    maxNetworkRetries: 3  // Automatically retry failed network requests
});

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
    await db.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
            order_id INTEGER NOT NULL,
            order_number VARCHAR(50) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'USD',
            status VARCHAR(50) DEFAULT 'pending',
            payment_method VARCHAR(50),
            customer_email VARCHAR(255),
            metadata JSONB,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    `);
    
    await db.query('CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
    
    console.log('✅ Payment database tables ready');
};

initDatabase().catch((e) => console.error('Payment initDatabase:', e.message));

// ============ KAFKA SETUP ============

let kafkaProducer = null;

const setupKafka = async () => {
    try {
        kafkaProducer = await createProducer('payment-service');
        console.log('✅ Kafka producer ready');
    } catch (e) {
        console.warn('⚠️ Payment Kafka unavailable:', e.message);
        kafkaProducer = null;
    }
};

setupKafka().catch((e) => console.warn('Kafka setup:', e.message));

const safeKafkaSend = async (payload) => {
    if (!kafkaProducer) return;
    try {
        await kafkaProducer.send(payload);
    } catch (e) {
        console.warn('Kafka send:', e.message);
    }
};

// ============ HELPER FUNCTIONS ============

// Store payment record in database
const storePaymentRecord = async (paymentIntent, orderId, orderNumber, customerEmail) => {
    const result = await db.query(
        `INSERT INTO payments 
         (payment_intent_id, order_id, order_number, amount, currency, 
          status, payment_method, customer_email, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [paymentIntent.id, orderId, orderNumber, paymentIntent.amount / 100,
         paymentIntent.currency, paymentIntent.status, paymentIntent.payment_method,
         customerEmail, JSON.stringify(paymentIntent.metadata || {})]
    );
    
    return result.rows[0];
};

// ============ API ROUTES ============

// ========== PROCESS PAYMENT ==========
app.post('/api/v1/payments/process', async (req, res) => {
    try {
        const { orderId, orderNumber, amount, currency = 'usd', paymentMethod, customerEmail } = req.body;
        const idempotencyKey = req.headers['idempotency-key'];
        
        if (!orderId || !orderNumber || !amount) {
            return res.status(400).json({ 
                error: 'Missing required fields: orderId, orderNumber, amount' 
            });
        }
        
        // Check if payment already processed (idempotency)
        if (idempotencyKey) {
            const existingPayment = await db.query(
                'SELECT * FROM payments WHERE metadata->>idempotencyKey = $1',
                [idempotencyKey]
            );
            
            if (existingPayment.rows.length > 0) {
                return res.json({
                    success: true,
                    payment: existingPayment.rows[0],
                    message: 'Payment already processed'
                });
            }
        }
        
        // Create Stripe Payment Intent
        // Payment Intent = Stripe's way of tracking a payment from start to finish
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),  // Convert to cents
            currency: currency.toLowerCase(),
            payment_method_types: ['card'],
            receipt_email: customerEmail,
            metadata: {
                orderId: orderId.toString(),
                orderNumber: orderNumber,
                idempotencyKey: idempotencyKey || crypto.randomUUID()
            },
            // Set up automatic payment methods
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'  // Don't redirect to external pages
            }
        });
        
        // Store payment record
        const paymentRecord = await storePaymentRecord(
            paymentIntent, orderId, orderNumber, customerEmail
        );
        
        // Send payment initiated event
        await safeKafkaSend({
            topic: TOPICS.ORDER_PAYMENT,
            messages: [{
                key: orderId.toString(),
                value: JSON.stringify({
                    eventType: 'PAYMENT_INITIATED',
                    orderId: orderId,
                    paymentIntentId: paymentIntent.id,
                    amount: amount,
                    status: paymentIntent.status,
                    timestamp: new Date().toISOString()
                })
            }]
        });
        
        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,  // For frontend to confirm payment
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status
        });
        
    } catch (error) {
        console.error('Payment processing error:', error);
        
        // Send payment failed event
        await safeKafkaSend({
            topic: TOPICS.ORDER_PAYMENT,
            messages: [{
                key: req.body.orderId?.toString() || 'unknown',
                value: JSON.stringify({
                    eventType: 'PAYMENT_FAILED',
                    orderId: req.body.orderId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            }]
        });
        
        res.status(500).json({ 
            error: 'Payment processing failed',
            message: error.message 
        });
    }
});

// ========== CONFIRM PAYMENT (Webhook from Stripe) ==========
// Stripe calls this webhook when payment status changes
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_...';
    
    let event;
    
    try {
        // Verify webhook signature (ensures it's really from Stripe)
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`Payment succeeded: ${paymentIntent.id}`);
            
            // Update payment record
            await db.query(
                `UPDATE payments 
                 SET status = 'succeeded', completed_at = NOW()
                 WHERE payment_intent_id = $1`,
                [paymentIntent.id]
            );
            
            // Send success event to Kafka
            const orderId = paymentIntent.metadata.orderId;
            
            await safeKafkaSend({
                topic: TOPICS.ORDER_PAYMENT,
                messages: [{
                    key: orderId,
                    value: JSON.stringify({
                        eventType: 'PAYMENT_SUCCESS',
                        orderId: parseInt(orderId),
                        paymentIntentId: paymentIntent.id,
                        amount: paymentIntent.amount / 100,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
            break;
            
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log(`Payment failed: ${failedPayment.id}`);
            
            await db.query(
                `UPDATE payments 
                 SET status = 'failed', error_message = $1
                 WHERE payment_intent_id = $2`,
                [failedPayment.last_payment_error?.message, failedPayment.id]
            );
            
            await safeKafkaSend({
                topic: TOPICS.ORDER_PAYMENT,
                messages: [{
                    key: failedPayment.metadata.orderId,
                    value: JSON.stringify({
                        eventType: 'PAYMENT_FAILED',
                        orderId: parseInt(failedPayment.metadata.orderId),
                        paymentIntentId: failedPayment.id,
                        error: failedPayment.last_payment_error?.message,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
            break;
            
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
});

// ========== GET PAYMENT METHODS ==========
app.get('/api/v1/payments/methods', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        // In production, you'd fetch saved payment methods from database
        // For now, return supported methods
        res.json({
            methods: [
                { id: 'card', name: 'Credit/Debit Card', icon: '💳' },
                { id: 'paypal', name: 'PayPal', icon: '💰' },
                { id: 'apple_pay', name: 'Apple Pay', icon: '📱' }
            ]
        });
        
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

// ========== GET PAYMENT HISTORY ==========
app.get('/api/v1/payments/history', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        // Get all payments for user's orders
        const result = await db.query(
            `SELECT p.*, o.status as order_status
             FROM payments p
             JOIN orders o ON p.order_id = o.id
             WHERE o.user_id = $1
             ORDER BY p.created_at DESC`,
            [userId]
        );
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Payment history error:', error);
        res.status(500).json({ error: 'Failed to get payment history' });
    }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   💳 PAYMENT SERVICE STARTED         ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Gateway: Stripe                    ║
    ║   Webhook: /api/v1/payments/webhook  ║
    ╚══════════════════════════════════════╝
    `);
});
// ============================================
// NOTIFICATION SERVICE - Sends emails, SMS, push notifications
// No database - just processes Kafka messages
// ============================================

const express = require('express');
const { createConsumer, TOPICS } = require('../../shared/kafka-config');
const nodemailer = require('nodemailer');  // For emails
const twilio = require('twilio');  // For SMS
const admin = require('firebase-admin');  // For push notifications

const app = express();
app.use(express.json());

// ============ EMAIL SETUP (using Gmail SMTP) ============
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// ============ SMS SETUP (Twilio) ============
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID || 'your_account_sid',
    process.env.TWILIO_AUTH_TOKEN || 'your_auth_token'
);

// ============ PUSH NOTIFICATION SETUP (Firebase) ============
// Initialize Firebase Admin SDK
// Download service account key from Firebase Console
try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase initialized');
} catch (error) {
    console.warn('Firebase not configured:', error.message);
}

// ============ KAFKA SETUP ============

const setupKafka = async () => {
    const consumer = await createConsumer(
        'notification-service',
        'notification-service-group',
        [TOPICS.NOTIFICATION_EVENTS, TOPICS.ORDER_EVENTS, TOPICS.USER_EVENTS]
    );
    
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            console.log(`📧 Notification service received: ${event.eventType}`);
            
            switch (event.eventType) {
                case 'USER_REGISTERED':
                    await sendWelcomeEmail(event);
                    break;
                    
                case 'ORDER_CONFIRMED':
                    await sendOrderConfirmation(event);
                    break;
                    
                case 'ORDER_FAILED':
                    await sendOrderFailedNotification(event);
                    break;
                    
                case 'PASSWORD_RESET_REQUESTED':
                    await sendPasswordResetEmail(event);
                    break;
                    
                default:
                    console.log('Unknown notification event:', event.eventType);
            }
        }
    });
    
    console.log('✅ Kafka consumer ready');
};

setupKafka();

// ============ NOTIFICATION SENDERS ============

// Send welcome email
const sendWelcomeEmail = async (event) => {
    const { email, fullName } = event;
    
    const mailOptions = {
        from: '"Ecommerce Store" <welcome@ecommerce.com>',
        to: email,
        subject: 'Welcome to Ecommerce! 🎉',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Welcome ${fullName || 'Shopper'}!</h1>
                <p>Thank you for joining our community!</p>
                <p>You now have access to:</p>
                <ul>
                    <li>Millions of products</li>
                    <li>Fast shipping</li>
                    <li>24/7 customer support</li>
                </ul>
                <a href="https://ecommerce.com/shop" 
                   style="background-color: #4CAF50; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    Start Shopping
                </a>
            </div>
        `
    };
    
    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${email}`);
    } catch (error) {
        console.error('Failed to send welcome email:', error.message);
    }
};

// Send order confirmation email
const sendOrderConfirmation = async (event) => {
    const { orderId, userId } = event;
    
    // In production, you'd fetch order details from database
    // For now, send generic confirmation
    
    const mailOptions = {
        from: '"Ecommerce Store" <orders@ecommerce.com>',
        to: 'customer@example.com',  // Would come from event
        subject: `Order Confirmation #${orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h1>Order Confirmed! ✅</h1>
                <p>Your order #${orderId} has been confirmed.</p>
                <p>We'll notify you when it ships.</p>
                <a href="https://ecommerce.com/orders/${orderId}">
                    Track Your Order
                </a>
            </div>
        `
    };
    
    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Order confirmation sent for order ${orderId}`);
    } catch (error) {
        console.error('Failed to send order confirmation:', error.message);
    }
};

// Send password reset email
const sendPasswordResetEmail = async (event) => {
    const { email, resetToken } = event;
    
    const resetLink = `https://ecommerce.com/reset-password?token=${resetToken}`;
    
    const mailOptions = {
        from: '"Ecommerce Store" <security@ecommerce.com>',
        to: email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h1>Reset Your Password</h1>
                <p>Click the link below to reset your password. This link expires in 1 hour.</p>
                <a href="${resetLink}" 
                   style="background-color: #ff9800; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    Reset Password
                </a>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `
    };
    
    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error('Failed to send password reset:', error.message);
    }
};

// Send order failed notification (SMS for urgent issues)
const sendOrderFailedNotification = async (event) => {
    const { orderId, reason } = event;
    
    // Send SMS for critical failures
    try {
        await twilioClient.messages.create({
            body: `Order #${orderId} failed: ${reason}. Please contact support.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: process.env.CUSTOMER_PHONE_NUMBER  // Would come from user profile
        });
        console.log(`SMS sent for order ${orderId} failure`);
    } catch (error) {
        console.error('Failed to send SMS:', error.message);
    }
};

// ============ API ROUTES ============

// Update notification preferences
app.post('/api/v1/notifications/preferences', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { emailEnabled, smsEnabled, pushEnabled } = req.body;
        
        // In production, store preferences in database
        // For now, just acknowledge
        
        res.json({
            success: true,
            preferences: { emailEnabled, smsEnabled, pushEnabled }
        });
        
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Get notification history
app.get('/api/v1/notifications/history', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        // In production, fetch from database
        res.json({
            notifications: [
                { id: 1, type: 'email', message: 'Welcome!', sentAt: new Date() }
            ]
        });
        
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// ========== START SERVER ==========

const PORT = 3007;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   🔔 NOTIFICATION SERVICE STARTED    ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Email: Nodemailer (SMTP)           ║
    ║   SMS: Twilio                        ║
    ║   Push: Firebase                     ║
    ╚══════════════════════════════════════╝
    `);
});
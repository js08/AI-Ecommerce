// Kafka configuration shared across all microservices
// This ensures consistent setup across the entire system

const { Kafka } = require('kafkajs');

// Create Kafka client instance
// Each service will create its own connection using this config
const kafkaConfig = {
    clientId: 'ecommerce-platform',  // Base client ID (service will add its name)
    brokers: ['localhost:9092'],      // Kafka server address
    retry: {
        // If connection fails, retry with exponential backoff
        initialRetryTime: 300,    // Start with 300ms delay
        retries: 10,               // Try 10 times
        multiplier: 2              // Double delay each time (300, 600, 1200...)
    }
};

// Define all Kafka topics (like channels in a chat app)
// Each topic handles different types of events
const TOPICS = {
    // User-related events
    USER_EVENTS: 'user-events',           // USER_REGISTERED, USER_LOGIN, USER_UPDATED
    USER_DELETED: 'user-deleted',         // When user closes account
    
    // Order-related events
    ORDER_EVENTS: 'order-events',         // ORDER_CREATED, ORDER_CONFIRMED, ORDER_CANCELLED
    ORDER_PAYMENT: 'order-payment',       // PAYMENT_SUCCESS, PAYMENT_FAILED
    
    // Inventory events
    INVENTORY_EVENTS: 'inventory-events', // STOCK_RESERVED, STOCK_RELEASED, OUT_OF_STOCK
    INVENTORY_UPDATES: 'inventory-updates', // Manual stock updates from sellers
    
    // Product events
    PRODUCT_EVENTS: 'product-events',     // PRODUCT_ADDED, PRODUCT_UPDATED, PRODUCT_DELETED
    
    // Notification events
    NOTIFICATION_EVENTS: 'notification-events', // EMAIL_REQUIRED, SMS_REQUIRED, PUSH_REQUIRED
    
    // Dead Letter Queue (failed messages go here for debugging)
    DEAD_LETTER: 'dead-letter-queue'
};

// Helper function to create a Kafka producer (for sending messages)
// Producer sends events TO Kafka
const createProducer = async (serviceName) => {
    const kafka = new Kafka({
        ...kafkaConfig,
        clientId: `${serviceName}-producer`
    });
    
    const producer = kafka.producer({
        allowAutoTopicCreation: true,  // Create topic if it doesn't exist
        transactionTimeout: 30000      // 30 seconds for transactions
    });
    
    await producer.connect();
    console.log(`✅ ${serviceName} producer connected to Kafka`);
    return producer;
};

// Helper function to create a Kafka consumer (for receiving messages)
// Consumer listens FOR messages from Kafka
const createConsumer = async (serviceName, groupId, topics) => {
    const kafka = new Kafka({
        ...kafkaConfig,
        clientId: `${serviceName}-consumer`
    });
    
    // Consumer group: multiple consumers can share work
    // Each message goes to only one consumer in the group
    const consumer = kafka.consumer({ 
        groupId: groupId,
        sessionTimeout: 30000,  // If no heartbeat for 30s, consider dead
        heartbeatInterval: 3000  // Send heartbeat every 3 seconds
    });
    
    await consumer.connect();
    
    // Subscribe to multiple topics
    for (const topic of topics) {
        await consumer.subscribe({ 
            topic: topic, 
            fromBeginning: false  // Don't read old messages, only new ones
        });
    }
    
    console.log(`✅ ${serviceName} consumer subscribed to: ${topics.join(', ')}`);
    return consumer;
};

// Export for use in all services
module.exports = {
    TOPICS,
    createProducer,
    createConsumer,
    kafkaConfig
};
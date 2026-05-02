const { Kafka } = require('kafkajs');
const Achievement = require('../models/Achievement');

// 1. Initialize Kafka Client
const kafka = new Kafka({
  clientId: 'goal-service-node',
  brokers: ['localhost:9092'], // Where your Kafka is running
  retry: {
    initialRetryTime: 300, // How long to wait before first retry
    retries: 5             // How many times to try if connection fails
  }
});

const consumer = kafka.consumer({ groupId: 'goal-service-group' });

const runConsumer = async () => {
  // 2. Connect and Subscribe to the topic
  await consumer.connect();
  await consumer.subscribe({ topic: 'goal-topic', fromBeginning: true });

  // 3. Start listening for messages
  await consumer.run({
    // EACH MESSAGE handling: This is where we process the data
    eachMessage: async ({ topic, partition, message }) => {
      try {
        // Decode the message from Buffer to JSON
        const payload = JSON.parse(message.value.toString());
        const userId = message.key.toString(); // Extract the userId sent as Key from Java

        console.log(`📩 Received from Partition ${partition} for User ${userId}`);

        // 4. Save to MongoDB
        const newAchievement = new Achievement({
          message: `🏆 Goal Reached! Total Sum: ${payload.totalSum}ms`,
          totalTime: payload.totalSum,
          userId: userId
        });

        await newAchievement.save();
        console.log("⭐ Saved to MongoDB successfully!");

      } catch (err) {
        // 5. ERROR HANDLING (The "Retry" logic)
        console.error("❌ Error processing Kafka message:", err.message);
        // In a real app, you would send this to a "Dead Letter Queue" here
      }
    },
  });
};

module.exports = runConsumer;
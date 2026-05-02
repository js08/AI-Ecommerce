const mongoose = require('mongoose');

// 1. Define the Schema: This is the "Blueprint" for our MongoDB document
const achievementSchema = new mongoose.Schema({
  message: { type: String, required: true },
  totalTime: { type: Number, required: true },
  userId: { type: String, required: true }, // The Kafka "Key" we sent from Java
  achievedAt: { type: Date, default: Date.now }
});

// 2. Export the Model so we can save data to the "achievements" collection
module.exports = mongoose.model('Achievement', achievementSchema);
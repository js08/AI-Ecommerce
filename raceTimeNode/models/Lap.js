// 1. Import DataTypes from the sequelize library to define column types
const { DataTypes } = require('sequelize');

// 2. Import the sequelize connection instance we created in config/database.js
const { sequelize } = require('../config/database');

/**
 * 3. Define the 'Lap' Model
 * This tells Sequelize to create a table named 'Laps' (it automatically pluralizes)
 */
const Lap = sequelize.define('Lap', {
  // Define the Primary Key 'id'
  id: {
    type: DataTypes.INTEGER,      // Type: Integer
    primaryKey: true,             // Marks this as the unique ID
    autoIncrement: true,          // Automatically adds 1 for every new row (1, 2, 3...)
  },

  // Define the 'durationMs' column
  durationMs: {
    type: DataTypes.INTEGER,      // Type: Integer (to store milliseconds)
    allowNull: false,             // 'NOT NULL' constraint - every lap must have a time
    validate: {
      min: 0                      // Validation: A lap cannot be negative time
    }
  }
}, {
  // 4. Additional Model Options
  tableName: 'laps',              // Explicitly name the table 'laps'
  timestamps: true                // Automatically adds 'createdAt' and 'updatedAt' columns
});

// 5. Export the model so the Controller can use it to save data
module.exports = Lap;
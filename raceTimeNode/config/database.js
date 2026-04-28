// 1. Import the Sequelize class from the library
const { Sequelize } = require('sequelize');

// 2. Import 'dotenv' to read your database credentials from the .env file
// This keeps your password secret!
require('dotenv').config();

/**
 * 3. Create a new "Instance" of Sequelize.
 * This object holds the connection settings for your Postgres DB.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,     // The name of your database (e.g., 'stopwatch_db')
  process.env.DB_USER,     // Your Postgres username (usually 'postgres')
  process.env.DB_PASSWORD, // Your Postgres password
  {
    host: process.env.DB_HOST, // Where the DB lives (usually 'localhost' or '127.0.0.1')
    dialect: 'postgres',       // Tells Sequelize we are specifically using PostgreSQL
    logging: false,            // Prevents flooding your terminal with SQL logs (set to true to see them)
    port: process.env.DB_PORT || 5432, // The default Postgres port is 5432
  }
);

/**
 * 4. Define an "Authentication" function.
 * This is like a 'ping' to make sure the database is actually awake and talking to us.
 */
const connectDB = async () => {
  try {
    // .authenticate() tries to log in to the database
    await sequelize.authenticate();
    console.log('✅ Connection to PostgreSQL has been established successfully.');
  } catch (error) {
    // If something is wrong (wrong password, DB not running), it will land here
    console.error('❌ Unable to connect to the database:', error);
  }
};

// 5. Export BOTH the sequelize instance (for models) and the connect function (for server.js)
module.exports = { sequelize, connectDB };
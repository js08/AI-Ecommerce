// 1. Import Express to create our web server
const express = require('express');

// 2. Import CORS (Cross-Origin Resource Sharing)
// This is essential so your React app (port 3000) can talk to this server (port 8080)
const cors = require('cors');

// 3. Import the database connection and sequelize instance
const { connectDB, sequelize } = require('./config/database');

// 4. Import the routes we defined for our laps
const lapRoutes = require('./routes/lapRoutes');

// 5. Create an instance of the Express application
const app = express();

// 6. MIDDLEWARE: Tools that process the request before it reaches your routes
app.use(cors()); // Allow requests from different domains (React)
app.use(express.json()); // Tell Express to parse incoming JSON data (important for POST requests)

// 7. ROUTES: Connect our lap-related URLs
// This prefix means all routes in lapRoutes start with /api/laps
app.use('/api/laps', lapRoutes);

// 8. DATABASE & SERVER START
// We want to make sure the database is ready BEFORE the server starts listening
const startServer = async () => {
  try {
    // A. Connect to Postgres
    await connectDB();

    // B. Sync Models: This automatically creates the 'laps' table if it doesn't exist
    // 'alter: true' updates the table if you add new columns later
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized');

    // C. Define the Port (use 8080 or whatever is in your .env)
    const PORT = process.env.PORT || 8080;

    // D. Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
  }
};

// 9. Execute the start function
startServer();
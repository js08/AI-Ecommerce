// 1. Import the Express library to use its Router
const express = require('express');

// 2. Create a 'Router' object - this acts like a mini-app for just lap-related URLs
const router = express.Router();

// 3. Import the Controller we created earlier
// This gives us access to createLap, getAllLaps, analyzePatterns, etc.
const lapController = require('../controllers/lapController');

/**
 * 4. Define the Routes (The Traffic Map)
 * These connect a HTTP Method (GET, POST, etc.) + a URL to a Controller function
 */

// POST: http://localhost:8080/api/laps
// Used to save a new lap from the stopwatch
router.post('/', lapController.createLap);

// GET: http://localhost:8080/api/laps
// Used to fetch the history of all laps
router.get('/', lapController.getAllLaps);

// GET: http://localhost:8080/api/laps/analyze
// Used to run your Sliding Window algorithm (AnalyticsService logic)
router.get('/analyze', lapController.analyzePatterns);
router.get('/analyze-even-list', lapController.getEvenPatternsList);

// DELETE: http://localhost:8080/api/laps
// Used to clear the entire history
router.delete('/', lapController.deleteAllLaps);

// 5. Export the router so the main 'server.js' can use it
module.exports = router;
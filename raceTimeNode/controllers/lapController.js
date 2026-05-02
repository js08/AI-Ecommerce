// 1. Import the Lap model to interact with the database
const Lap = require('../models/Lap');

// 2. Import the Analytics Service to use your sliding window algorithm
const analyticsService = require('../services/analyticsService');

/**
 * CREATE: Save a new lap
 * Triggered by a POST request from your React Stopwatch
 */
exports.createLap = async (req, res) => {
  try {
    // Extract durationMs from the body sent by React
    const { durationMs } = req.body;

    // Save it to Postgres using Sequelize
    const newLap = await Lap.create({ durationMs });

    // Send back the saved lap with a 201 (Created) status code
    res.status(201).json(newLap);
  } catch (error) {
    // If something goes wrong, send a 500 (Server Error)
    res.status(500).json({ message: 'Error saving lap data', error: error.message });
  }
};

/**
 * READ: Get all laps
 * Useful for showing a history list in your React app
 */
exports.getAllLaps = async (req, res) => {
  try {
    // Fetch every row from the 'laps' table
    const laps = await Lap.findAll();
    res.status(200).json(laps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching laps', error: error.message });
  }
};

/**
 * ANALYZE: Use the Sliding Window logic
 * Triggered when you want to find specific workout patterns
 * URL Example: /api/laps/analyze?k=3&x=6000
 */
exports.analyzePatterns = async (req, res) => {
  try {
    // Get K (window size) and X (target sum) from the URL query
    const k = parseInt(req.query.k);
    const x = parseInt(req.query.x);

    // 1. Fetch all laps from the DB
    const allLaps = await Lap.findAll({ attributes: ['durationMs'] });

    // 2. Map the results into a simple array of numbers like [1000, 2000, 3000]
    const lapArray = allLaps.map(lap => lap.durationMs);

    // 3. Call the logic from your Service (The Sliding Window algorithm)
    const resultCount = analyticsService.countWorkoutPatterns(lapArray, k, x);

    // 4. Return the count to the user
    res.status(200).json({ 
      message: "Analysis complete",
      count: resultCount 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during analysis', error: error.message });
  }
};

/**
 * DELETE: Clear all records
 * Useful for "Resetting" your stopwatch history
 */
exports.deleteAllLaps = async (req, res) => {
  try {
    await Lap.destroy({ where: {}, truncate: true });
    res.status(200).json({ message: 'All lap history cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing history', error: error.message });
  }
};



// const Lap = require('../models/Lap');
// const analyticsService = require('../services/analyticsService');

/**
 * Handles the "analyze-even-list" request
 */
exports.getEvenPatternsList = async (req, res) => {
  try {
    // 1. Get 'k' from the URL query: /analyze-even-list?k=3
    const k = parseInt(req.query.k);

    // 2. Fetch all laps from Postgres using Sequelize
    // Replaces lapRepository.findAll()
    const allLaps = await Lap.findAll();
    console.log("Found Laps Count:", allLaps.length);
    console.log("First Lap from DB:", allLaps[0] ? allLaps[0].toJSON() : "No data found");

    // 3. Call the service logic
    const results = analyticsService.getEvenSumWindows(allLaps, k);

    // 4. Send the array of objects back as JSON
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: "Analysis failed", error: error.message });
  }
};
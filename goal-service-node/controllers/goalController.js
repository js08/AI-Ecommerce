const Achievement = require('../models/Achievement');

exports.getGoals = async (req, res) => {
  try {
    // Fetch all records from MongoDB
    const goals = await Achievement.find().sort({ achievedAt: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
/**
 * aiRoutes.js - API routes for AI service
 * Maps endpoints to controller methods
 */

const express = require('express');
const multer = require('multer');
const { AIController } = require('../controllers/aiController');
const { authMiddleware } = require('../middleware/auth');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Setup AI routes
 * @param {Object} services - Service instances
 * @returns {express.Router} Configured router
 */
function setupRoutes(services) {
  const router = express.Router();
  const controller = new AIController(services);
  
  // Health check (public)
  router.get('/health', controller.healthCheck.bind(controller));
  
  // Recommendation routes
  router.get(
    '/recommendations/:userId',
    authMiddleware,
    controller.getRecommendations.bind(controller)
  );
  
  // Fraud detection
  router.post(
    '/fraud-check',
    authMiddleware,
    controller.detectFraud.bind(controller)
  );
  
  // Price optimization
  router.get(
    '/optimal-price/:productId',
    authMiddleware,
    controller.calculateOptimalPrice.bind(controller)
  );
  
  // Sentiment analysis
  router.post(
    '/sentiment',
    authMiddleware,
    controller.analyzeSentiment.bind(controller)
  );
  
  // Demand forecast
  router.get(
    '/forecast/:productId',
    authMiddleware,
    controller.getForecast.bind(controller)
  );
  
  // Visual search (requires image upload)
  router.post(
    '/visual-search',
    authMiddleware,
    upload.single('image'),
    (req, res, next) => {
      req.startTime = Date.now();
      next();
    },
    controller.visualSearch.bind(controller)
  );
  
  // Chatbot
  router.post(
    '/chat',
    authMiddleware,
    controller.chat.bind(controller)
  );
  
  // Personalized search
  router.post(
    '/search',
    authMiddleware,
    controller.personalizedSearch.bind(controller)
  );
  
  return router;
}

module.exports = { setupRoutes };
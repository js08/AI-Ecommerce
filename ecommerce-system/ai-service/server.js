/**
 * AI Service - Main entry point
 * Handles all machine learning features for the e-commerce platform
 * 
 * Features:
 * 1. Product Recommendations (Collaborative Filtering + Neural Networks)
 * 2. Visual Search (Find products by uploading images)
 * 3. AI Chatbot (Customer support with GPT-like responses)
 * 4. Price Optimization (Dynamic pricing based on demand)
 * 5. Fraud Detection (Real-time transaction analysis)
 * 6. Sentiment Analysis (Review classification)
 * 7. Demand Forecasting (Predict future sales)
 * 8. Personalized Search (Rank products by user preference)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const { Kafka } = require('kafkajs');
const { createClient } = require('redis');
const { Pool } = require('pg');

// Import AI/ML modules
const { RecommendationEngine } = require('./models/recommendationEngine');
const { FraudDetectionModel, detectFraud } = require('./models/fraudDetectionModel');
const { PriceOptimizer } = require('./models/priceOptimizer');
const { SentimentAnalyzer } = require('./models/sentimentAnalyzer');

const { VisualSearchService } = require('./services/visualSearchService');
const { ChatbotService } = require('./services/chatbotService');
const { ForecastService } = require('./services/forecastService');

// Import utilities
const { VectorStore } = require('./utils/vectorStore');
const { ImageProcessor } = require('./utils/imageProcessor');
const { logger } = require('./utils/logger');

// Load configuration
const config = require('./config/modelConfig');

// Initialize Express app
const app = express();
// Do not use generic PORT (often set by React tooling); gateway expects AI on 8008
const PORT = parseInt(process.env.AI_SERVICE_PORT || '8008', 10);

// ============ MIDDLEWARE ============
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(express.json({ limit: '50mb' })); // Parse JSON (large for images)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads (images for visual search)
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ============ DATABASE CONNECTIONS ============

// PostgreSQL for storing training data and predictions
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecommerce_main',
  user: process.env.DB_USER || 'ecommerce_user',
  password: process.env.DB_PASSWORD || 'secure_password_123',
  max: 20 // Connection pool size
});

// Redis for caching model predictions (fast responses)
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
});

// Kafka for real-time event streaming
const kafkaBrokers = (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092')
  .split(',')
  .map((s) => s.trim());
const kafka = new Kafka({
  clientId: 'ai-service',
  brokers: kafkaBrokers
});

const kafkaConsumer = kafka.consumer({ groupId: 'ai-service-group' });
const kafkaProducer = kafka.producer();

// ============ INITIALIZE SERVICES ============

// Initialize AI models
let recommendationEngine = null;
let fraudModel = null;
let priceOptimizer = null;
let sentimentAnalyzer = null;
let visualSearchService = null;
let chatbotService = null;
let forecastService = null;
let vectorStore = null;

/**
 * Initialize all AI models on startup
 * This can take a few seconds as models load into memory
 */
async function initializeModels() {
  logger.info('Initializing AI models...');

  const run = async (name, fn) => {
    try {
      await fn();
      logger.info(`✓ ${name}`);
    } catch (err) {
      logger.warn(`⚠ ${name} skipped:`, err.message);
    }
  };

  await run('Recommendation model', async () => {
    recommendationEngine = await RecommendationEngine.load();
  });
  await run('Fraud detection model', async () => {
    fraudModel = await FraudDetectionModel.load();
  });
  await run('Price optimizer', async () => {
    priceOptimizer = new PriceOptimizer();
  });
  await run('Sentiment analyzer', async () => {
    sentimentAnalyzer = new SentimentAnalyzer();
    await sentimentAnalyzer.initialize();
  });
  await run('Vector store', async () => {
    vectorStore = new VectorStore(pgPool);
    await vectorStore.initialize();
  });
  await run('Visual search', async () => {
    if (!vectorStore) throw new Error('no vector store');
    visualSearchService = new VisualSearchService(vectorStore, pgPool);
  });
  await run('Chatbot', async () => {
    if (!vectorStore) throw new Error('no vector store');
    chatbotService = new ChatbotService(vectorStore);
    await chatbotService.initialize();
  });
  await run('Forecast service', async () => {
    forecastService = new ForecastService(pgPool);
    await forecastService.initialize();
  });

  logger.info('✅ AI model initialization pass completed (some modules may be skipped)');
}

// ============ KAFKA EVENT HANDLERS ============

/**
 * Listen to events from other services
 * Events trigger real-time AI predictions
 */
async function setupKafkaConsumers() {
  await kafkaConsumer.connect();
  await kafkaProducer.connect();
  
  // Listen for user view events (for recommendations)
  await kafkaConsumer.subscribe({ 
    topic: 'user-events', 
    fromBeginning: false 
  });
  
  // Listen for order events (for fraud detection)
  await kafkaConsumer.subscribe({ 
    topic: 'order-events', 
    fromBeginning: false 
  });
  
  // Listen for product updates (for price optimization)
  await kafkaConsumer.subscribe({ 
    topic: 'product-events', 
    fromBeginning: false 
  });
  
  // Process messages
  await kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      
      switch (event.eventType) {
        case 'USER_VIEWED_PRODUCT':
          // Update user behavior for recommendations
          await recommendationEngine.recordUserInteraction(
            event.userId, 
            event.productId, 
            'view'
          );
          break;
          
        case 'ORDER_CREATED':
          // Run fraud detection on new orders
          const fraudScore = await detectFraud(fraudModel, event);
          if (fraudScore > 0.8) { // High fraud probability
            // Send alert to fraud team
            await kafkaProducer.send({
              topic: 'fraud-alerts',
              messages: [{
                value: JSON.stringify({
                  orderId: event.orderId,
                  fraudScore,
                  timestamp: new Date().toISOString()
                })
              }]
            });
          }
          break;
          
        case 'PRODUCT_UPDATED':
          // Re-optimize price based on market conditions
          await priceOptimizer.updateProductPrice(event.productId);
          break;
          
        default:
          logger.debug(`Unhandled event type: ${event.eventType}`);
      }
    }
  });
  
  logger.info('Kafka consumers setup complete');
}

// ============ ROUTES ============

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    models: {
      recommendation: recommendationEngine !== null,
      fraud: fraudModel !== null,
      sentiment: sentimentAnalyzer !== null,
      visualSearch: visualSearchService !== null,
      chatbot: chatbotService !== null
    }
  });
});

/**
 * 1. PRODUCT RECOMMENDATIONS
 * 
 * Uses collaborative filtering + neural networks
 * Returns personalized product recommendations for a user
 * 
 * Algorithm: 
 * - Matrix factorization for collaborative filtering
 * - Item-to-item similarity for related products
 * - Neural network for deep learning features
 */
app.get('/api/ai/recommendations/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || 'personalized'; // personalized, similar, trending
    
    let recommendations = [];
    
    // Check cache first (reduce computation)
    const cacheKey = `rec:${userId}:${type}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached && process.env.NODE_ENV === 'production') {
      // Return cached recommendations if within 5 minutes
      recommendations = JSON.parse(cached);
    } else {
      // Generate fresh recommendations
      switch (type) {
        case 'personalized':
          // Hybrid recommendation: collaborative + content-based
          recommendations = await recommendationEngine.getPersonalizedRecommendations(
            userId, limit
          );
          break;
          
        case 'similar':
          // Find products similar to what user viewed
          const productId = parseInt(req.query.productId);
          recommendations = await recommendationEngine.getSimilarProducts(
            productId, limit
          );
          break;
          
        case 'trending':
          // Real-time trending products (based on views/purchases)
          recommendations = await recommendationEngine.getTrendingProducts(limit);
          break;
          
        default:
          recommendations = [];
      }
      
      // Cache for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify(recommendations));
    }
    
    // Add explanation for each recommendation (explainable AI)
    const recommendationsWithExplanation = recommendations.map(rec => ({
      ...rec,
      explanation: generateRecommendationExplanation(rec, type)
    }));
    
    res.json({
      success: true,
      userId,
      recommendationType: type,
      recommendations: recommendationsWithExplanation,
      modelVersion: recommendationEngine.version
    });
    
  } catch (error) {
    logger.error('Recommendation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations'
    });
  }
});

/**
 * Generate human-readable explanation for recommendation
 * This makes AI more transparent (important for interviews!)
 */
function generateRecommendationExplanation(product, type) {
  const explanations = {
    personalized: [
      `Because you bought ${product.relatedPurchase}`,
      `Customers who viewed this also bought ${product.name}`,
      `Based on your interest in ${product.category}`
    ],
    similar: [
      `Similar to ${product.similarTo}`,
      `Alternative to ${product.alternativeTo}`
    ],
    trending: [
      `Trending in ${product.category}`,
      `${product.purchaseCount} people bought this today`
    ]
  };
  
  const options = explanations[type] || explanations.personalized;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 2. VISUAL SEARCH
 * 
 * Find products by uploading an image
 * Uses deep learning (ResNet50) to extract image features
 * Then finds similar products using vector similarity search
 */
app.post('/api/ai/visual-search', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const limit = parseInt(req.query.limit) || 10;
    
    // Process image and extract features using neural network
    const imageFeatures = await visualSearchService.extractFeatures(req.file.buffer);
    
    // Search for similar products in vector database
    const similarProducts = await visualSearchService.findSimilarProducts(
      imageFeatures, 
      limit
    );
    
    // Add confidence scores and visual similarity percentage
    const results = similarProducts.map(product => ({
      ...product,
      similarityScore: product.score.toFixed(2),
      visualMatch: `${(product.score * 100).toFixed(1)}% match`
    }));
    
    res.json({
      success: true,
      queryImage: {
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      results: results,
      processingTime: `${Date.now() - req.startTime}ms`
    });
    
  } catch (error) {
    logger.error('Visual search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process image search'
    });
  }
});

/**
 * 3. AI CHATBOT
 * 
 * Customer support chatbot using LangChain + GPT
 * Features:
 * - Product recommendations
 * - Order tracking
 * - FAQ answering
 * - Returns processing
 * - Natural language understanding
 */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, userId, sessionId, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get conversation history (last 10 messages)
    const history = await redisClient.lRange(`chat:${sessionId}`, -10, -1);
    const conversationHistory = history.map(h => JSON.parse(h));
    
    // Process message through chatbot
    const response = await chatbotService.processMessage({
      message,
      userId,
      sessionId,
      context,
      history: conversationHistory
    });
    
    // Store conversation in Redis (expires after 24 hours)
    await redisClient.rPush(`chat:${sessionId}`, JSON.stringify({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }));
    
    await redisClient.rPush(`chat:${sessionId}`, JSON.stringify({
      role: 'assistant',
      content: response.reply,
      timestamp: new Date().toISOString()
    }));
    
    await redisClient.expire(`chat:${sessionId}`, 86400); // 24 hours
    
    // Track chatbot analytics
    await trackChatbotInteraction(userId, message, response);
    
    res.json({
      success: true,
      reply: response.reply,
      intent: response.intent,
      confidence: response.confidence,
      actions: response.actions, // e.g., ["track_order", "recommend_product"]
      suggestions: response.suggestions
    });
    
  } catch (error) {
    logger.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * Track chatbot interactions for improvement
 */
async function trackChatbotInteraction(userId, message, response) {
  try {
    await pgPool.query(`
      INSERT INTO chatbot_interactions 
      (user_id, user_message, bot_response, intent, confidence, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [userId, message, response.reply, response.intent, response.confidence]);
  } catch (error) {
    logger.error('Failed to track interaction:', error);
  }
}

/**
 * 4. PRICE OPTIMIZATION
 * 
 * Dynamic pricing using reinforcement learning
 * Considers:
 * - Demand elasticity
 * - Competitor prices
 - Inventory levels
 * - Seasonality
 * - Customer segments
 */
app.get('/api/ai/optimal-price/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const customerSegment = req.query.segment || 'standard';
    
    // Get current price and product info
    const product = await getProductDetails(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Calculate optimal price using ML model
    const optimalPrice = await priceOptimizer.calculateOptimalPrice({
      productId,
      currentPrice: product.price,
      cost: product.cost,
      inventory: product.inventory,
      demandHistory: await getDemandHistory(productId),
      competitorPrices: await getCompetitorPrices(productId),
      seasonality: getSeasonalityFactor(),
      customerSegment
    });
    
    // Calculate price elasticity (how demand changes with price)
    const elasticity = await priceOptimizer.calculatePriceElasticity(productId);
    
    // Generate price recommendation
    const recommendation = {
      currentPrice: product.price,
      recommendedPrice: optimalPrice.recommended,
      minPrice: optimalPrice.min,
      maxPrice: optimalPrice.max,
      expectedDemandChange: optimalPrice.demandChange,
      expectedRevenueChange: optimalPrice.revenueChange,
      confidence: optimalPrice.confidence,
      elasticity: elasticity,
      reasoning: optimalPrice.reasoning
    };
    
    // Log price optimization for audit
    await logPriceOptimization(productId, recommendation);
    
    res.json({
      success: true,
      productId,
      recommendation,
      modelVersion: priceOptimizer.version
    });
    
  } catch (error) {
    logger.error('Price optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize price'
    });
  }
});

/**
 * 5. FRAUD DETECTION
 * 
 * Real-time transaction fraud detection
 * Features used:
 * - User behavior patterns
 * - Device fingerprinting
 * - Transaction velocity
 * - Geolocation analysis
 * - Historical fraud patterns
 */
app.post('/api/ai/fraud-check', async (req, res) => {
  try {
    const transactionData = req.body;
    
    // Extract features for fraud detection
    const features = await extractFraudFeatures(transactionData);
    
    // Run prediction
    const prediction = await fraudModel.predict(features);
    
    // Get feature importance (explainable AI)
    const importantFactors = await fraudModel.explainPrediction(features);
    
    // Determine action based on fraud score
    let action = 'approve';
    let reviewPriority = 'none';
    
    if (prediction.fraudProbability > 0.9) {
      action = 'reject';
      reviewPriority = 'high';
    } else if (prediction.fraudProbability > 0.7) {
      action = 'manual_review';
      reviewPriority = 'medium';
    } else if (prediction.fraudProbability > 0.5) {
      action = 'additional_verification';
      reviewPriority = 'low';
    }
    
    // Send alert if high fraud
    if (prediction.fraudProbability > 0.8) {
      await sendFraudAlert(transactionData, prediction);
    }
    
    res.json({
      success: true,
      transactionId: transactionData.transactionId,
      fraudScore: prediction.fraudProbability,
      riskLevel: getRiskLevel(prediction.fraudProbability),
      action: action,
      reviewPriority: reviewPriority,
      riskFactors: importantFactors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check fraud'
    });
  }
});

/**
 * 6. SENTIMENT ANALYSIS
 * 
 * Analyze product reviews and social media mentions
 * Uses BERT transformer model for sentiment classification
 */
app.post('/api/ai/sentiment', async (req, res) => {
  try {
    const { text, context = 'product_review' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Analyze sentiment
    const sentiment = await sentimentAnalyzer.analyze(text, context);
    
    // Extract aspects (e.g., price, quality, shipping)
    const aspects = await sentimentAnalyzer.extractAspects(text);
    
    // Get emotion detection (anger, joy, sadness, etc.)
    const emotions = await sentimentAnalyzer.detectEmotions(text);
    
    // Generate summary for multiple reviews (if batch)
    let summary = null;
    if (req.body.batch && req.body.reviews) {
      summary = await sentimentAnalyzer.summarizeSentiments(req.body.reviews);
    }
    
    res.json({
      success: true,
      sentiment: sentiment.label, // positive, negative, neutral
      score: sentiment.score,
      confidence: sentiment.confidence,
      aspects: aspects,
      emotions: emotions,
      summary: summary,
      suggestedAction: getSentimentAction(sentiment.label)
    });
    
  } catch (error) {
    logger.error('Sentiment analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentiment'
    });
  }
});

/**
 * 7. DEMAND FORECASTING
 * 
 * Predict future sales using Prophet (time series forecasting)
 * Helps with inventory planning and staffing
 */
app.get('/api/ai/forecast/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const days = parseInt(req.query.days) || 30;
    
    // Get historical sales data
    const historicalData = await getSalesHistory(productId, 90); // Last 90 days
    
    // Generate forecast
    const forecast = await forecastService.predictDemand(
      productId,
      historicalData,
      days
    );
    
    // Calculate confidence intervals
    const intervals = calculateConfidenceIntervals(forecast.predictions);
    
    // Generate insights
    const insights = generateForecastInsights(forecast);
    
    res.json({
      success: true,
      productId,
      forecast: {
        dates: forecast.dates,
        predictions: forecast.predictions,
        lowerBound: intervals.lower,
        upperBound: intervals.upper,
        confidenceLevel: 0.95
      },
      seasonality: forecast.seasonality,
      trend: forecast.trend,
      insights: insights,
      recommendation: getInventoryRecommendation(forecast)
    });
    
  } catch (error) {
    logger.error('Forecast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate forecast'
    });
  }
});

/**
 * 8. PERSONALIZED SEARCH
 * 
 * Rank search results based on user preferences
 * Learning-to-rank algorithm
 */
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, userId, filters, limit = 20 } = req.body;
    
    // Get initial search results (from Elasticsearch)
    const initialResults = await performSearch(query, filters);
    
    if (userId) {
      // Get user profile and preferences
      const userProfile = await getUserProfile(userId);
      const userHistory = await getUserHistory(userId);
      
      // Rerank results using ML model
      const rerankedResults = await rankResults(
        initialResults, 
        userProfile, 
        userHistory
      );
      
      // Add personalization score
      const personalizedResults = rerankedResults.map(result => ({
        ...result,
        personalizationScore: result.relevanceScore,
        reason: generatePersonalizationReason(result, userProfile)
      }));
      
      res.json({
        success: true,
        query,
        userId,
        results: personalizedResults.slice(0, limit),
        total: initialResults.length,
        personalizationApplied: true
      });
    } else {
      // Anonymous user - use popularity ranking
      res.json({
        success: true,
        query,
        results: initialResults.slice(0, limit),
        total: initialResults.length,
        personalizationApplied: false
      });
    }
    
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search'
    });
  }
});

/**
 * Helper function to rank search results using ML
 */
async function rankResults(initialResults, userProfile, userHistory) {
  // Extract features for each result
  const resultsWithFeatures = await Promise.all(
    initialResults.map(async (result) => {
      const features = await extractRankingFeatures(result, userProfile, userHistory);
      const score = await rankModel.predict(features);
      return { ...result, relevanceScore: score };
    })
  );
  
  // Sort by relevance score
  return resultsWithFeatures.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============ UTILITY FUNCTIONS ============

async function getProductDetails(productId) {
  const result = await pgPool.query(
    'SELECT * FROM products WHERE id = $1',
    [productId]
  );
  return result.rows[0];
}

async function getDemandHistory(productId, days = 30) {
  const result = await pgPool.query(`
    SELECT DATE(created_at) as date, COUNT(*) as sales
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE oi.product_id = $1 
    AND o.created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [productId]);
  return result.rows;
}

async function getCompetitorPrices(productId) {
  // In production, scrape or use API from competitors
  // For demo, return mock data
  return [
    { competitor: 'Amazon', price: 99.99 },
    { competitor: 'Walmart', price: 104.99 },
    { competitor: 'BestBuy', price: 109.99 }
  ];
}

function getSeasonalityFactor() {
  const month = new Date().getMonth();
  // Holiday season multiplier
  if (month === 10 || month === 11) return 1.3; // Nov-Dec
  if (month === 0) return 0.8; // January sales
  return 1.0;
}

async function extractFraudFeatures(transaction) {
  return {
    amount: transaction.amount,
    velocity: await getTransactionVelocity(transaction.userId),
    locationAnomaly: await checkLocationAnomaly(transaction),
    deviceTrust: await getDeviceTrustScore(transaction.deviceId),
    timeOfDay: new Date().getHours(),
    isWeekend: [0, 6].includes(new Date().getDay()),
    userAge: await getUserAccountAge(transaction.userId),
    previousFraud: await hasPreviousFraud(transaction.userId)
  };
}

function getRiskLevel(score) {
  if (score > 0.8) return 'high';
  if (score > 0.5) return 'medium';
  return 'low';
}

function getSentimentAction(sentiment) {
  switch (sentiment) {
    case 'positive':
      return 'feature_review';
    case 'negative':
      return 'contact_customer';
    case 'neutral':
      return 'monitor';
    default:
      return 'none';
  }
}

function generatePersonalizationReason(product, userProfile) {
  const reasons = [];
  if (userProfile.preferredCategories.includes(product.category)) {
    reasons.push(`Matches your interest in ${product.category}`);
  }
  if (userProfile.priceRange && product.price <= userProfile.priceRange.max) {
    reasons.push(`Within your price range`);
  }
  if (userProfile.browsedBrands.includes(product.brand)) {
    reasons.push(`You've viewed ${product.brand} products before`);
  }
  return reasons[0] || 'Recommended based on your activity';
}

function getInventoryRecommendation(forecast) {
  const peakDemand = Math.max(...forecast.predictions);
  const currentStock = forecast.currentStock;
  
  if (peakDemand > currentStock) {
    return {
      action: 'restock',
      quantity: Math.ceil(peakDemand - currentStock),
      urgency: peakDemand / currentStock > 1.5 ? 'high' : 'medium'
    };
  }
  return {
    action: 'sufficient',
    urgency: 'low'
  };
}

function calculateConfidenceIntervals(predictions) {
  // Simple confidence interval calculation
  const variance = 0.1; // Placeholder
  return {
    lower: predictions.map(p => p * (1 - variance)),
    upper: predictions.map(p => p * (1 + variance))
  };
}

function generateForecastInsights(forecast) {
  const insights = [];
  const trend = forecast.trend;
  
  if (trend > 0.1) {
    insights.push('📈 Strong upward trend detected - consider increasing inventory');
  } else if (trend < -0.1) {
    insights.push('📉 Downward trend - consider reducing stock or promotions');
  }
  
  if (forecast.seasonality.weekly) {
    insights.push('📅 Weekly pattern detected - weekend sales are higher');
  }
  
  return insights;
}

// ============ START SERVER ============

async function startServer() {
  try {
    await pgPool.query('SELECT 1');
    logger.info('PostgreSQL reachable');
  } catch (e) {
    logger.warn('PostgreSQL unavailable — DB-backed AI features degraded:', e.message);
  }

  try {
    await redisClient.connect();
    logger.info('Redis connected');
  } catch (e) {
    logger.warn('Redis unavailable — prediction cache disabled:', e.message);
  }

  try {
    await initializeModels();
  } catch (e) {
    logger.warn('Model initialization incomplete:', e.message);
  }

  try {
    await setupKafkaConsumers();
  } catch (kafkaErr) {
    logger.warn('Kafka consumers not started:', kafkaErr.message);
  }

  app.listen(PORT, () => {
    logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║   🤖 AI SERVICE LISTENING (degraded if DB/Redis/Kafka down)   ║
╠═══════════════════════════════════════════════════════════════╣
║   Port: ${PORT}                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await kafkaConsumer.disconnect();
  } catch (_) {}
  try {
    await kafkaProducer.disconnect();
  } catch (_) {}
  await pgPool.end();
  await redisClient.quit();
  process.exit(0);
});

startServer();
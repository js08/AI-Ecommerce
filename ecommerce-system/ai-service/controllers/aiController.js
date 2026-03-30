/**
 * aiController.js - Handles HTTP requests for AI features
 * Routes requests to appropriate services
 */

const { logger } = require('../utils/logger');

class AIController {
  constructor(services) {
    this.recommendationService = services.recommendation;
    this.fraudDetectionService = services.fraudDetection;
    this.priceOptimizationService = services.priceOptimization;
    this.sentimentService = services.sentiment;
    this.forecastService = services.forecast;
    this.visualSearchService = services.visualSearch;
    this.chatbotService = services.chatbot;
  }

  /**
   * Get product recommendations
   */
  async getRecommendations(req, res) {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit) || 10;
      const type = req.query.type || 'personalized';
      
      let recommendations;
      
      switch (type) {
        case 'personalized':
          recommendations = await this.recommendationService.getPersonalizedRecommendations(userId, limit);
          break;
        case 'similar':
          const productId = parseInt(req.query.productId);
          recommendations = await this.recommendationService.getSimilarProducts(productId, limit);
          break;
        case 'trending':
          recommendations = await this.recommendationService.getTrendingProducts(limit);
          break;
        default:
          recommendations = [];
      }
      
      res.json({
        success: true,
        userId,
        type,
        recommendations,
        count: recommendations.length
      });
      
    } catch (error) {
      logger.error('Recommendation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate recommendations',
        message: error.message
      });
    }
  }

  /**
   * Detect fraud for transaction
   */
  async detectFraud(req, res) {
    try {
      const transaction = req.body;
      const result = await this.fraudDetectionService.detectFraud(transaction);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('Fraud detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect fraud',
        message: error.message
      });
    }
  }

  /**
   * Calculate optimal price
   */
  async calculateOptimalPrice(req, res) {
    try {
      const productId = parseInt(req.params.productId);
      const customerSegment = req.query.segment || 'standard';
      
      // Get product data
      const product = await this.getProductData(productId);
      const demandHistory = await this.getDemandHistory(productId);
      const competitorPrices = await this.getCompetitorPrices(productId);
      
      const result = await this.priceOptimizationService.calculateOptimalPrice({
        productId,
        currentPrice: product.price,
        cost: product.cost,
        inventory: product.inventory,
        demandHistory,
        competitorPrices,
        seasonality: this.getSeasonalityFactor(),
        customerSegment,
        targetMargin: req.query.targetMargin
      });
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('Price optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate optimal price',
        message: error.message
      });
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(req, res) {
    try {
      const { text, context, batch } = req.body;
      
      if (batch && Array.isArray(batch)) {
        // Batch processing
        const results = [];
        for (const item of batch) {
          const analysis = await this.sentimentService.analyzeSentiment(item.text, item.context);
          results.push(analysis);
        }
        
        res.json({
          success: true,
          batch: true,
          count: results.length,
          results
        });
        
      } else if (text) {
        // Single text analysis
        const result = await this.sentimentService.analyzeSentiment(text, context);
        
        res.json({
          success: true,
          ...result
        });
        
      } else {
        res.status(400).json({
          success: false,
          error: 'Text or batch required'
        });
      }
      
    } catch (error) {
      logger.error('Sentiment analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze sentiment',
        message: error.message
      });
    }
  }

  /**
   * Get demand forecast
   */
  async getForecast(req, res) {
    try {
      const productId = parseInt(req.params.productId);
      const days = parseInt(req.query.days) || 30;
      
      const historicalData = await this.getSalesHistory(productId, 90);
      const forecast = await this.forecastService.predictDemand(productId, historicalData, days);
      
      // Get current stock for recommendations
      const product = await this.getProductData(productId);
      const inventoryRecommendation = this.forecastService.generateInventoryRecommendation(
        forecast,
        product.inventory
      );
      
      res.json({
        success: true,
        productId,
        forecast,
        inventoryRecommendation
      });
      
    } catch (error) {
      logger.error('Forecast error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate forecast',
        message: error.message
      });
    }
  }

  /**
   * Visual search
   */
  async visualSearch(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image uploaded'
        });
      }
      
      const limit = parseInt(req.query.limit) || 10;
      
      // Extract features from image
      const features = await this.visualSearchService.extractFeatures(req.file.buffer);
      
      // Find similar products
      const results = await this.visualSearchService.findSimilarProducts(features, limit);
      
      res.json({
        success: true,
        results,
        count: results.length,
        processingTime: `${Date.now() - req.startTime}ms`
      });
      
    } catch (error) {
      logger.error('Visual search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process image',
        message: error.message
      });
    }
  }

  /**
   * Chatbot interaction
   */
  async chat(req, res) {
    try {
      const { message, userId, sessionId, context } = req.body;
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message required'
        });
      }
      
      const response = await this.chatbotService.processMessage({
        message,
        userId,
        sessionId,
        context
      });
      
      res.json({
        success: true,
        ...response
      });
      
    } catch (error) {
      logger.error('Chatbot error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process message',
        message: error.message
      });
    }
  }

  /**
   * Personalized search
   */
  async personalizedSearch(req, res) {
    try {
      const { query, userId, filters, limit = 20 } = req.body;
      
      // Get initial search results (this would call Elasticsearch)
      const initialResults = await this.searchProducts(query, filters);
      
      if (userId) {
        // Get user profile and preferences
        const userProfile = await this.getUserProfile(userId);
        const userHistory = await this.getUserHistory(userId);
        
        // Rerank results
        const rerankedResults = await this.rankResults(initialResults, userProfile, userHistory);
        
        res.json({
          success: true,
          query,
          userId,
          results: rerankedResults.slice(0, limit),
          personalized: true
        });
        
      } else {
        res.json({
          success: true,
          query,
          results: initialResults.slice(0, limit),
          personalized: false
        });
      }
      
    } catch (error) {
      logger.error('Search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform search',
        message: error.message
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        recommendation: !!this.recommendationService,
        fraud: !!this.fraudDetectionService,
        price: !!this.priceOptimizationService,
        sentiment: !!this.sentimentService,
        forecast: !!this.forecastService,
        visualSearch: !!this.visualSearchService,
        chatbot: !!this.chatbotService
      }
    });
  }

  // ============ Helper methods (would call other services) ============

  async getProductData(productId) {
    // In production, call product service
    return {
      id: productId,
      price: 99.99,
      cost: 45.00,
      inventory: 500
    };
  }

  async getDemandHistory(productId) {
    // Fetch from database
    return [];
  }

  async getCompetitorPrices(productId) {
    // Fetch from competitor API or scraping
    return [];
  }

  async getSalesHistory(productId, days) {
    // Fetch from order service
    return [];
  }

  getSeasonalityFactor() {
    const month = new Date().getMonth();
    if (month === 10 || month === 11) return 1.3; // Nov-Dec
    if (month === 0) return 0.8; // January
    return 1.0;
  }

  async searchProducts(query, filters) {
    // Call Elasticsearch
    return [];
  }

  async getUserProfile(userId) {
    // Call user service
    return {};
  }

  async getUserHistory(userId) {
    // Fetch user interaction history
    return [];
  }

  async rankResults(results, profile, history) {
    // Rank results using ML model
    return results;
  }
}

module.exports = { AIController };
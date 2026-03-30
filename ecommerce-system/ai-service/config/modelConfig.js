/**
 * modelConfig.js - Configuration for AI models
 * Centralizes model parameters, paths, and settings
 */

const path = require('path');

module.exports = {
  // Model paths
  modelPaths: {
    recommendation: path.join(__dirname, '../../models-data/recommendation-model'),
    fraud: path.join(__dirname, '../../models-data/fraud-model'),
    visual: path.join(__dirname, '../../models-data/visual-model'),
    sentiment: path.join(__dirname, '../../models-data/sentiment-model'),
    priceOptimization: path.join(__dirname, '../../models-data/price-model')
  },
  
  // Model versions
  modelVersions: {
    recommendation: '2.0.0',
    fraud: '3.0.0',
    visual: '1.5.0',
    sentiment: '2.1.0',
    priceOptimization: '1.0.0'
  },
  
  // Embedding dimensions
  embeddingDimensions: {
    product: 512,
    user: 256,
    image: 512,
    text: 384
  },
  
  // Recommendation engine config
  recommendationConfig: {
    numFactors: 50,           // Matrix factorization factors
    learningRate: 0.001,      // SGD learning rate
    regularization: 0.01,     // Regularization parameter
    iterations: 100,          // Training iterations
    batchSize: 256,           // Training batch size
    topK: 10                  // Number of recommendations
  },
  
  // Fraud detection config
  fraudDetectionConfig: {
    thresholds: {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    },
    features: [
      'amount',
      'velocity',
      'location_anomaly',
      'device_fingerprint',
      'time_of_day',
      'account_age',
      'ip_reputation',
      'card_velocity'
    ],
    modelType: 'ensemble',    // ensemble, xgboost, neural
    updateFrequency: 'daily'   // Model update frequency
  },
  
  // Price optimization config
  priceOptimizationConfig: {
    elasticityWindow: 30,      // Days of data for elasticity
    maxPriceChange: 0.2,       // Max 20% price change
    competitorWeight: 0.3,     // Weight for competitor prices
    inventoryWeight: 0.2,      // Weight for inventory levels
    seasonalityWeight: 0.15,   // Weight for seasonality
    minMargin: 0.1,            // Minimum 10% margin
    priceRounding: 0.99        // Round to .99
  },
  
  // Sentiment analysis config
  sentimentConfig: {
    modelName: 'distilbert-base-uncased-finetuned-sst-2-english',
    maxLength: 512,            // Max tokens for BERT
    batchSize: 32,             // Batch size for processing
    aspectKeywords: {
      price: ['price', 'cost', 'expensive', 'cheap'],
      quality: ['quality', 'durable', 'well-made'],
      shipping: ['shipping', 'delivery', 'arrived'],
      service: ['customer service', 'support', 'return']
    }
  },
  
  // Visual search config
  visualSearchConfig: {
    modelName: 'resnet50',
    inputSize: 224,            // Input image size
    featureDimension: 512,     // Output feature dimension
    imageFormats: ['jpeg', 'png', 'webp'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    thumbnailSizes: {
      small: 150,
      medium: 300,
      large: 600
    }
  },
  
  // Forecast config
  forecastConfig: {
    modelType: 'prophet',      // prophet, arima, lstm
    seasonality: ['daily', 'weekly', 'yearly'],
    forecastDays: 30,          // Default forecast horizon
    confidenceInterval: 0.95,  // 95% confidence
    minDataPoints: 30,         // Minimum data for forecasting
    updateFrequency: 'weekly'  // Model update frequency
  },
  
  // Chatbot config
  chatbotConfig: {
    modelName: 'gpt-3.5-turbo',
    maxTokens: 150,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5,
    maxHistoryMessages: 10
  },
  
  // Cache configuration
  cacheConfig: {
    recommendationTTL: 300,    // 5 minutes
    fraudTTL: 3600,            // 1 hour
    priceTTL: 1800,            // 30 minutes
    sentimentTTL: 86400,       // 24 hours
    forecastTTL: 3600          // 1 hour
  },
  
  // Training config
  trainingConfig: {
    autoRetrain: true,
    retrainSchedule: 'weekly',  // weekly, daily, monthly
    minTrainingData: 1000,      // Minimum samples for training
    validationSplit: 0.2,       // 20% validation data
    earlyStopping: true,
    earlyStoppingPatience: 5
  },
  
  // Model serving config
  servingConfig: {
    batchSize: 32,
    maxConcurrent: 10,
    timeout: 5000,              // 5 seconds
    fallbackToRules: true       // Use rules if model fails
  },
  
  // Monitoring config
  monitoringConfig: {
    metricsEnabled: true,
    logPredictions: false,      // Don't log predictions in production
    sampleRate: 0.1,            // Log 10% of predictions
    alertThreshold: {
      latency: 1000,            // Alert if >1s
      errorRate: 0.05           // Alert if >5% errors
    }
  }
};
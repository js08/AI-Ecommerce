/**
 * forecastService.js - Time series forecasting for demand prediction
 * 
 * Uses statistical methods (moving average, exponential smoothing, linear regression)
 * instead of Prophet (which requires Python)
 * 
 * Features:
 * - Seasonal decomposition
 * - Trend analysis
 * - Moving average forecasts
 * - Exponential smoothing
 * - Confidence intervals
 */

const { logger } = require('../utils/logger');
const simpleStatistics = require('simple-statistics');

class ForecastService {
  constructor(pgPool) {
    this.db = pgPool;
    this.models = new Map(); // Cache trained models per product
    this.version = '2.0.0';
  }

  /**
   * Initialize forecasting service
   */
  async initialize() {
    logger.info('Initializing forecast service');
    await this.loadModels();
  }

  /**
   * Load pre-trained models from database
   */
  async loadModels() {
    try {
      // Load saved models from database
      const result = await this.db.query(`
        SELECT product_id, model_params, version, trained_at 
        FROM forecast_models 
        WHERE version = $1
      `, [this.version]);
      
      for (const row of result.rows) {
        this.models.set(row.product_id, {
          params: row.model_params,
          version: row.version,
          trainedAt: row.trained_at
        });
      }
      
      logger.info(`Loaded ${this.models.size} forecast models`);
      
    } catch (error) {
      logger.warn('No existing forecast models found, will train on-demand');
    }
  }

  /**
   * Predict demand for a product
   * @param {number} productId - Product ID
   * @param {Array} historicalData - Historical sales data
   * @param {number} days - Number of days to forecast
   */
  async predictDemand(productId, historicalData, days = 30) {
    logger.info(`Forecasting demand for product ${productId} for ${days} days`);

    // Check if we have a cached model
    let model = this.models.get(productId);
    
    if (!model || this.isModelStale(model)) {
      // Train new model if none exists or model is stale
      model = await this.trainModel(productId, historicalData);
      this.models.set(productId, {
        ...model,
        trainedAt: new Date()
      });
    }

    // Generate forecast
    const forecast = await this.generateForecast(model, historicalData, days);
    
    // Calculate seasonality components
    const seasonality = this.extractSeasonality(historicalData);
    
    // Detect trend
    const trend = this.calculateTrend(forecast.predictions);
    
    return {
      dates: forecast.dates,
      predictions: forecast.predictions,
      lowerBound: forecast.lowerBound,
      upperBound: forecast.upperBound,
      seasonality: seasonality,
      trend: trend,
      confidence: 0.95,
      modelVersion: model.version
    };
  }

  /**
   * Train forecasting model on historical data
   */
  async trainModel(productId, historicalData) {
    logger.info(`Training forecast model for product ${productId} with ${historicalData.length} data points`);
    
    if (!historicalData || historicalData.length < 7) {
      logger.warn(`Insufficient data for product ${productId}, using default model`);
      return this.createDefaultModel();
    }
    
    // Extract values
    const values = historicalData.map(d => d.sales || d.demand || d.quantity || 0);
    const dates = historicalData.map(d => d.date);
    
    // Calculate trend using linear regression
    const x = values.map((_, i) => i);
    const trendLine = simpleStatistics.linearRegression(x, values);
    
    // Calculate seasonality (daily/weekly patterns)
    const seasonality = this.calculateSeasonalPatterns(values);
    
    // Calculate moving average for smoothing
    const movingAverage = this.calculateMovingAverage(values, 7);
    
    // Calculate forecast error
    const errors = this.calculateForecastErrors(values, trendLine, seasonality);
    const errorStd = simpleStatistics.sampleStandardDeviation(errors);
    
    return {
      version: this.version,
      trend: {
        slope: trendLine.m,
        intercept: trendLine.b,
        predict: (x) => trendLine.m * x + trendLine.b
      },
      seasonality: seasonality,
      movingAverage: movingAverage,
      errorStd: errorStd,
      trainingDataLength: values.length,
      lastTrainingDate: new Date()
    };
  }

  /**
   * Create default model when insufficient data
   */
  createDefaultModel() {
    return {
      version: this.version,
      trend: {
        slope: 0,
        intercept: 10,
        predict: () => 10
      },
      seasonality: {
        daily: new Array(7).fill(0),
        weekly: new Array(7).fill(0)
      },
      errorStd: 2,
      trainingDataLength: 0,
      lastTrainingDate: new Date()
    };
  }

  /**
   * Calculate seasonal patterns from historical data
   */
  calculateSeasonalPatterns(values) {
    const n = values.length;
    const dailyPattern = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);
    
    // Group by day of week (assuming data is daily)
    for (let i = 0; i < n; i++) {
      const dayOfWeek = i % 7;
      dailyPattern[dayOfWeek] += values[i];
      dailyCounts[dayOfWeek]++;
    }
    
    // Average the patterns
    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyPattern[i] /= dailyCounts[i];
      }
    }
    
    // Normalize to zero mean
    const mean = simpleStatistics.mean(dailyPattern);
    const normalizedPattern = dailyPattern.map(v => v - mean);
    
    return {
      daily: normalizedPattern,
      weekly: normalizedPattern, // Simplified for now
      predict: (t) => normalizedPattern[t % 7]
    };
  }

  /**
   * Calculate moving average for smoothing
   */
  calculateMovingAverage(values, windowSize) {
    const movingAvg = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = simpleStatistics.mean(window);
      movingAvg.push(avg);
    }
    
    return movingAvg;
  }

  /**
   * Calculate forecast errors for model validation
   */
  calculateForecastErrors(values, trendLine, seasonality) {
    const errors = [];
    
    for (let i = 0; i < values.length; i++) {
      const trendValue = trendLine.predict(i);
      const seasonalValue = seasonality.predict(i);
      const predicted = trendValue + seasonalValue;
      const error = values[i] - predicted;
      errors.push(error);
    }
    
    return errors;
  }

  /**
   * Generate forecast for future dates
   */
  async generateForecast(model, historicalData, days) {
    const dates = [];
    const predictions = [];
    const lowerBound = [];
    const upperBound = [];
    
    const lastDate = model.lastTrainingDate || new Date();
    const lastValue = historicalData[historicalData.length - 1]?.sales || 0;
    
    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(lastDate.getDate() + i);
      dates.push(forecastDate.toISOString().split('T')[0]);
      
      // Predict using trend + seasonality
      const t = model.trainingDataLength + i;
      const trendValue = model.trend.predict(t);
      const seasonalValue = model.seasonality.predict(t);
      
      let prediction = trendValue + seasonalValue;
      prediction = Math.max(0, Math.round(prediction));
      
      predictions.push(prediction);
      
      // Calculate confidence intervals (95% confidence)
      const errorMargin = model.errorStd * 1.96;
      lowerBound.push(Math.max(0, Math.round(prediction - errorMargin)));
      upperBound.push(Math.round(prediction + errorMargin));
    }
    
    return {
      dates,
      predictions,
      lowerBound,
      upperBound
    };
  }

  /**
   * Extract seasonality patterns from historical data
   */
  extractSeasonality(historicalData) {
    if (!historicalData || historicalData.length < 14) {
      return {
        weekly: new Array(7).fill(0),
        description: 'Insufficient data for seasonality detection'
      };
    }
    
    const values = historicalData.map(d => d.sales || d.demand || 0);
    const weeklyPattern = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);
    
    for (let i = 0; i < values.length; i++) {
      const dayOfWeek = i % 7;
      weeklyPattern[dayOfWeek] += values[i];
      weeklyCounts[dayOfWeek]++;
    }
    
    for (let i = 0; i < 7; i++) {
      if (weeklyCounts[i] > 0) {
        weeklyPattern[i] /= weeklyCounts[i];
      }
    }
    
    const maxDay = weeklyPattern.indexOf(Math.max(...weeklyPattern));
    const minDay = weeklyPattern.indexOf(Math.min(...weeklyPattern));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      weekly: weeklyPattern,
      description: `Highest sales on ${days[maxDay]}, lowest on ${days[minDay]}`,
      maxDay: days[maxDay],
      minDay: days[minDay]
    };
  }

  /**
   * Calculate trend direction and strength
   */
  calculateTrend(predictions) {
    if (predictions.length < 2) {
      return { direction: 'stable', strength: 0 };
    }
    
    const first = predictions[0];
    const last = predictions[predictions.length - 1];
    const change = first === 0 ? 0 : ((last - first) / first) * 100;
    
    let direction = 'stable';
    if (change > 5) direction = 'increasing';
    if (change < -5) direction = 'decreasing';
    
    const strength = Math.min(Math.abs(change) / 20, 1);
    
    return {
      direction,
      strength,
      percentageChange: change.toFixed(1),
      description: `Sales are ${direction} with ${Math.abs(change).toFixed(1)}% change`
    };
  }

  /**
   * Check if model is stale (older than 7 days)
   */
  isModelStale(model) {
    if (!model || !model.trainedAt) return true;
    const daysSinceTrain = (new Date() - model.trainedAt) / (1000 * 60 * 60 * 24);
    return daysSinceTrain > 7;
  }

  /**
   * Detect anomalies in recent sales
   */
  async detectAnomalies(productId, recentSales) {
    const historicalData = await this.getHistoricalData(productId, 30);
    const forecast = await this.predictDemand(productId, historicalData, 7);
    const expected = forecast.predictions;
    
    const anomalies = [];
    
    for (let i = 0; i < Math.min(recentSales.length, expected.length); i++) {
      const actual = recentSales[i];
      const expectedLow = forecast.lowerBound[i];
      const expectedHigh = forecast.upperBound[i];
      
      if (actual < expectedLow || actual > expectedHigh) {
        anomalies.push({
          date: forecast.dates[i],
          actual: actual,
          expected: expected[i],
          lowerBound: expectedLow,
          upperBound: expectedHigh,
          deviation: ((actual - expected[i]) / expected[i] * 100).toFixed(1),
          severity: Math.min(Math.abs(actual - expected[i]) / expected[i], 1)
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Get historical data from database
   */
  async getHistoricalData(productId, days = 90) {
    try {
      const result = await this.db.query(`
        SELECT 
          DATE(o.created_at) as date,
          SUM(oi.quantity) as sales
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.product_id = $1 
        AND o.created_at > NOW() - INTERVAL '${days} days'
        GROUP BY DATE(o.created_at)
        ORDER BY date
      `, [productId]);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get historical data:', error);
      return [];
    }
  }

  /**
   * Generate inventory recommendations based on forecast
   */
  generateInventoryRecommendation(forecast, currentStock, leadTimeDays = 7) {
    const maxDemand = Math.max(...forecast.predictions);
    const safetyStock = maxDemand * 1.2; // 20% safety buffer
    const reorderPoint = maxDemand * leadTimeDays;
    
    let action = 'sufficient';
    let orderQuantity = 0;
    let urgency = 'low';
    
    if (currentStock < reorderPoint) {
      action = 'restock';
      orderQuantity = Math.ceil(safetyStock - currentStock);
      urgency = 'high';
    } else if (currentStock < safetyStock) {
      action = 'restock_soon';
      orderQuantity = Math.ceil(safetyStock - currentStock);
      urgency = 'medium';
    }
    
    return {
      action: action,
      orderQuantity: orderQuantity,
      reorderPoint: Math.ceil(reorderPoint),
      safetyStock: Math.ceil(safetyStock),
      recommendedDate: new Date(Date.now() + leadTimeDays * 24 * 60 * 60 * 1000),
      reasoning: `Peak forecasted demand: ${Math.ceil(maxDemand)} units. ` +
                 `Current stock: ${currentStock}. ${action === 'restock' ? 'Immediate reorder recommended.' : 'Stock levels adequate.'}`,
      urgency: urgency
    };
  }

  /**
   * Save trained model to database
   */
  async saveModel(productId, model) {
    try {
      await this.db.query(`
        INSERT INTO forecast_models (product_id, model_params, version, trained_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (product_id, version) 
        DO UPDATE SET model_params = EXCLUDED.model_params, trained_at = EXCLUDED.trained_at
      `, [productId, JSON.stringify(model), model.version, new Date()]);
      
      logger.info(`Saved forecast model for product ${productId}`);
      
    } catch (error) {
      logger.error('Failed to save model:', error);
    }
  }
}

module.exports = { ForecastService };
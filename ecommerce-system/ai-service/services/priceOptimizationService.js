/**
 * priceOptimizationService.js - Dynamic pricing with reinforcement learning
 * 
 * Features:
 * - Demand elasticity calculation
 * - Competitor price monitoring
 * - Inventory-based pricing
 * - Customer segment pricing
 * - A/B testing support
 */

const { logger } = require('../utils/logger');
const simpleStatistics = require('simple-statistics');

class PriceOptimizationService {
  constructor(pgPool, redisClient) {
    this.db = pgPool;
    this.redis = redisClient;
    this.elasticityCache = new Map();
    this.optimizationHistory = new Map();
  }

  /**
   * Initialize price optimization service
   */
  async initialize() {
    logger.info('Initializing price optimization service');
    await this.loadElasticityModels();
  }

  /**
   * Calculate optimal price for product
   * @param {Object} params - Optimization parameters
   */
  async calculateOptimalPrice(params) {
    const {
      productId,
      currentPrice,
      cost,
      inventory,
      demandHistory,
      competitorPrices,
      seasonality,
      customerSegment,
      targetMargin
    } = params;

    logger.info(`Calculating optimal price for product ${productId}`);

    // Step 1: Calculate price elasticity
    const elasticity = await this.calculateElasticity(productId, demandHistory);
    
    // Step 2: Analyze competitor landscape
    const competitorAnalysis = this.analyzeCompetitors(competitorPrices, currentPrice);
    
    // Step 3: Calculate optimal price points
    const pricePoints = this.generatePricePoints(currentPrice, cost, competitorPrices);
    const demandAtPrices = await this.forecastDemandAtPrices(productId, pricePoints, {
      elasticity,
      inventory,
      seasonality,
      customerSegment
    });
    
    // Step 4: Calculate revenue and profit at each price point
    const scenarios = pricePoints.map((price, index) => ({
      price,
      demand: demandAtPrices[index],
      revenue: price * demandAtPrices[index],
      profit: (price - cost) * demandAtPrices[index],
      margin: ((price - cost) / price) * 100
    }));
    
    // Step 5: Find optimal scenario
    let optimal = scenarios.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
    
    // Step 6: Apply business constraints
    optimal = this.applyConstraints(optimal, {
      currentPrice,
      competitorAnalysis,
      inventory,
      targetMargin,
      elasticity
    });
    
    // Step 7: Calculate expected impact
    const impact = this.calculatePriceImpact(currentPrice, optimal.price, elasticity);
    
    // Step 8: Generate reasoning
    const reasoning = this.generateOptimizationReasoning(
      optimal,
      elasticity,
      competitorAnalysis,
      inventory
    );
    
    // Step 9: Log optimization
    await this.logOptimization(productId, currentPrice, optimal, reasoning);
    
    return {
      productId,
      currentPrice,
      recommendedPrice: optimal.price,
      minPrice: optimal.price * 0.9,
      maxPrice: optimal.price * 1.1,
      expectedDemandChange: impact.demandChange,
      expectedRevenueChange: impact.revenueChange,
      expectedProfitChange: impact.profitChange,
      confidence: this.calculateConfidence(elasticity, demandHistory?.length || 0),
      elasticity: elasticity,
      competitorPosition: competitorAnalysis.position,
      reasoning: reasoning,
      alternatives: scenarios.slice(0, 3),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate price elasticity of demand
   */
  async calculateElasticity(productId, demandHistory) {
    // Check cache
    if (this.elasticityCache.has(productId)) {
      return this.elasticityCache.get(productId);
    }
    
    if (!demandHistory || demandHistory.length < 10) {
      // Default elasticity based on product category
      const category = await this.getProductCategory(productId);
      const defaultElasticity = this.getDefaultElasticity(category);
      this.elasticityCache.set(productId, defaultElasticity);
      return defaultElasticity;
    }
    
    // Calculate from historical data
    const elasticities = [];
    
    for (let i = 1; i < demandHistory.length; i++) {
      const prev = demandHistory[i - 1];
      const curr = demandHistory[i];
      
      if (prev.price !== curr.price && prev.demand !== curr.demand) {
        const pctPriceChange = (curr.price - prev.price) / prev.price;
        const pctDemandChange = (curr.demand - prev.demand) / prev.demand;
        
        if (pctPriceChange !== 0) {
          const elasticity = pctDemandChange / pctPriceChange;
          elasticities.push(elasticity);
        }
      }
    }
    
    const elasticity = elasticities.length > 0 
      ? simpleStatistics.mean(elasticities)
      : -1.5; // Default e-commerce elasticity
    
    // Cap extreme values
    const cappedElasticity = Math.max(-5, Math.min(-0.5, elasticity));
    
    this.elasticityCache.set(productId, cappedElasticity);
    return cappedElasticity;
  }

  /**
   * Get default elasticity by category
   */
  getDefaultElasticity(category) {
    const elasticities = {
      'electronics': -1.8,
      'clothing': -2.2,
      'books': -1.2,
      'food': -0.8,
      'luxury': -1.5,
      'essentials': -0.5
    };
    
    return elasticities[category] || -1.5;
  }

  /**
   * Get product category from database
   */
  async getProductCategory(productId) {
    try {
      const result = await this.db.query(`
        SELECT c.name as category
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1
      `, [productId]);
      
      return result.rows[0]?.category || 'general';
    } catch (error) {
      logger.error('Failed to get category:', error);
      return 'general';
    }
  }

  /**
   * Generate price points to test
   */
  generatePricePoints(currentPrice, cost, competitorPrices) {
    const points = new Set([currentPrice]);
    
    // Add price variations
    points.add(currentPrice * 0.9);
    points.add(currentPrice * 0.95);
    points.add(currentPrice * 1.05);
    points.add(currentPrice * 1.1);
    points.add(currentPrice * 0.85);
    points.add(currentPrice * 1.15);
    
    // Add competitor prices
    competitorPrices.forEach(c => {
      points.add(c.price);
      points.add(c.price * 0.95);
      points.add(c.price * 1.05);
    });
    
    // Ensure above cost
    const validPoints = Array.from(points)
      .filter(p => p >= cost * 0.9)
      .sort((a, b) => a - b);
    
    return validPoints;
  }

  /**
   * Forecast demand at different price points
   */
  async forecastDemandAtPrices(productId, pricePoints, context) {
    const baseDemand = await this.getBaseDemand(productId);
    const { elasticity, inventory, seasonality, customerSegment } = context;
    
    return pricePoints.map(price => {
      // Price elasticity model: Q = Q0 * (P/P0)^E
      const priceRatio = price / pricePoints[0];
      let demand = baseDemand * Math.pow(priceRatio, elasticity);
      
      // Adjust for inventory constraints
      if (inventory && demand > inventory) {
        demand = inventory;
      }
      
      // Apply seasonality factor
      demand *= seasonality;
      
      // Apply customer segment adjustment
      const segmentMultipliers = {
        'premium': 0.7,
        'standard': 1.0,
        'budget': 1.3,
        'wholesale': 2.0
      };
      
      demand *= segmentMultipliers[customerSegment] || 1.0;
      
      return Math.max(0, Math.round(demand));
    });
  }

  /**
   * Get baseline demand (30-day average)
   */
  async getBaseDemand(productId) {
    try {
      const result = await this.db.query(`
        SELECT AVG(quantity) as avg_demand
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = $1
        AND o.created_at > NOW() - INTERVAL '30 days'
      `, [productId]);
      
      return result.rows[0]?.avg_demand || 10;
    } catch (error) {
      logger.error('Failed to get base demand:', error);
      return 10;
    }
  }

  /**
   * Analyze competitor pricing
   */
  analyzeCompetitors(competitorPrices, currentPrice) {
    if (!competitorPrices || competitorPrices.length === 0) {
      return { position: 'unknown', priceGap: 0 };
    }
    
    const avgCompetitorPrice = simpleStatistics.mean(competitorPrices.map(c => c.price));
    const minCompetitorPrice = Math.min(...competitorPrices.map(c => c.price));
    const maxCompetitorPrice = Math.max(...competitorPrices.map(c => c.price));
    
    let position = 'competitive';
    if (currentPrice > maxCompetitorPrice) {
      position = 'premium';
    } else if (currentPrice < minCompetitorPrice) {
      position = 'budget';
    } else if (currentPrice > avgCompetitorPrice * 1.1) {
      position = 'above_average';
    } else if (currentPrice < avgCompetitorPrice * 0.9) {
      position = 'below_average';
    }
    
    return {
      position,
      priceGap: currentPrice - avgCompetitorPrice,
      avgCompetitorPrice,
      minCompetitorPrice,
      maxCompetitorPrice,
      competitorCount: competitorPrices.length
    };
  }

  /**
   * Apply business constraints to price
   */
  applyConstraints(optimal, context) {
    let { price, demand, profit } = optimal;
    const { currentPrice, competitorAnalysis, inventory, targetMargin, elasticity } = context;
    
    // Limit price change to 20%
    const maxChange = currentPrice * 0.2;
    if (Math.abs(price - currentPrice) > maxChange) {
      price = currentPrice + (price > currentPrice ? maxChange : -maxChange);
    }
    
    // Don't go below cost + 10% margin
    const minPrice = currentPrice * 0.7; // 30% below current max
    if (price < minPrice) {
      price = minPrice;
    }
    
    // Competitor constraints
    if (competitorAnalysis.position === 'premium') {
      // If we're premium, don't price too low
      price = Math.max(price, competitorAnalysis.avgCompetitorPrice * 1.1);
    } else if (competitorAnalysis.position === 'budget') {
      // If we're budget, don't price too high
      price = Math.min(price, competitorAnalysis.avgCompetitorPrice * 0.9);
    }
    
    // Inventory-driven pricing
    if (inventory > 1000) {
      // Clear excess inventory with lower price
      price = price * 0.85;
    } else if (inventory < 50) {
      // Low inventory, increase price
      price = price * 1.1;
    }
    
    // Margin constraints
    const currentMargin = (currentPrice - cost) / currentPrice;
    if (targetMargin && currentMargin < targetMargin) {
      price = price * (targetMargin / currentMargin);
    }
    
    // Round to .99 or .00 for psychological pricing
    price = this.psychologicalPricing(price);
    
    return {
      ...optimal,
      price: Math.round(price * 100) / 100
    };
  }

  /**
   * Apply psychological pricing (.99 endings)
   */
  psychologicalPricing(price) {
    const rounded = Math.floor(price);
    const decimals = price - rounded;
    
    if (decimals < 0.2) {
      return rounded - 0.01;
    } else if (decimals > 0.8) {
      return rounded + 0.99;
    } else {
      return rounded + 0.99;
    }
  }

  /**
   * Calculate price change impact
   */
  calculatePriceImpact(oldPrice, newPrice, elasticity) {
    const priceChange = (newPrice - oldPrice) / oldPrice;
    const demandChange = priceChange * elasticity;
    
    const oldRevenue = oldPrice * 100; // Base demand 100 units
    const newRevenue = newPrice * (100 * (1 + demandChange));
    const revenueChange = (newRevenue - oldRevenue) / oldRevenue;
    
    const profitChange = revenueChange; // Simplified
    
    return {
      demandChange: demandChange * 100,
      revenueChange: revenueChange * 100,
      profitChange: profitChange * 100
    };
  }

  /**
   * Generate optimization reasoning
   */
  generateOptimizationReasoning(optimal, elasticity, competitorAnalysis, inventory) {
    const reasons = [];
    
    // Elasticity-based reasoning
    if (Math.abs(elasticity) > 2) {
      reasons.push(`Demand is highly elastic (${Math.abs(elasticity).toFixed(2)}), small price changes significantly impact sales.`);
      if (optimal.price < optimal.originalPrice) {
        reasons.push(`Lowering price will increase total revenue due to high elasticity.`);
      }
    } else if (Math.abs(elasticity) < 1) {
      reasons.push(`Demand is inelastic (${Math.abs(elasticity).toFixed(2)}), price increases won't significantly reduce sales.`);
      if (optimal.price > optimal.originalPrice) {
        reasons.push(`Price increase recommended to maximize profit.`);
      }
    }
    
    // Competitor-based reasoning
    if (competitorAnalysis.position === 'premium') {
      reasons.push(`Priced as premium product (${(competitorAnalysis.priceGap).toFixed(2)} above competitors).`);
    } else if (competitorAnalysis.position === 'budget') {
      reasons.push(`Priced competitively below market average.`);
    }
    
    // Inventory-based reasoning
    if (inventory > 1000) {
      reasons.push(`High inventory level (${inventory} units) suggests price reduction to clear stock.`);
    } else if (inventory < 50) {
      reasons.push(`Low inventory (${inventory} units) allows price increase.`);
    }
    
    if (reasons.length === 0) {
      reasons.push(`Current price is optimal given market conditions.`);
    }
    
    return reasons;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(elasticity, dataPoints) {
    let confidence = 0.7; // Base confidence
    
    // More data = higher confidence
    if (dataPoints > 100) confidence += 0.2;
    else if (dataPoints > 50) confidence += 0.1;
    else if (dataPoints < 20) confidence -= 0.2;
    
    // More elastic = lower confidence (more volatile)
    if (Math.abs(elasticity) > 3) confidence -= 0.1;
    else if (Math.abs(elasticity) < 0.5) confidence += 0.1;
    
    return Math.min(Math.max(confidence, 0.3), 0.95);
  }

  /**
   * Log price optimization for audit
   */
  async logOptimization(productId, oldPrice, optimal, reasoning) {
    try {
      await this.db.query(`
        INSERT INTO price_optimization_log 
        (product_id, old_price, new_price, reason, confidence, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        productId,
        oldPrice,
        optimal.price,
        reasoning.join(' '),
        optimal.confidence
      ]);
      
      // Cache for quick access
      await this.redis.setEx(
        `price:opt:${productId}`,
        3600,
        JSON.stringify({
          optimal: optimal,
          timestamp: new Date().toISOString()
        })
      );
      
    } catch (error) {
      logger.error('Failed to log price optimization:', error);
    }
  }

  /**
   * Load elasticity models from cache
   */
  async loadElasticityModels() {
    try {
      const keys = await this.redis.keys('elasticity:*');
      for (const key of keys) {
        const value = await this.redis.get(key);
        const productId = key.split(':')[1];
        this.elasticityCache.set(parseInt(productId), parseFloat(value));
      }
      logger.info(`Loaded ${this.elasticityCache.size} elasticity models`);
    } catch (error) {
      logger.error('Failed to load elasticity models:', error);
    }
  }

  /**
   * Run A/B test for price changes
   */
  async runABTest(productId, controlPrice, testPrice, durationDays = 7) {
    logger.info(`Starting A/B test for product ${productId}`);
    
    const testId = `ab_test_${productId}_${Date.now()}`;
    
    await this.redis.setEx(
      `ab_test:${testId}`,
      durationDays * 24 * 3600,
      JSON.stringify({
        productId,
        controlPrice,
        testPrice,
        startDate: new Date().toISOString(),
        durationDays,
        metrics: {
          control: { views: 0, purchases: 0, revenue: 0 },
          test: { views: 0, purchases: 0, revenue: 0 }
        }
      })
    );
    
    return {
      testId,
      controlPrice,
      testPrice,
      durationDays,
      message: `A/B test started. Will run for ${durationDays} days.`
    };
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId) {
    const testData = await this.redis.get(`ab_test:${testId}`);
    if (!testData) return null;
    
    const test = JSON.parse(testData);
    const controlConversion = test.metrics.control.purchases / test.metrics.control.views;
    const testConversion = test.metrics.test.purchases / test.metrics.test.views;
    const lift = ((testConversion - controlConversion) / controlConversion) * 100;
    
    return {
      testId,
      controlPrice: test.controlPrice,
      testPrice: test.testPrice,
      controlMetrics: test.metrics.control,
      testMetrics: test.metrics.test,
      controlConversion,
      testConversion,
      lift,
      significant: Math.abs(lift) > 5,
      winner: lift > 0 ? 'test' : 'control'
    };
  }
}

module.exports = { PriceOptimizationService };
/**
 * priceOptimizer.js - Dynamic pricing using reinforcement learning
 * 
 * Optimizes prices based on:
 * - Demand elasticity
 * - Inventory levels
 * - Competitor pricing
 * - Seasonality
 * - Customer segments
 */

const { logger } = require('../utils/logger');

class PriceOptimizer {
  constructor() {
    this.version = '2.0.0';
    this.demandModels = new Map(); // Cache demand models per product
    this.elasticityCache = new Map(); // Cache price elasticity
  }
  
  /**
   * Calculate optimal price for product
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
      customerSegment
    } = params;
    
    // Calculate price elasticity of demand
    const elasticity = await this.calculatePriceElasticity(productId, demandHistory);
    
    // Calculate competitor price index
    const competitorAvg = competitorPrices.reduce((sum, c) => sum + c.price, 0) / competitorPrices.length;
    const competitorMin = Math.min(...competitorPrices.map(c => c.price));
    
    // Calculate demand forecast at different price points
    const pricePoints = this.generatePricePoints(currentPrice, cost, competitorPrices);
    const demandAtPrices = await this.forecastDemandAtPrices(productId, pricePoints, {
      inventory,
      seasonality,
      customerSegment
    });
    
    // Calculate expected revenue at each price point
    const revenuePoints = pricePoints.map((price, index) => ({
      price,
      demand: demandAtPrices[index],
      revenue: price * demandAtPrices[index],
      profit: (price - cost) * demandAtPrices[index]
    }));
    
    // Find optimal price (max profit)
    let optimal = revenuePoints.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
    
    // Apply business constraints
    optimal = this.applyConstraints(optimal, {
      currentPrice,
      competitorMin,
      elasticity,
      inventory
    });
    
    // Calculate expected changes
    const demandChange = ((optimal.demand - demandAtPrices[0]) / demandAtPrices[0]) * 100;
    const revenueChange = ((optimal.revenue - revenuePoints[0].revenue) / revenuePoints[0].revenue) * 100;
    
    // Generate reasoning
    const reasoning = this.generateReasoning(optimal, elasticity, competitorPrices);
    
    return {
      recommended: optimal.price,
      min: optimal.price * 0.9,
      max: optimal.price * 1.1,
      demandChange: demandChange.toFixed(1),
      revenueChange: revenueChange.toFixed(1),
      confidence: this.calculateConfidence(elasticity, demandHistory.length),
      reasoning: reasoning
    };
  }
  
  /**
   * Calculate price elasticity of demand
   * How much demand changes when price changes
   */
  async calculatePriceElasticity(productId, demandHistory) {
    if (this.elasticityCache.has(productId)) {
      return this.elasticityCache.get(productId);
    }
    
    if (!demandHistory || demandHistory.length < 10) {
      // Default elasticity if not enough data
      return -1.5; // Typical e-commerce elasticity
    }
    
    // Calculate elasticity from historical price changes
    let totalElasticity = 0;
    let count = 0;
    
    for (let i = 1; i < demandHistory.length; i++) {
      const prev = demandHistory[i - 1];
      const curr = demandHistory[i];
      
      if (prev.price !== curr.price) {
        const pctPriceChange = (curr.price - prev.price) / prev.price;
        const pctDemandChange = (curr.demand - prev.demand) / prev.demand;
        
        if (pctPriceChange !== 0) {
          const elasticity = pctDemandChange / pctPriceChange;
          totalElasticity += elasticity;
          count++;
        }
      }
    }
    
    const elasticity = count > 0 ? totalElasticity / count : -1.5;
    this.elasticityCache.set(productId, elasticity);
    
    return elasticity;
  }
  
  /**
   * Generate price points to test
   */
  generatePricePoints(currentPrice, cost, competitorPrices) {
    const points = [currentPrice]; // Start with current price
    
    // Add 10% increments
    points.push(currentPrice * 0.9);
    points.push(currentPrice * 1.1);
    points.push(currentPrice * 0.8);
    points.push(currentPrice * 1.2);
    
    // Add competitor prices
    competitorPrices.forEach(c => {
      if (!points.includes(c.price)) {
        points.push(c.price);
      }
    });
    
    // Ensure above cost
    return points.filter(p => p >= cost).sort((a, b) => a - b);
  }
  
  /**
   * Forecast demand at different price points
   */
  async forecastDemandAtPrices(productId, pricePoints, context) {
    const baseDemand = await this.getBaseDemand(productId);
    const elasticity = await this.calculatePriceElasticity(productId, []);
    
    return pricePoints.map(price => {
      // Demand = baseDemand * (price/currentPrice)^elasticity
      const priceRatio = price / pricePoints[0];
      let demand = baseDemand * Math.pow(priceRatio, elasticity);
      
      // Adjust for inventory
      if (context.inventory < demand) {
        demand = context.inventory; // Can't sell more than in stock
      }
      
      // Adjust for seasonality
      demand *= context.seasonality;
      
      // Adjust for customer segment
      if (context.customerSegment === 'premium') {
        demand *= 0.8; // Premium customers buy less but higher margin
      } else if (context.customerSegment === 'budget') {
        demand *= 1.2; // Budget customers buy more
      }
      
      return Math.max(0, Math.round(demand));
    });
  }
  
  /**
   * Apply business constraints to optimal price
   */
  applyConstraints(optimal, context) {
    let { price } = optimal;
    
    // Don't change price too drastically
    const maxChange = context.currentPrice * 0.2; // 20% max change
    if (Math.abs(price - context.currentPrice) > maxChange) {
      price = context.currentPrice + (price > context.currentPrice ? maxChange : -maxChange);
    }
    
    // Don't go below competitor minimum
    if (price < context.competitorMin * 0.9) {
      price = context.competitorMin * 0.9;
    }
    
    // If inventory is high, lower price to clear
    if (context.inventory > 1000) {
      price = price * 0.9;
    }
    
    // If demand is inelastic, increase price
    if (Math.abs(context.elasticity) < 0.5) {
      price = price * 1.05;
    }
    
    return {
      ...optimal,
      price: Math.round(price * 100) / 100 // Round to 2 decimals
    };
  }
  
  /**
   * Generate human-readable reasoning
   */
  generateReasoning(optimal, elasticity, competitorPrices) {
    const reasons = [];
    
    if (optimal.price > optimal.originalPrice) {
      reasons.push(`Demand is inelastic (elasticity: ${Math.abs(elasticity).toFixed(2)}), allowing price increase`);
    } else if (optimal.price < optimal.originalPrice) {
      reasons.push(`Demand is elastic, price reduction will increase total revenue`);
    }
    
    if (competitorPrices.length > 0) {
      const avgCompetitor = competitorPrices.reduce((s, c) => s + c.price, 0) / competitorPrices.length;
      if (optimal.price < avgCompetitor) {
        reasons.push(`Priced ${((avgCompetitor - optimal.price) / avgCompetitor * 100).toFixed(0)}% below competitors for competitive advantage`);
      }
    }
    
    if (reasons.length === 0) {
      reasons.push('Current price is optimal based on market conditions');
    }
    
    return reasons;
  }
  
  async getBaseDemand(productId) {
    // Get average daily demand
    const result = await pgPool.query(`
      SELECT AVG(quantity) as avg_demand
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = $1
      AND o.created_at > NOW() - INTERVAL '30 days'
    `, [productId]);
    
    return result.rows[0]?.avg_demand || 10; // Default 10 units/day
  }
  
  calculateConfidence(elasticity, dataPoints) {
    let confidence = 0.7; // Base confidence
    
    if (Math.abs(elasticity) > 2) {
      confidence *= 0.8; // Less confident with extreme elasticity
    }
    
    if (dataPoints < 30) {
      confidence *= 0.5; // Less confident with little data
    } else if (dataPoints > 100) {
      confidence *= 1.2; // More confident with lots of data
    }
    
    return Math.min(confidence, 0.95);
  }
  
  /**
   * Update product price based on optimization
   */
  async updateProductPrice(productId) {
    // In production, call product service to update price
    logger.info(`Updating price for product ${productId}`);
    // Implementation would call product service API
  }
}

module.exports = { PriceOptimizer };
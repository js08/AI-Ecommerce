/**
 * fraudDetectionService.js - Real-time fraud detection
 * 
 * Features:
 * - Rule-based detection
 * - Machine learning scoring
 * - Device fingerprinting
 * - Behavioral analysis
 * - Network analysis
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

class FraudDetectionService {
  constructor(pgPool, redisClient) {
    this.db = pgPool;
    this.redis = redisClient;
    this.rules = [];
    this.model = null;
    this.thresholds = {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    };
  }

  /**
   * Initialize fraud detection service
   */
  async initialize() {
    logger.info('Initializing fraud detection service');
    await this.loadRules();
    await this.loadModel();
  }

  /**
   * Load fraud detection rules from database
   */
  async loadRules() {
    this.rules = [
      {
        id: 'high_amount',
        name: 'Unusually High Amount',
        condition: (tx) => tx.amount > 10000,
        weight: 0.25,
        description: 'Transaction amount exceeds normal threshold'
      },
      {
        id: 'velocity',
        name: 'High Transaction Velocity',
        condition: (tx, context) => context.transactionsPerHour > 5,
        weight: 0.2,
        description: 'Multiple transactions in short period'
      },
      {
        id: 'new_device',
        name: 'New Device',
        condition: (tx, context) => !context.knownDevices.includes(tx.deviceId),
        weight: 0.15,
        description: 'Transaction from unrecognized device'
      },
      {
        id: 'location_mismatch',
        name: 'Location Mismatch',
        condition: (tx, context) => context.normalLocation !== tx.location,
        weight: 0.2,
        description: 'Transaction from unusual location'
      },
      {
        id: 'unusual_time',
        name: 'Unusual Time',
        condition: (tx) => {
          const hour = new Date().getHours();
          return hour < 5 || hour > 23;
        },
        weight: 0.1,
        description: 'Transaction at unusual hour'
      },
      {
        id: 'new_account',
        name: 'New Account',
        condition: (tx, context) => context.accountAgeDays < 1,
        weight: 0.15,
        description: 'Account created less than 24 hours ago'
      },
      {
        id: 'ip_anomaly',
        name: 'IP Anomaly',
        condition: (tx, context) => context.suspiciousIP === true,
        weight: 0.2,
        description: 'Transaction from suspicious IP address'
      },
      {
        id: 'card_velocity',
        name: 'Card Velocity',
        condition: (tx, context) => context.transactionsPerCard > 3,
        weight: 0.25,
        description: 'Multiple transactions with same card'
      },
      {
        id: 'shipping_mismatch',
        name: 'Shipping Address Mismatch',
        condition: (tx, context) => tx.billingAddress !== tx.shippingAddress,
        weight: 0.1,
        description: 'Billing and shipping addresses differ'
      }
    ];
    
    logger.info(`Loaded ${this.rules.length} fraud detection rules`);
  }

  /**
   * Load ML model for fraud detection
   */
  async loadModel() {
    // In production, load from file or S3
    this.model = {
      version: '1.0.0',
      predict: async (features) => {
        // Simplified model for demo
        // In production, use actual ML model (XGBoost, Random Forest, etc.)
        let score = 0;
        
        if (features.amount > 10000) score += 0.3;
        if (features.velocity > 5) score += 0.25;
        if (features.locationAnomaly) score += 0.2;
        if (features.newDevice) score += 0.15;
        if (features.unusualTime) score += 0.1;
        
        return Math.min(score, 0.95);
      }
    };
  }

  /**
   * Detect fraud for a transaction
   * @param {Object} transaction - Transaction details
   * @returns {Object} Fraud detection result
   */
  async detectFraud(transaction) {
    logger.info(`Detecting fraud for transaction ${transaction.transactionId}`);
    
    // Step 1: Gather context data
    const context = await this.gatherContext(transaction);
    
    // Step 2: Apply rule-based detection
    const ruleResults = await this.applyRules(transaction, context);
    
    // Step 3: Extract ML features
    const features = this.extractFeatures(transaction, context, ruleResults);
    
    // Step 4: Get ML score
    const mlScore = await this.model.predict(features);
    
    // Step 5: Combine scores
    const ruleScore = this.calculateRuleScore(ruleResults);
    const fraudScore = (ruleScore * 0.6) + (mlScore * 0.4);
    
    // Step 6: Determine action
    const action = this.determineAction(fraudScore);
    
    // Step 7: Generate explanation
    const explanation = this.generateExplanation(ruleResults, mlScore, fraudScore);
    
    // Step 8: Log detection
    await this.logDetection(transaction, fraudScore, ruleResults, action);
    
    return {
      transactionId: transaction.transactionId,
      fraudScore: fraudScore,
      riskLevel: this.getRiskLevel(fraudScore),
      action: action,
      ruleResults: ruleResults,
      mlScore: mlScore,
      explanation: explanation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gather context data for fraud detection
   */
  async gatherContext(transaction) {
    const context = {
      knownDevices: [],
      normalLocation: null,
      accountAgeDays: 0,
      transactionsPerHour: 0,
      transactionsPerCard: 0,
      suspiciousIP: false
    };
    
    try {
      // Get user's known devices
      const devices = await this.db.query(`
        SELECT device_id FROM user_devices 
        WHERE user_id = $1 AND trusted = true
      `, [transaction.userId]);
      
      context.knownDevices = devices.rows.map(d => d.device_id);
      
      // Get user's normal location (most frequent)
      const locationResult = await this.db.query(`
        SELECT location, COUNT(*) as count
        FROM transactions
        WHERE user_id = $1
        GROUP BY location
        ORDER BY count DESC
        LIMIT 1
      `, [transaction.userId]);
      
      if (locationResult.rows.length > 0) {
        context.normalLocation = locationResult.rows[0].location;
      }
      
      // Get account age
      const userResult = await this.db.query(`
        SELECT EXTRACT(DAY FROM NOW() - created_at) as age_days
        FROM users WHERE id = $1
      `, [transaction.userId]);
      
      if (userResult.rows.length > 0) {
        context.accountAgeDays = parseFloat(userResult.rows[0].age_days);
      }
      
      // Get transaction velocity (last hour)
      const velocityResult = await this.db.query(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [transaction.userId]);
      
      context.transactionsPerHour = parseInt(velocityResult.rows[0].count);
      
      // Check IP reputation (simplified)
      context.suspiciousIP = await this.checkIPReputation(transaction.ip);
      
    } catch (error) {
      logger.error('Failed to gather context:', error);
    }
    
    return context;
  }

  /**
   * Apply all fraud detection rules
   */
  async applyRules(transaction, context) {
    const results = [];
    
    for (const rule of this.rules) {
      try {
        const triggered = rule.condition(transaction, context);
        
        results.push({
          ruleId: rule.id,
          name: rule.name,
          triggered: triggered,
          weight: rule.weight,
          description: rule.description
        });
        
      } catch (error) {
        logger.error(`Rule ${rule.id} execution failed:`, error);
        results.push({
          ruleId: rule.id,
          name: rule.name,
          triggered: false,
          weight: rule.weight,
          error: true
        });
      }
    }
    
    return results;
  }

  /**
   * Extract features for ML model
   */
  extractFeatures(transaction, context, ruleResults) {
    return {
      amount: transaction.amount,
      velocity: context.transactionsPerHour,
      locationAnomaly: context.normalLocation && context.normalLocation !== transaction.location,
      newDevice: !context.knownDevices.includes(transaction.deviceId),
      unusualTime: new Date().getHours() < 5 || new Date().getHours() > 23,
      accountAge: context.accountAgeDays,
      suspiciousIP: context.suspiciousIP,
      rulesTriggered: ruleResults.filter(r => r.triggered).length,
      totalRulesWeight: ruleResults
        .filter(r => r.triggered)
        .reduce((sum, r) => sum + r.weight, 0)
    };
  }

  /**
   * Calculate overall rule-based score
   */
  calculateRuleScore(ruleResults) {
    const triggeredRules = ruleResults.filter(r => r.triggered);
    
    if (triggeredRules.length === 0) return 0;
    
    const totalWeight = triggeredRules.reduce((sum, r) => sum + r.weight, 0);
    const maxWeight = this.rules.reduce((sum, r) => sum + r.weight, 0);
    
    return Math.min(totalWeight / maxWeight, 0.95);
  }

  /**
   * Determine action based on fraud score
   */
  determineAction(fraudScore) {
    if (fraudScore > this.thresholds.high) {
      return 'reject';
    } else if (fraudScore > this.thresholds.medium) {
      return 'manual_review';
    } else if (fraudScore > this.thresholds.low) {
      return 'additional_verification';
    } else {
      return 'approve';
    }
  }

  /**
   * Get risk level string
   */
  getRiskLevel(score) {
    if (score > this.thresholds.high) return 'critical';
    if (score > this.thresholds.medium) return 'high';
    if (score > this.thresholds.low) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable explanation
   */
  generateExplanation(ruleResults, mlScore, fraudScore) {
    const triggeredRules = ruleResults.filter(r => r.triggered);
    
    if (triggeredRules.length === 0) {
      return 'Transaction appears normal based on all checks.';
    }
    
    const explanations = triggeredRules.map(rule => rule.description);
    const severity = this.getRiskLevel(fraudScore);
    
    return `Transaction flagged for: ${explanations.join(', ')}. ` +
           `Risk level: ${severity.toUpperCase()}. ` +
           `Fraud score: ${(fraudScore * 100).toFixed(1)}%.`;
  }

  /**
   * Log fraud detection for audit and model training
   */
  async logDetection(transaction, fraudScore, ruleResults, action) {
    try {
      await this.db.query(`
        INSERT INTO fraud_alerts 
        (transaction_id, user_id, fraud_score, risk_factors, action_taken, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        transaction.transactionId,
        transaction.userId,
        fraudScore,
        JSON.stringify(ruleResults.filter(r => r.triggered)),
        action
      ]);
      
      // Cache in Redis for real-time access
      await this.redis.setEx(
        `fraud:${transaction.transactionId}`,
        3600,
        JSON.stringify({
          score: fraudScore,
          action: action,
          timestamp: new Date().toISOString()
        })
      );
      
    } catch (error) {
      logger.error('Failed to log fraud detection:', error);
    }
  }

  /**
   * Check IP reputation against known threat databases
   */
  async checkIPReputation(ip) {
    // In production, check against threat intelligence feeds
    // For demo, return false (not suspicious)
    
    const suspiciousIPs = [
      '185.130.5.253', // Known malicious IPs (example)
      '45.33.32.156'
    ];
    
    return suspiciousIPs.includes(ip);
  }

  /**
   * Generate device fingerprint from request data
   */
  generateDeviceFingerprint(userAgent, ip, acceptLanguage) {
    const fingerprintData = `${userAgent}|${ip}|${acceptLanguage}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Analyze transaction network for fraud rings
   */
  async analyzeNetwork(transactionId) {
    // In production, use graph database to detect fraud rings
    // This would find connections between transactions, devices, IPs, etc.
    
    try {
      const result = await this.db.query(`
        WITH RECURSIVE transaction_network AS (
          SELECT transaction_id, user_id, device_id, ip, 1 as depth
          FROM transactions
          WHERE transaction_id = $1
          
          UNION ALL
          
          SELECT t.transaction_id, t.user_id, t.device_id, t.ip, tn.depth + 1
          FROM transactions t
          INNER JOIN transaction_network tn ON 
            t.user_id = tn.user_id OR 
            t.device_id = tn.device_id OR 
            t.ip = tn.ip
          WHERE tn.depth < 5
        )
        SELECT * FROM transaction_network
      `, [transactionId]);
      
      return {
        connectedTransactions: result.rows.length,
        uniqueUsers: new Set(result.rows.map(r => r.user_id)).size,
        uniqueDevices: new Set(result.rows.map(r => r.device_id)).size,
        suspicious: result.rows.length > 10 // Threshold for suspicion
      };
      
    } catch (error) {
      logger.error('Network analysis failed:', error);
      return { suspicious: false };
    }
  }

  /**
   * Update model with confirmed fraud cases (online learning)
   */
  async updateModel(fraudCases) {
    logger.info(`Updating fraud model with ${fraudCases.length} new cases`);
    
    for (const fraudCase of fraudCases) {
      // Update rule weights based on feedback
      // In production, retrain ML model periodically
      
      await this.db.query(`
        UPDATE fraud_alerts 
        SET confirmed = true, confirmed_at = NOW()
        WHERE transaction_id = $1
      `, [fraudCase.transactionId]);
    }
    
    // Trigger model retraining if enough new cases
    if (fraudCases.length > 100) {
      await this.retrainModel();
    }
  }

  /**
   * Retrain ML model with new data
   */
  async retrainModel() {
    logger.info('Retraining fraud detection model...');
    // In production, this would:
    // 1. Fetch all labeled fraud data
    // 2. Train new model
    // 3. Validate model performance
    // 4. Deploy new model
  }
}

module.exports = { FraudDetectionService };
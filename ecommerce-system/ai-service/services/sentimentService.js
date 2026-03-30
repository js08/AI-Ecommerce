/**
 * sentimentService.js - Advanced sentiment analysis with aspect extraction
 * 
 * Features:
 * - Multi-language support
 * - Aspect-based sentiment
 * - Emotion detection
 * - Review summarization
 * - Trend analysis
 */

const { logger } = require('../utils/logger');
const natural = require('natural');
const compromise = require('compromise');

class SentimentService {
  constructor(pgPool, redisClient) {
    this.db = pgPool;
    this.redis = redisClient;
    this.tokenizer = new natural.WordTokenizer();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    this.aspectKeywords = null;
  }

  /**
   * Initialize sentiment service
   */
  async initialize() {
    logger.info('Initializing sentiment service');
    await this.loadAspectKeywords();
  }

  /**
   * Load aspect keywords for product review analysis
   */
  async loadAspectKeywords() {
    this.aspectKeywords = {
      price: ['price', 'cost', 'expensive', 'cheap', 'affordable', 'value', 'worth'],
      quality: ['quality', 'durable', 'well-made', 'cheaply made', 'sturdy', 'built'],
      shipping: ['shipping', 'delivery', 'arrived', 'package', 'packaging', 'shipment'],
      customerService: ['customer service', 'support', 'return', 'refund', 'help'],
      features: ['feature', 'function', 'works', 'doesn\'t work', 'broken', 'defect'],
      design: ['design', 'looks', 'appearance', 'style', 'color', 'beautiful'],
      size: ['size', 'fit', 'small', 'large', 'true to size', 'runs small'],
      battery: ['battery', 'charge', 'lasts', 'life', 'drain'],
      usability: ['easy', 'difficult', 'simple', 'complicated', 'user-friendly'],
      performance: ['performance', 'speed', 'fast', 'slow', 'lag'],
      packaging: ['packaging', 'box', 'wrapping', 'presentation']
    };
  }

  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @param {string} context - Context (product_review, customer_support, etc.)
   */
  async analyzeSentiment(text, context = 'general') {
    logger.info(`Analyzing sentiment for text (${context}): ${text.substring(0, 100)}...`);
    
    // Step 1: Get overall sentiment
    const overallSentiment = this.getOverallSentiment(text);
    
    // Step 2: Extract aspects
    const aspects = await this.extractAspects(text, context);
    
    // Step 3: Detect emotions
    const emotions = this.detectEmotions(text);
    
    // Step 4: Get intensity
    const intensity = this.calculateIntensity(text);
    
    // Step 5: Generate summary
    const summary = this.generateSentimentSummary(overallSentiment, aspects, emotions);
    
    // Step 6: Identify key phrases
    const keyPhrases = this.extractKeyPhrases(text);
    
    return {
      text: text,
      sentiment: overallSentiment.label,
      score: overallSentiment.score,
      confidence: overallSentiment.confidence,
      intensity: intensity,
      emotions: emotions,
      aspects: aspects,
      keyPhrases: keyPhrases,
      summary: summary,
      suggestedAction: this.getSuggestedAction(overallSentiment, aspects),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get overall sentiment using multiple methods
   */
  getOverallSentiment(text) {
    // Method 1: AFINN dictionary-based sentiment
    const tokens = this.tokenizer.tokenize(text);
    const afinnScore = this.sentimentAnalyzer.getSentiment(tokens);
    
    // Method 2: Simple polarity detection
    const polarityScore = this.detectPolarity(text);
    
    // Method 3: VADER-like intensity
    const vaderScore = this.vaderStyleScore(text);
    
    // Combine scores (weighted average)
    const combinedScore = (afinnScore * 0.4) + (polarityScore * 0.3) + (vaderScore * 0.3);
    
    // Determine label
    let label = 'neutral';
    if (combinedScore > 0.2) label = 'positive';
    if (combinedScore < -0.2) label = 'negative';
    
    // Calculate confidence based on score magnitude
    const confidence = Math.min(Math.abs(combinedScore), 0.95);
    
    return {
      label: label,
      score: combinedScore,
      confidence: confidence,
      methods: {
        afinn: afinnScore,
        polarity: polarityScore,
        vader: vaderScore
      }
    };
  }

  /**
   * Simple polarity detection using positive/negative word lists
   */
  detectPolarity(text) {
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'happy',
      'satisfied', 'impressed', 'recommend', 'best', 'fantastic', 'awesome'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'disappointed', 'hate', 'unhappy',
      'dissatisfied', 'worst', 'poor', 'useless', 'broken', 'defective'
    ];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    const total = positiveCount + negativeCount;
    if (total === 0) return 0;
    
    return (positiveCount - negativeCount) / total;
  }

  /**
   * VADER-style sentiment scoring
   */
  vaderStyleScore(text) {
    const intensifiers = {
      'very': 1.3,
      'extremely': 1.5,
      'really': 1.2,
      'absolutely': 1.4,
      'completely': 1.3
    };
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // Check for negations
    const negationWords = ['not', 'no', 'never', 'nothing'];
    const hasNegation = negationWords.some(word => lowerText.includes(word));
    
    // Get base sentiment from AFINN
    const tokens = this.tokenizer.tokenize(text);
    let baseScore = this.sentimentAnalyzer.getSentiment(tokens);
    
    // Apply intensifiers
    for (const [intensifier, multiplier] of Object.entries(intensifiers)) {
      if (lowerText.includes(intensifier)) {
        baseScore *= multiplier;
        break;
      }
    }
    
    // Apply negation (reverses sentiment)
    if (hasNegation) {
      baseScore = -baseScore;
    }
    
    // Apply diminishing returns
    score = Math.tanh(baseScore);
    
    return score;
  }

  /**
   * Extract aspects from text
   */
  async extractAspects(text, context) {
    const aspects = [];
    const lowerText = text.toLowerCase();
    
    for (const [aspect, keywords] of Object.entries(this.aspectKeywords)) {
      let matchedKeyword = null;
      let matchedSentence = null;
      
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          matchedKeyword = keyword;
          
          // Extract the sentence containing the keyword
          const sentences = text.split(/[.!?]+/);
          for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(keyword)) {
              matchedSentence = sentence.trim();
              break;
            }
          }
          break;
        }
      }
      
      if (matchedKeyword) {
        // Analyze sentiment for this aspect
        const aspectSentiment = this.getOverallSentiment(matchedSentence || matchedKeyword);
        
        aspects.push({
          category: aspect,
          keyword: matchedKeyword,
          text: matchedSentence,
          sentiment: aspectSentiment.label,
          score: aspectSentiment.score,
          confidence: aspectSentiment.confidence
        });
      }
    }
    
    return aspects;
  }

  /**
   * Detect emotions in text
   */
  detectEmotions(text) {
    const lowerText = text.toLowerCase();
    
    const emotionPatterns = {
      joy: ['happy', 'delighted', 'excited', 'thrilled', 'pleased', 'glad', 'love'],
      sadness: ['sad', 'disappointed', 'upset', 'unhappy', 'depressed', 'regret'],
      anger: ['angry', 'furious', 'annoyed', 'frustrated', 'mad', 'irritated'],
      fear: ['scared', 'worried', 'nervous', 'anxious', 'concerned', 'afraid'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected'],
      disgust: ['disgusted', 'terrible', 'awful', 'horrible', 'disappointed']
    };
    
    const emotions = {};
    let totalMatches = 0;
    
    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      let matches = 0;
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          matches++;
        }
      }
      emotions[emotion] = matches;
      totalMatches += matches;
    }
    
    // Normalize scores
    if (totalMatches > 0) {
      for (const emotion of Object.keys(emotions)) {
        emotions[emotion] = emotions[emotion] / totalMatches;
      }
    }
    
    // Find primary emotion
    let primary = null;
    let maxScore = 0;
    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxScore) {
        maxScore = score;
        primary = emotion;
      }
    }
    
    return {
      scores: emotions,
      primary: primary,
      intensity: maxScore
    };
  }

  /**
   * Calculate sentiment intensity
   */
  calculateIntensity(text) {
    const exclamationCount = (text.match(/!/g) || []).length;
    const upperCount = (text.match(/[A-Z]{3,}/g) || []).length;
    const emphasisWords = ['very', 'extremely', 'absolutely', 'completely', 'totally'];
    const emphasisCount = emphasisWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    let intensity = 0;
    intensity += Math.min(exclamationCount * 0.2, 0.4);
    intensity += Math.min(upperCount * 0.1, 0.2);
    intensity += Math.min(emphasisCount * 0.1, 0.2);
    
    return Math.min(intensity, 0.9);
  }

  /**
   * Extract key phrases from text
   */
  extractKeyPhrases(text) {
    const doc = compromise(text);
    const phrases = [];
    
    // Extract nouns and adjectives
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    
    // Combine into phrases
    for (let i = 0; i < Math.min(nouns.length, 5); i++) {
      if (adjectives[i]) {
        phrases.push(`${adjectives[i]} ${nouns[i]}`);
      } else {
        phrases.push(nouns[i]);
      }
    }
    
    return phrases.filter(p => p.length > 2);
  }

  /**
   * Generate sentiment summary
   */
  generateSentimentSummary(sentiment, aspects, emotions) {
    const summary = [];
    
    // Overall sentiment
    if (sentiment.label === 'positive') {
      summary.push(`Overall positive sentiment with ${(sentiment.score * 100).toFixed(0)}% positivity.`);
    } else if (sentiment.label === 'negative') {
      summary.push(`Overall negative sentiment with ${(Math.abs(sentiment.score) * 100).toFixed(0)}% negativity.`);
    } else {
      summary.push(`Neutral sentiment overall.`);
    }
    
    // Aspect summary
    if (aspects.length > 0) {
      const positiveAspects = aspects.filter(a => a.sentiment === 'positive');
      const negativeAspects = aspects.filter(a => a.sentiment === 'negative');
      
      if (positiveAspects.length > 0) {
        summary.push(`Positive feedback on: ${positiveAspects.map(a => a.category).join(', ')}.`);
      }
      if (negativeAspects.length > 0) {
        summary.push(`Negative feedback on: ${negativeAspects.map(a => a.category).join(', ')}.`);
      }
    }
    
    // Emotion summary
    if (emotions.primary && emotions.intensity > 0.3) {
      summary.push(`Strong ${emotions.primary} emotion detected.`);
    }
    
    return summary.join(' ');
  }

  /**
   * Get suggested action based on sentiment
   */
  getSuggestedAction(sentiment, aspects) {
    if (sentiment.label === 'positive') {
      const positiveAspects = aspects.filter(a => a.sentiment === 'positive');
      if (positiveAspects.length > 0) {
        return `Feature positive review highlighting ${positiveAspects[0].category}`;
      }
      return 'Share as testimonial';
    }
    
    if (sentiment.label === 'negative') {
      const negativeAspects = aspects.filter(a => a.sentiment === 'negative');
      if (negativeAspects.length > 0) {
        return `Contact customer regarding ${negativeAspects[0].category} issues`;
      }
      return 'Escalate to customer support';
    }
    
    return 'Monitor and respond appropriately';
  }

  /**
   * Analyze batch of reviews and generate trends
   */
  async analyzeReviewBatch(reviews, productId) {
    const results = [];
    let totalScore = 0;
    const aspectTotals = {};
    
    for (const review of reviews) {
      const analysis = await this.analyzeSentiment(review.text, 'product_review');
      results.push(analysis);
      totalScore += analysis.sentiment.score;
      
      // Aggregate aspect sentiments
      for (const aspect of analysis.aspects) {
        if (!aspectTotals[aspect.category]) {
          aspectTotals[aspect.category] = { total: 0, count: 0 };
        }
        aspectTotals[aspect.category].total += aspect.score;
        aspectTotals[aspect.category].count++;
      }
    }
    
    const averageScore = totalScore / reviews.length;
    const aspectAverages = {};
    for (const [category, data] of Object.entries(aspectTotals)) {
      aspectAverages[category] = data.total / data.count;
    }
    
    // Generate overall product sentiment
    const productSentiment = {
      label: averageScore > 0.2 ? 'positive' : averageScore < -0.2 ? 'negative' : 'neutral',
      score: averageScore,
      reviewCount: reviews.length,
      aspects: aspectAverages
    };
    
    // Store in database
    await this.storeSentimentAnalysis(productId, productSentiment, results);
    
    return {
      productId,
      productSentiment,
      reviews: results,
      topPositiveAspects: this.getTopAspects(aspectAverages, true),
      topNegativeAspects: this.getTopAspects(aspectAverages, false)
    };
  }

  /**
   * Get top aspects by sentiment
   */
  getTopAspects(aspectAverages, positive) {
    const filtered = Object.entries(aspectAverages)
      .filter(([_, score]) => positive ? score > 0 : score < 0)
      .sort((a, b) => positive ? b[1] - a[1] : a[1] - b[1]);
    
    return filtered.slice(0, 5).map(([category, score]) => ({
      category,
      score: Math.abs(score)
    }));
  }

  /**
   * Store sentiment analysis results
   */
  async storeSentimentAnalysis(productId, productSentiment, reviewAnalyses) {
    try {
      await this.db.query(`
        INSERT INTO sentiment_analysis 
        (entity_type, entity_id, sentiment_label, sentiment_score, aspects, review_count, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (entity_type, entity_id) 
        DO UPDATE SET 
          sentiment_label = EXCLUDED.sentiment_label,
          sentiment_score = EXCLUDED.sentiment_score,
          aspects = EXCLUDED.aspects,
          review_count = EXCLUDED.review_count,
          created_at = NOW()
      `, [
        'product',
        productId,
        productSentiment.label,
        productSentiment.score,
        JSON.stringify(productSentiment.aspects),
        reviewAnalyses.length
      ]);
      
      // Cache in Redis
      await this.redis.setEx(
        `sentiment:product:${productId}`,
        86400, // 24 hours
        JSON.stringify(productSentiment)
      );
      
    } catch (error) {
      logger.error('Failed to store sentiment analysis:', error);
    }
  }

  /**
   * Get sentiment trend over time
   */
  async getSentimentTrend(productId, days = 30) {
    try {
      const result = await this.db.query(`
        SELECT 
          DATE(created_at) as date,
          AVG(sentiment_score) as avg_score,
          COUNT(*) as review_count
        FROM sentiment_analysis
        WHERE entity_id = $1
        AND created_at > NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [productId]);
      
      const trend = result.rows.map(row => ({
        date: row.date,
        score: parseFloat(row.avg_score),
        count: parseInt(row.review_count)
      }));
      
      return {
        productId,
        trend,
        overall: simpleStatistics.mean(trend.map(t => t.score)),
        direction: this.calculateTrendDirection(trend)
      };
      
    } catch (error) {
      logger.error('Failed to get sentiment trend:', error);
      return null;
    }
  }

  /**
   * Calculate trend direction
   */
  calculateTrendDirection(trend) {
    if (trend.length < 2) return 'stable';
    
    const first = trend[0].score;
    const last = trend[trend.length - 1].score;
    const change = last - first;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }
}

module.exports = { SentimentService };
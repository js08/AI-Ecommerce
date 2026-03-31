/**
 * sentimentAnalyzer.js - BERT-based sentiment analysis
 * 
 * Uses transformer model for state-of-the-art sentiment detection
 * Can detect sentiment, emotions, and aspects
 */

const { logger } = require('../utils/logger');

let pipeline = null;
try {
  ({ pipeline } = require('@xenova/transformers'));
} catch {
  logger.warn('@xenova/transformers not installed; using rule-based sentiment only');
}

class SentimentAnalyzer {
  constructor() {
    this.sentimentPipeline = null;
    this.emotionPipeline = null;
    this.aspectExtractor = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize transformer pipelines
   */
  async initialize() {
    try {
      if (typeof pipeline === 'function') {
        this.sentimentPipeline = await pipeline('sentiment-analysis');
        this.emotionPipeline = await pipeline('text-classification',
          'j-hartmann/emotion-english-distilroberta-base');
      }
      this.aspectExtractor = new AspectExtractor();
      this.isInitialized = true;
      logger.info('Sentiment analyzer initialized');
    } catch (error) {
      logger.warn('Sentiment ML pipeline unavailable, using rules only:', error.message);
      this.aspectExtractor = new AspectExtractor();
      this.isInitialized = true;
    }
  }
  
  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @param {string} context - Context (product_review, customer_support, etc.)
   */
  async analyze(text, context = 'general') {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.sentimentPipeline) {
      const positive = /\b(good|great|excellent|love|amazing|perfect)\b/i.test(text);
      const negative = /\b(bad|terrible|awful|hate|worst|poor)\b/i.test(text);
      const label = positive && !negative ? 'positive' : negative ? 'negative' : 'neutral';
      return { label, score: label === 'neutral' ? 0.5 : 0.85, confidence: 0.6, raw: { ruleBased: true } };
    }

    const result = await this.sentimentPipeline(text);
    let adjustedScore = result[0].score;
    let adjustedLabel = result[0].label;
    if (context === 'product_review') {
      adjustedScore = this.adjustReviewSentiment(text, result[0]);
    }
    return {
      label: adjustedLabel.toLowerCase(),
      score: adjustedScore,
      confidence: adjustedScore,
      raw: result[0]
    };
  }
  
  /**
   * Extract aspects from text (e.g., price, quality, shipping)
   */
  async extractAspects(text) {
    const aspects = await this.aspectExtractor.extract(text);
    
    // Analyze sentiment for each aspect
    const aspectsWithSentiment = await Promise.all(
      aspects.map(async (aspect) => {
        const sentiment = await this.analyze(aspect.text);
        return {
          ...aspect,
          sentiment: sentiment.label,
          sentimentScore: sentiment.score
        };
      })
    );
    
    return aspectsWithSentiment;
  }
  
  /**
   * Detect emotions in text
   */
  async detectEmotions(text) {
    if (!this.emotionPipeline) {
      return { primary: 'neutral', score: 0.5, all: [] };
    }
    const result = await this.emotionPipeline(text);
    return {
      primary: result[0].label,
      score: result[0].score,
      all: result.map(r => ({ emotion: r.label, score: r.score }))
    };
  }
  
  /**
   * Summarize sentiments from multiple reviews
   */
  async summarizeSentiments(reviews) {
    const sentiments = await Promise.all(
      reviews.map(async (review) => {
        const sentiment = await this.analyze(review.text, 'product_review');
        return {
          ...review,
          sentiment: sentiment.label,
          score: sentiment.score
        };
      })
    );
    
    // Calculate statistics
    const positive = sentiments.filter(s => s.sentiment === 'positive').length;
    const negative = sentiments.filter(s => s.sentiment === 'negative').length;
    const neutral = sentiments.filter(s => s.sentiment === 'neutral').length;
    
    // Extract common themes
    const themes = await this.extractThemes(sentiments);
    
    return {
      total: sentiments.length,
      distribution: {
        positive: (positive / sentiments.length) * 100,
        negative: (negative / sentiments.length) * 100,
        neutral: (neutral / sentiments.length) * 100
      },
      averageScore: sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length,
      themes: themes,
      topPositive: sentiments.filter(s => s.sentiment === 'positive').slice(0, 3),
      topNegative: sentiments.filter(s => s.sentiment === 'negative').slice(0, 3)
    };
  }
  
  /**
   * Adjust sentiment score for product reviews
   */
  adjustReviewSentiment(text, result) {
    let score = result.score;
    
    // Boost score for strong words
    const strongPositive = ['amazing', 'excellent', 'perfect', 'love', 'best'];
    const strongNegative = ['terrible', 'awful', 'worst', 'hate', 'return'];
    
    const lowerText = text.toLowerCase();
    
    if (result.label === 'POSITIVE') {
      if (strongPositive.some(word => lowerText.includes(word))) {
        score = Math.min(score * 1.2, 0.99);
      }
    } else if (result.label === 'NEGATIVE') {
      if (strongNegative.some(word => lowerText.includes(word))) {
        score = Math.min(score * 1.2, 0.99);
      }
    }
    
    return score;
  }
  
  /**
   * Extract common themes from reviews
   */
  async extractThemes(reviews) {
    const themes = {};
    
    for (const review of reviews) {
      const aspects = await this.extractAspects(review.text);
      
      for (const aspect of aspects) {
        if (!themes[aspect.category]) {
          themes[aspect.category] = {
            positive: 0,
            negative: 0,
            neutral: 0,
            mentions: 0
          };
        }
        
        themes[aspect.category].mentions++;
        themes[aspect.category][aspect.sentiment]++;
      }
    }
    
    // Calculate sentiment ratio for each theme
    return Object.entries(themes).map(([category, data]) => ({
      category,
      mentions: data.mentions,
      positiveRatio: (data.positive / data.mentions) * 100,
      negativeRatio: (data.negative / data.mentions) * 100,
      sentiment: data.positive > data.negative ? 'positive' : 'negative'
    }));
  }
}

/**
 * Aspect extractor - identifies product aspects in text
 */
class AspectExtractor {
  constructor() {
    // Common product aspects
    this.aspectKeywords = {
      price: ['price', 'cost', 'expensive', 'cheap', 'affordable', 'value'],
      quality: ['quality', 'durable', 'well-made', 'cheaply made', 'sturdy'],
      shipping: ['shipping', 'delivery', 'arrived', 'package', 'packaging'],
      customerService: ['customer service', 'support', 'return', 'refund'],
      features: ['feature', 'function', 'works', 'doesn\'t work', 'broken'],
      design: ['design', 'looks', 'appearance', 'style', 'color'],
      size: ['size', 'fit', 'small', 'large', 'true to size'],
      battery: ['battery', 'charge', 'lasts', 'life']
    };
  }
  
  async extract(text) {
    const aspects = [];
    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.aspectKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          // Extract sentence containing the keyword
          const sentences = text.split(/[.!?]+/);
          const relevantSentence = sentences.find(s => 
            s.toLowerCase().includes(keyword)
          );
          
          if (relevantSentence) {
            aspects.push({
              category: category,
              text: relevantSentence.trim(),
              keyword: keyword
            });
            break; // Only add once per category
          }
        }
      }
    }
    
    return aspects;
  }
}

module.exports = { SentimentAnalyzer };
/**
 * recommendationModel.js - Neural Collaborative Filtering
 * 
 * Uses TensorFlow.js for deep learning recommendations
 * 
 * Algorithm: Neural Collaborative Filtering (NCF)
 * - User embedding layer
 * - Item embedding layer
 * - Multi-layer perceptron
 * - Output: probability of user-item interaction
 */

const tf = require('@tensorflow/tfjs-node');
const { logger } = require('../utils/logger');

class RecommendationEngine {
  constructor() {
    this.model = null;
    this.userEmbeddings = new Map();
    this.itemEmbeddings = new Map();
    this.version = '2.0.0';
    this.userInteractionHistory = new Map(); // Cache user interactions
  }
  
  /**
   * Load pre-trained model or create new one
   */
  static async load() {
    const engine = new RecommendationEngine();
    
    try {
      // Try to load saved model
      const modelPath = process.env.RECOMMENDATION_MODEL_PATH || './models-data/recommendation-model';
      engine.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      logger.info('Loaded pre-trained recommendation model');
      
      // Load embeddings
      await engine.loadEmbeddings();
      
    } catch (error) {
      logger.warn('No pre-trained model found, creating new model');
      engine.model = engine.createModel();
      await engine.initializeEmbeddings();
    }
    
    return engine;
  }
  
  /**
   * Create neural collaborative filtering model
   * 
   * Architecture:
   * - Input: User ID + Item ID
   * - User embedding: 32 dimensions
   * - Item embedding: 32 dimensions
   * - Concatenate -> Dense layers -> Output
   */
  createModel() {
    const numUsers = 100000; // Max users
    const numItems = 50000;  // Max products
    const embeddingDim = 32;  // Embedding dimension
    
    // Input layers
    const userInput = tf.input({ shape: [1], name: 'user_id' });
    const itemInput = tf.input({ shape: [1], name: 'item_id' });
    
    // User embedding layer (learned representation of users)
    const userEmbedding = tf.layers.embedding({
      inputDim: numUsers,
      outputDim: embeddingDim,
      name: 'user_embedding'
    }).apply(userInput);
    
    // Item embedding layer (learned representation of items)
    const itemEmbedding = tf.layers.embedding({
      inputDim: numItems,
      outputDim: embeddingDim,
      name: 'item_embedding'
    }).apply(itemInput);
    
    // Flatten embeddings
    const userFlat = tf.layers.flatten().apply(userEmbedding);
    const itemFlat = tf.layers.flatten().apply(itemEmbedding);
    
    // Concatenate user and item embeddings
    let concat = tf.layers.concatenate().apply([userFlat, itemFlat]);
    
    // Deep neural network layers
    concat = tf.layers.dense({
      units: 128,
      activation: 'relu',
      name: 'dense_1'
    }).apply(concat);
    
    concat = tf.layers.dropout({ rate: 0.2 }).apply(concat);
    
    concat = tf.layers.dense({
      units: 64,
      activation: 'relu',
      name: 'dense_2'
    }).apply(concat);
    
    concat = tf.layers.dense({
      units: 32,
      activation: 'relu',
      name: 'dense_3'
    }).apply(concat);
    
    // Output layer (sigmoid for probability)
    const output = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'output'
    }).apply(concat);
    
    // Create model
    const model = tf.model({
      inputs: [userInput, itemInput],
      outputs: output
    });
    
    // Compile model with Adam optimizer
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    logger.info('Created new recommendation model');
    return model;
  }
  
  /**
   * Train model on user interaction data
   */
  async train(interactions, epochs = 10, batchSize = 256) {
    logger.info(`Training recommendation model on ${interactions.length} interactions`);
    
    // Prepare training data
    const userIds = interactions.map(i => i.userId);
    const itemIds = interactions.map(i => i.itemId);
    const labels = interactions.map(i => i.interactionType === 'purchase' ? 1 : 0.5);
    
    // Convert to tensors
    const userTensor = tf.tensor2d(userIds, [userIds.length, 1]);
    const itemTensor = tf.tensor2d(itemIds, [itemIds.length, 1]);
    const labelTensor = tf.tensor2d(labels, [labels.length, 1]);
    
    // Train model
    const history = await this.model.fit(
      { user_id: userTensor, item_id: itemTensor },
      labelTensor,
      {
        epochs: epochs,
        batchSize: batchSize,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.info(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, acc = ${logs.acc.toFixed(4)}`);
          }
        }
      }
    );
    
    // Save model after training
    await this.saveModel();
    
    return history;
  }
  
  /**
   * Get personalized recommendations for user
   */
  async getPersonalizedRecommendations(userId, limit = 10) {
    logger.debug(`Getting recommendations for user ${userId}`);
    
    // Get user's interaction history
    const userHistory = await this.getUserHistory(userId);
    
    // Get candidate items (items user hasn't interacted with)
    const candidateItems = await this.getCandidateItems(userId, userHistory);
    
    if (candidateItems.length === 0) {
      return this.getPopularProducts(limit);
    }
    
    // Predict scores for all candidate items
    const predictions = [];
    const batchSize = 100;
    
    for (let i = 0; i < candidateItems.length; i += batchSize) {
      const batch = candidateItems.slice(i, i + batchSize);
      const userTensor = tf.tensor2d(new Array(batch.length).fill(userId), [batch.length, 1]);
      const itemTensor = tf.tensor2d(batch, [batch.length, 1]);
      
      const scores = await this.model.predict({
        user_id: userTensor,
        item_id: itemTensor
      });
      
      const scoresArray = await scores.data();
      
      for (let j = 0; j < batch.length; j++) {
        predictions.push({
          productId: batch[j],
          score: scoresArray[j]
        });
      }
      
      // Clean up tensors
      userTensor.dispose();
      itemTensor.dispose();
      scores.dispose();
    }
    
    // Sort by score and get top N
    const recommendations = predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Enrich with product details
    return await this.enrichWithProductDetails(recommendations);
  }
  
  /**
   * Get similar products (item-to-item)
   */
  async getSimilarProducts(productId, limit = 10) {
    // Get product's embedding
    const productEmbedding = await this.getItemEmbedding(productId);
    
    // Calculate cosine similarity with all other products
    const similarities = [];
    
    for (const [otherId, otherEmbedding] of this.itemEmbeddings.entries()) {
      if (otherId === productId) continue;
      
      const similarity = this.cosineSimilarity(productEmbedding, otherEmbedding);
      similarities.push({
        productId: parseInt(otherId),
        score: similarity
      });
    }
    
    // Sort by similarity
    const similar = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return await this.enrichWithProductDetails(similar);
  }
  
  /**
   * Get trending products (real-time)
   */
  async getTrendingProducts(limit = 10) {
    // Query recent high-velocity products
    const result = await pgPool.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        COUNT(DISTINCT v.user_id) as unique_viewers,
        COUNT(DISTINCT o.id) as purchases,
        (COUNT(DISTINCT v.user_id) * 0.3 + COUNT(DISTINCT o.id) * 0.7) as trend_score
      FROM products p
      LEFT JOIN product_views v ON p.id = v.product_id 
        AND v.created_at > NOW() - INTERVAL '24 hours'
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id 
        AND o.created_at > NOW() - INTERVAL '24 hours'
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY trend_score DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => ({
      productId: row.id,
      name: row.name,
      price: row.price,
      score: parseFloat(row.trend_score),
      reason: 'Trending now'
    }));
  }
  
  /**
   * Record user interaction for future training
   */
  async recordUserInteraction(userId, productId, interactionType) {
    const key = `interaction:${userId}:${productId}`;
    await redisClient.setEx(key, 86400, JSON.stringify({
      userId,
      productId,
      type: interactionType,
      timestamp: new Date().toISOString()
    }));
    
    // Increment view count for trending
    if (interactionType === 'view') {
      await redisClient.zIncrBy('trending:products', 1, productId.toString());
    }
  }
  
  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async saveModel() {
    const savePath = process.env.RECOMMENDATION_MODEL_PATH || './models-data/recommendation-model';
    await this.model.save(`file://${savePath}`);
    logger.info(`Model saved to ${savePath}`);
  }
  
  async loadEmbeddings() {
    // Load from Redis or database
    const embeddings = await redisClient.get('model:embeddings');
    if (embeddings) {
      const parsed = JSON.parse(embeddings);
      this.userEmbeddings = new Map(Object.entries(parsed.users));
      this.itemEmbeddings = new Map(Object.entries(parsed.items));
    }
  }
  
  async initializeEmbeddings() {
    // Initialize with random embeddings
    this.userEmbeddings.clear();
    this.itemEmbeddings.clear();
  }
  
  async getUserHistory(userId) {
    if (this.userInteractionHistory.has(userId)) {
      return this.userInteractionHistory.get(userId);
    }
    
    const result = await pgPool.query(`
      SELECT product_id, interaction_type, created_at
      FROM user_interactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);
    
    this.userInteractionHistory.set(userId, result.rows);
    return result.rows;
  }
  
  async getCandidateItems(userId, userHistory) {
    const viewedProducts = userHistory.map(h => h.product_id);
    
    const result = await pgPool.query(`
      SELECT id FROM products 
      WHERE is_active = true 
      AND id != ALL($1::int[])
      LIMIT 1000
    `, [viewedProducts]);
    
    return result.rows.map(r => r.id);
  }
  
  async getPopularProducts(limit) {
    const result = await pgPool.query(`
      SELECT p.id, p.name, p.price, COUNT(o.id) as purchase_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY purchase_count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => ({
      productId: row.id,
      name: row.name,
      price: row.price,
      score: 1.0,
      reason: 'Popular product'
    }));
  }
  
  async enrichWithProductDetails(products) {
    if (products.length === 0) return [];
    
    const ids = products.map(p => p.productId);
    const result = await pgPool.query(`
      SELECT id, name, price, images, rating
      FROM products
      WHERE id = ANY($1::int[])
    `, [ids]);
    
    const productMap = new Map();
    result.rows.forEach(row => {
      productMap.set(row.id, row);
    });
    
    return products.map(p => ({
      ...p,
      name: productMap.get(p.productId)?.name,
      price: productMap.get(p.productId)?.price,
      images: productMap.get(p.productId)?.images,
      rating: productMap.get(p.productId)?.rating
    }));
  }
  
  async getItemEmbedding(productId) {
    if (this.itemEmbeddings.has(productId)) {
      return this.itemEmbeddings.get(productId);
    }
    
    // Get from model
    const itemTensor = tf.tensor2d([[productId]], [1, 1]);
    const embedding = this.model.getLayer('item_embedding').apply(itemTensor);
    const embeddingArray = await embedding.data();
    
    itemTensor.dispose();
    embedding.dispose();
    
    return Array.from(embeddingArray);
  }
}

module.exports = { RecommendationEngine };
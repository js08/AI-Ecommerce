/**
 * tensorflowLoader.js - Load and manage TensorFlow models
 * Using pure JavaScript version (no native compilation required)
 */

const tf = require('@tensorflow/tfjs');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

class TensorFlowLoader {
  constructor() {
    this.models = new Map();
    this.modelPaths = {
      recommendation: path.join(__dirname, '../../models-data/recommendation-model/model.json'),
      fraud: path.join(__dirname, '../../models-data/fraud-model/model.json'),
      visual: path.join(__dirname, '../../models-data/visual-model/model.json')
    };
    this.isLoading = new Map();
    
    // Enable CPU backend (no GPU required)
    tf.setBackend('cpu');
    logger.info('TensorFlow.js initialized with CPU backend');
  }

  /**
   * Load a TensorFlow model
   * @param {string} modelName - Name of the model to load
   * @returns {Promise<tf.LayersModel>} Loaded model
   */
  async loadModel(modelName) {
    // Check if already loaded
    if (this.models.has(modelName)) {
      logger.debug(`Model ${modelName} already loaded`);
      return this.models.get(modelName);
    }
    
    // Check if currently loading (avoid duplicate loads)
    if (this.isLoading.get(modelName)) {
      logger.debug(`Model ${modelName} is already loading, waiting...`);
      return this.isLoading.get(modelName);
    }
    
    // Load the model
    const loadPromise = this._loadModelAsync(modelName);
    this.isLoading.set(modelName, loadPromise);
    
    try {
      const model = await loadPromise;
      this.models.set(modelName, model);
      logger.info(`✅ Model ${modelName} loaded successfully`);
      return model;
    } finally {
      this.isLoading.delete(modelName);
    }
  }

  /**
   * Async model loading implementation
   * @param {string} modelName - Name of the model
   * @returns {Promise<tf.LayersModel>}
   */
  async _loadModelAsync(modelName) {
    const modelPath = this.modelPaths[modelName];
    
    if (!modelPath) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    
    try {
      // Check if model file exists
      await fs.access(modelPath).catch(() => {
        logger.warn(`Model file not found: ${modelPath}`);
        return null;
      });
      
      // Load model from file system
      const model = await tf.loadLayersModel(`file://${modelPath}`);
      logger.info(`Model ${modelName} loaded from ${modelPath}`);
      return model;
      
    } catch (error) {
      logger.warn(`Model ${modelName} not found or corrupt, creating new model`);
      
      // Create new model if doesn't exist
      const model = await this.createModel(modelName);
      
      // Save the new model
      await this.saveModel(modelName, model);
      
      return model;
    }
  }

  /**
   * Create a new model for training
   * @param {string} modelName - Name of the model to create
   * @returns {Promise<tf.LayersModel>}
   */
  async createModel(modelName) {
    switch (modelName) {
      case 'recommendation':
        return this.createRecommendationModel();
      case 'fraud':
        return this.createFraudModel();
      case 'visual':
        return this.createVisualModel();
      default:
        throw new Error(`Unknown model type: ${modelName}`);
    }
  }

  /**
   * Create recommendation model (Neural Collaborative Filtering)
   */
  createRecommendationModel() {
    const numUsers = 100000;
    const numItems = 50000;
    const embeddingDim = 32;
    
    // User input
    const userInput = tf.input({ shape: [1], name: 'user_id', dtype: 'int32' });
    const itemInput = tf.input({ shape: [1], name: 'item_id', dtype: 'int32' });
    
    // User embedding
    const userEmbedding = tf.layers.embedding({
      inputDim: numUsers,
      outputDim: embeddingDim,
      name: 'user_embedding'
    }).apply(userInput);
    
    // Item embedding
    const itemEmbedding = tf.layers.embedding({
      inputDim: numItems,
      outputDim: embeddingDim,
      name: 'item_embedding'
    }).apply(itemInput);
    
    // Flatten
    const userFlat = tf.layers.flatten().apply(userEmbedding);
    const itemFlat = tf.layers.flatten().apply(itemEmbedding);
    
    // Concatenate
    let concat = tf.layers.concatenate().apply([userFlat, itemFlat]);
    
    // Dense layers
    concat = tf.layers.dense({ units: 128, activation: 'relu' }).apply(concat);
    concat = tf.layers.dropout({ rate: 0.2 }).apply(concat);
    concat = tf.layers.dense({ units: 64, activation: 'relu' }).apply(concat);
    concat = tf.layers.dense({ units: 32, activation: 'relu' }).apply(concat);
    
    // Output
    const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(concat);
    
    const model = tf.model({ inputs: [userInput, itemInput], outputs: output });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  /**
   * Create fraud detection model
   */
  createFraudModel() {
    const input = tf.input({ shape: [12], name: 'features' });
    
    let x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input);
    x = tf.layers.dropout({ rate: 0.3 }).apply(x);
    x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x);
    x = tf.layers.dense({ units: 16, activation: 'relu' }).apply(x);
    
    const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(x);
    
    const model = tf.model({ inputs: input, outputs: output });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    return model;
  }

  /**
   * Create visual search model (CNN)
   */
  createVisualModel() {
    // Simplified CNN for feature extraction
    const input = tf.input({ shape: [224, 224, 3], name: 'image' });
    
    let x = tf.layers.conv2d({ filters: 32, kernelSize: 3, activation: 'relu' }).apply(input);
    x = tf.layers.maxPooling2d({ poolSize: 2 }).apply(x);
    x = tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }).apply(x);
    x = tf.layers.maxPooling2d({ poolSize: 2 }).apply(x);
    x = tf.layers.conv2d({ filters: 128, kernelSize: 3, activation: 'relu' }).apply(x);
    x = tf.layers.globalAveragePooling2d().apply(x);
    
    // Output embedding (512 dimensions)
    const output = tf.layers.dense({ units: 512, activation: 'relu' }).apply(x);
    
    const model = tf.model({ inputs: input, outputs: output });
    
    return model;
  }

  /**
   * Save model to disk
   * @param {string} modelName - Model name
   * @param {tf.LayersModel} model - Model to save
   */
  async saveModel(modelName, model) {
    const modelPath = this.modelPaths[modelName];
    const dir = path.dirname(modelPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    await model.save(`file://${dir}`);
    logger.info(`Model ${modelName} saved to ${dir}`);
  }

  /**
   * Unload model to free memory
   * @param {string} modelName - Model to unload
   */
  unloadModel(modelName) {
    const model = this.models.get(modelName);
    if (model) {
      model.dispose();
      this.models.delete(modelName);
      logger.info(`Model ${modelName} unloaded`);
    }
  }

  /**
   * Get model for prediction
   * @param {string} modelName - Model name
   * @returns {Promise<tf.LayersModel>} Loaded model
   */
  async getModel(modelName) {
    return await this.loadModel(modelName);
  }

  /**
   * Clear all models from memory
   */
  clearAllModels() {
    for (const [name, model] of this.models) {
      model.dispose();
      logger.info(`Model ${name} disposed`);
    }
    this.models.clear();
  }
}

// Singleton instance
const tensorflowLoader = new TensorFlowLoader();

module.exports = { tensorflowLoader, tf };
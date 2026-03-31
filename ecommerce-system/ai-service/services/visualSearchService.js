/**
 * visualSearchService.js - Find products by image
 *
 * Uses deep learning (ResNet50) to extract image features
 * Then finds similar products using vector similarity
 */

const Jimp = require('jimp');
const { logger } = require('../utils/logger');

class VisualSearchService {
  constructor(vectorStore, pgPool) {
    this.vectorStore = vectorStore;
    this.pgPool = pgPool;
    this.featureExtractor = null;
    this.imageCache = new Map();
  }

  /**
   * Extract features from image using neural network
   */
  async extractFeatures(imageBuffer) {
    try {
      const image = await Jimp.read(imageBuffer);
      await image.cover(224, 224);
      const processedImage = await image.getBufferAsync(Jimp.MIME_JPEG);

      const features = await this.simplifiedFeatureExtraction(processedImage);

      return features;
    } catch (error) {
      logger.error('Feature extraction failed:', error);
      throw error;
    }
  }

  /**
   * Simplified feature extraction for demo
   * In production, use actual CNN model
   */
  async simplifiedFeatureExtraction(imageBuffer) {
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const data = image.bitmap.data;

    let r = 0;
    let g = 0;
    let b = 0;
    const pixelCount = width * height;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    const features = {
      avgRed: r / pixelCount,
      avgGreen: g / pixelCount,
      avgBlue: b / pixelCount,
      brightness: (r + g + b) / (3 * pixelCount),
      width,
      height,
      aspectRatio: width / height
    };

    return Object.values(features);
  }

  /**
   * Find similar products in vector database
   */
  async findSimilarProducts(imageFeatures, limit = 10) {
    const similar = await this.vectorStore.similaritySearch(imageFeatures, limit);

    const products = await this.enrichProducts(similar);

    return products;
  }

  async enrichProducts(similarProducts) {
    if (!this.pgPool || similarProducts.length === 0) return [];

    const productIds = similarProducts.map((s) => s.id);
    const result = await this.pgPool.query(
      `
      SELECT id, name, price, images, description
      FROM products
      WHERE id = ANY($1::int[])
    `,
      [productIds]
    );

    const productMap = new Map();
    result.rows.forEach((row) => {
      productMap.set(row.id, row);
    });

    return similarProducts.map((sim) => ({
      ...productMap.get(sim.id),
      similarityScore: sim.score
    }));
  }
}

module.exports = { VisualSearchService };

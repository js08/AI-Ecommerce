/**
 * imageProcessor.js - Image processing utilities for visual search
 * Handles resizing, normalization, and feature extraction
 */

const sharp = require('sharp');
const { logger } = require('./logger');
const tf = require('@tensorflow/tfjs-node');

class ImageProcessor {
  constructor() {
    this.targetSize = 224; // ResNet input size
    this.mean = [0.485, 0.456, 0.406]; // ImageNet mean
    this.std = [0.229, 0.224, 0.225]; // ImageNet std
  }

  /**
   * Process image for model input
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<tf.Tensor>} Processed image tensor
   */
  async processImage(imageBuffer) {
    try {
      // Step 1: Resize image to target size
      const resized = await sharp(imageBuffer)
        .resize(this.targetSize, this.targetSize, {
          fit: 'cover',
          position: 'center'
        })
        .toFormat('jpeg')
        .toBuffer();
      
      // Step 2: Convert to RGB and normalize
      const { data, info } = await sharp(resized)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Step 3: Convert to tensor
      let tensor = tf.tensor3d(
        new Float32Array(data),
        [info.height, info.width, info.channels]
      );
      
      // Step 4: Normalize pixel values to [0, 1]
      tensor = tensor.div(255);
      
      // Step 5: Apply mean normalization
      const meanTensor = tf.tensor1d(this.mean);
      const stdTensor = tf.tensor1d(this.std);
      tensor = tensor.sub(meanTensor).div(stdTensor);
      
      // Step 6: Add batch dimension
      tensor = tensor.expandDims(0);
      
      return tensor;
      
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw error;
    }
  }

  /**
   * Extract features from image using pre-trained model
   * @param {Buffer} imageBuffer - Raw image buffer
   * @param {tf.LayersModel} model - Feature extraction model
   * @returns {Promise<Float32Array>} Feature vector
   */
  async extractFeatures(imageBuffer, model) {
    const tensor = await this.processImage(imageBuffer);
    
    try {
      // Get predictions from model
      const predictions = await model.predict(tensor);
      const features = await predictions.data();
      
      // Clean up tensors
      tensor.dispose();
      predictions.dispose();
      
      return new Float32Array(features);
      
    } catch (error) {
      logger.error('Feature extraction failed:', error);
      tensor.dispose();
      throw error;
    }
  }

  /**
   * Generate image thumbnail
   * @param {Buffer} imageBuffer - Raw image buffer
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {Promise<Buffer>} Thumbnail buffer
   */
  async generateThumbnail(imageBuffer, width = 150, height = 150) {
    return await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  /**
   * Optimize image for web delivery
   * @param {Buffer} imageBuffer - Raw image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} Optimized image buffer
   */
  async optimizeImage(imageBuffer, options = {}) {
    const {
      quality = 85,
      format = 'webp',
      maxWidth = 1200,
      maxHeight = 1200
    } = options;
    
    let pipeline = sharp(imageBuffer);
    
    // Resize if needed
    const metadata = await pipeline.metadata();
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Convert to desired format
    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      default:
        pipeline = pipeline.jpeg({ quality });
    }
    
    return await pipeline.toBuffer();
  }

  /**
   * Extract color histogram from image
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<Object>} Color histogram
   */
  async extractColorHistogram(imageBuffer) {
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const bins = 32;
    const histogram = {
      r: new Array(bins).fill(0),
      g: new Array(bins).fill(0),
      b: new Array(bins).fill(0)
    };
    
    const pixelCount = info.width * info.height;
    
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const rBin = Math.floor(r / (256 / bins));
      const gBin = Math.floor(g / (256 / bins));
      const bBin = Math.floor(b / (256 / bins));
      
      histogram.r[rBin]++;
      histogram.g[gBin]++;
      histogram.b[bBin]++;
    }
    
    // Normalize
    for (const channel of ['r', 'g', 'b']) {
      histogram[channel] = histogram[channel].map(v => v / pixelCount);
    }
    
    return histogram;
  }

  /**
   * Detect image quality issues
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<Object>} Quality assessment
   */
  async assessImageQuality(imageBuffer) {
    const metadata = await sharp(imageBuffer).metadata();
    
    const issues = [];
    let qualityScore = 100;
    
    // Check dimensions
    if (metadata.width < 500 || metadata.height < 500) {
      issues.push('Image too small (minimum 500x500 recommended)');
      qualityScore -= 20;
    }
    
    // Check aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    if (aspectRatio < 0.5 || aspectRatio > 2) {
      issues.push('Unusual aspect ratio');
      qualityScore -= 15;
    }
    
    // Check file size
    if (metadata.size > 5 * 1024 * 1024) {
      issues.push('File size too large (>5MB)');
      qualityScore -= 10;
    }
    
    // Check for blur (simplified)
    // In production, use more sophisticated blur detection
    
    return {
      score: Math.max(0, qualityScore),
      issues,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      },
      recommended: qualityScore >= 70
    };
  }

  /**
   * Generate multiple image sizes for responsive delivery
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<Object>} Image set with different sizes
   */
  async generateImageSet(imageBuffer) {
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 300, height: 300 },
      { name: 'medium', width: 600, height: 600 },
      { name: 'large', width: 1200, height: 1200 }
    ];
    
    const imageSet = {};
    
    for (const size of sizes) {
      imageSet[size.name] = await sharp(imageBuffer)
        .resize(size.width, size.height, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
    
    // Also generate WebP versions
    imageSet.webp = await this.optimizeImage(imageBuffer, { format: 'webp' });
    
    return imageSet;
  }

  /**
   * Detect if image contains text
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<boolean>} Whether image contains text
   */
  async containsText(imageBuffer) {
    // Simplified text detection
    // In production, use OCR like Tesseract or AWS Rekognition
    
    const { info } = await sharp(imageBuffer)
      .greyscale()
      .threshold(200)
      .toBuffer({ resolveWithObject: true });
    
    // For demo, return false
    return false;
  }

  /**
   * Extract dominant colors from image
   * @param {Buffer} imageBuffer - Raw image buffer
   * @param {number} count - Number of colors to extract
   * @returns {Promise<Array>} Dominant colors
   */
  async extractDominantColors(imageBuffer, count = 5) {
    const { data } = await sharp(imageBuffer)
      .resize(50, 50)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const colorMap = new Map();
    
    // Sample pixels
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.floor(data[i] / 16) * 16;
      const g = Math.floor(data[i + 1] / 16) * 16;
      const b = Math.floor(data[i + 2] / 16) * 16;
      const color = `${r},${g},${b}`;
      
      colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }
    
    // Sort by frequency
    const colors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([color]) => {
        const [r, g, b] = color.split(',').map(Number);
        return { r, g, b, hex: this.rgbToHex(r, g, b) };
      });
    
    return colors;
  }

  /**
   * Convert RGB to hex color code
   */
  rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Get image metadata
   */
  async getMetadata(imageBuffer) {
    return await sharp(imageBuffer).metadata();
  }

  /**
   * Clean up tensor resources
   */
  disposeTensor(tensor) {
    if (tensor && !tensor.isDisposed) {
      tensor.dispose();
    }
  }
}

module.exports = { ImageProcessor };
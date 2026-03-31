/**
 * imageProcessor.js - Image processing utilities for visual search
 * Uses Jimp + TensorFlow.js (no native sharp / tfjs-node binaries).
 */

const Jimp = require('jimp');
const tf = require('@tensorflow/tfjs');
const { logger } = require('./logger');

class ImageProcessor {
  constructor() {
    this.targetSize = 224;
    this.mean = [0.485, 0.456, 0.406];
    this.std = [0.229, 0.224, 0.225];
  }

  async _read(imageBuffer) {
    return Jimp.read(imageBuffer);
  }

  /**
   * Process image for model input
   */
  async processImage(imageBuffer) {
    try {
      const image = await this._read(imageBuffer);
      await image.cover(this.targetSize, this.targetSize);

      const w = image.bitmap.width;
      const h = image.bitmap.height;
      const d = image.bitmap.data;
      const rgb = new Float32Array(w * h * 3);
      let o = 0;
      for (let i = 0; i < d.length; i += 4) {
        rgb[o++] = d[i];
        rgb[o++] = d[i + 1];
        rgb[o++] = d[i + 2];
      }

      let tensor = tf.tensor3d(rgb, [h, w, 3]);
      tensor = tensor.div(255);
      const meanTensor = tf.tensor1d(this.mean);
      const stdTensor = tf.tensor1d(this.std);
      tensor = tensor.sub(meanTensor).div(stdTensor);
      tensor = tensor.expandDims(0);
      return tensor;
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw error;
    }
  }

  async extractFeatures(imageBuffer, model) {
    const tensor = await this.processImage(imageBuffer);
    try {
      const predictions = await model.predict(tensor);
      const features = await predictions.data();
      tensor.dispose();
      predictions.dispose();
      return new Float32Array(features);
    } catch (error) {
      logger.error('Feature extraction failed:', error);
      tensor.dispose();
      throw error;
    }
  }

  async generateThumbnail(imageBuffer, width = 150, height = 150) {
    const image = await this._read(imageBuffer);
    await image.cover(width, height);
    return image.getBufferAsync(Jimp.MIME_JPEG);
  }

  async optimizeImage(imageBuffer, options = {}) {
    const { quality = 85, maxWidth = 1200, maxHeight = 1200 } = options;
    const image = await this._read(imageBuffer);
    if (image.bitmap.width > maxWidth || image.bitmap.height > maxHeight) {
      image.scaleToFit(maxWidth, maxHeight);
    }
    image.quality(quality);
    return image.getBufferAsync(Jimp.MIME_JPEG);
  }

  async extractColorHistogram(imageBuffer) {
    const image = await this._read(imageBuffer);
    await image.cover(100, 100);
    const d = image.bitmap.data;
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const bins = 32;
    const histogram = {
      r: new Array(bins).fill(0),
      g: new Array(bins).fill(0),
      b: new Array(bins).fill(0)
    };
    const pixelCount = w * h;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      histogram.r[Math.floor(r / (256 / bins))]++;
      histogram.g[Math.floor(g / (256 / bins))]++;
      histogram.b[Math.floor(b / (256 / bins))]++;
    }
    for (const channel of ['r', 'g', 'b']) {
      histogram[channel] = histogram[channel].map((v) => v / pixelCount);
    }
    return histogram;
  }

  async assessImageQuality(imageBuffer) {
    const image = await this._read(imageBuffer);
    const metadata = {
      width: image.bitmap.width,
      height: image.bitmap.height,
      format: image.getExtension() || 'unknown',
      size: Buffer.isBuffer(imageBuffer) ? imageBuffer.length : 0
    };
    const issues = [];
    let qualityScore = 100;
    if (metadata.width < 500 || metadata.height < 500) {
      issues.push('Image too small (minimum 500x500 recommended)');
      qualityScore -= 20;
    }
    const aspectRatio = metadata.width / metadata.height;
    if (aspectRatio < 0.5 || aspectRatio > 2) {
      issues.push('Unusual aspect ratio');
      qualityScore -= 15;
    }
    if (metadata.size > 5 * 1024 * 1024) {
      issues.push('File size too large (>5MB)');
      qualityScore -= 10;
    }
    return {
      score: Math.max(0, qualityScore),
      issues,
      metadata,
      recommended: qualityScore >= 70
    };
  }

  async generateImageSet(imageBuffer) {
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 300, height: 300 },
      { name: 'medium', width: 600, height: 600 },
      { name: 'large', width: 1200, height: 1200 }
    ];
    const imageSet = {};
    for (const size of sizes) {
      const img = await this._read(imageBuffer);
      await img.cover(size.width, size.height);
      imageSet[size.name] = await img.getBufferAsync(Jimp.MIME_JPEG);
    }
    imageSet.webp = await this.optimizeImage(imageBuffer, { format: 'jpeg' });
    return imageSet;
  }

  async containsText() {
    return false;
  }

  async extractDominantColors(imageBuffer, count = 5) {
    const image = await this._read(imageBuffer);
    await image.cover(50, 50);
    const d = image.bitmap.data;
    const colorMap = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = Math.floor(d[i] / 16) * 16;
      const g = Math.floor(d[i + 1] / 16) * 16;
      const b = Math.floor(d[i + 2] / 16) * 16;
      const color = `${r},${g},${b}`;
      colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }
    const colors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([color]) => {
        const [r, g, b] = color.split(',').map(Number);
        return { r, g, b, hex: this.rgbToHex(r, g, b) };
      });
    return colors;
  }

  rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  async getMetadata(imageBuffer) {
    const image = await this._read(imageBuffer);
    return {
      width: image.bitmap.width,
      height: image.bitmap.height,
      format: image.getExtension(),
      size: Buffer.isBuffer(imageBuffer) ? imageBuffer.length : 0
    };
  }

  disposeTensor(tensor) {
    if (tensor && !tensor.isDisposed) {
      tensor.dispose();
    }
  }
}

module.exports = { ImageProcessor };

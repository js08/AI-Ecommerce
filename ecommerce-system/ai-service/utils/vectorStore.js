/**
 * vectorStore.js - Vector database for embeddings
 * Uses ChromaDB or PostgreSQL pgvector for similarity search
 * Stores and retrieves high-dimensional vectors efficiently
 */

const { logger } = require('./logger');
const { Pool } = require('pg');

class VectorStore {
  constructor(pgPool) {
    this.db = pgPool;
    this.collections = new Map();
    this.vectorDimension = 512; // Default dimension for embeddings
  }

  /**
   * Initialize vector store
   */
  async initialize() {
    logger.info('Initializing vector store');
    
    try {
      // Create extension for vector support
      await this.db.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Create tables if not exist
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS vector_embeddings (
          id SERIAL PRIMARY KEY,
          collection_name VARCHAR(100) NOT NULL,
          entity_id INTEGER NOT NULL,
          entity_type VARCHAR(50),
          embedding vector(512),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for faster search
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_vector_collection 
        ON vector_embeddings(collection_name)
      `);
      
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_vector_entity 
        ON vector_embeddings(entity_id, entity_type)
      `);
      
      logger.info('Vector store initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  /**
   * Add or update embedding in store
   * @param {string} collectionName - Name of the collection
   * @param {string|number} entityId - ID of the entity
   * @param {Array<number>} vector - Embedding vector
   * @param {Object} metadata - Additional metadata
   */
  async upsert(collectionName, entityId, vector, metadata = {}) {
    try {
      const vectorStr = `[${vector.join(',')}]`;
      
      await this.db.query(`
        INSERT INTO vector_embeddings 
        (collection_name, entity_id, embedding, metadata)
        VALUES ($1, $2, $3::vector, $4)
        ON CONFLICT (collection_name, entity_id) 
        DO UPDATE SET 
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          created_at = NOW()
      `, [collectionName, entityId, vectorStr, JSON.stringify(metadata)]);
      
      logger.debug(`Upserted embedding for ${collectionName}:${entityId}`);
      
    } catch (error) {
      logger.error('Failed to upsert embedding:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   * @param {string} collectionName - Collection to search
   * @param {Array<number>} queryVector - Query vector
   * @param {number} limit - Number of results
   * @param {Object} filter - Optional metadata filter
   * @returns {Promise<Array>} Similar items with scores
   */
  async similaritySearch(collectionName, queryVector, limit = 10, filter = null) {
    try {
      const vectorStr = `[${queryVector.join(',')}]`;
      
      let query = `
        SELECT 
          entity_id,
          metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM vector_embeddings
        WHERE collection_name = $2
      `;
      
      const params = [vectorStr, collectionName];
      let paramIndex = 3;
      
      // Add metadata filter if provided
      if (filter) {
        query += ` AND metadata @> $${paramIndex}::jsonb`;
        params.push(JSON.stringify(filter));
        paramIndex++;
      }
      
      query += `
        ORDER BY embedding <=> $1::vector
        LIMIT $${paramIndex}
      `;
      params.push(limit);
      
      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.entity_id,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata
      }));
      
    } catch (error) {
      logger.error('Similarity search failed:', error);
      return [];
    }
  }

  /**
   * Delete embeddings by entity ID
   * @param {string} collectionName - Collection name
   * @param {string|number} entityId - Entity ID to delete
   */
  async delete(collectionName, entityId) {
    try {
      await this.db.query(`
        DELETE FROM vector_embeddings
        WHERE collection_name = $1 AND entity_id = $2
      `, [collectionName, entityId]);
      
      logger.debug(`Deleted embedding for ${collectionName}:${entityId}`);
      
    } catch (error) {
      logger.error('Failed to delete embedding:', error);
      throw error;
    }
  }

  /**
   * Get embedding by entity ID
   * @param {string} collectionName - Collection name
   * @param {string|number} entityId - Entity ID
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async get(collectionName, entityId) {
    try {
      const result = await this.db.query(`
        SELECT embedding FROM vector_embeddings
        WHERE collection_name = $1 AND entity_id = $2
      `, [collectionName, entityId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Parse vector from PostgreSQL format
      const vectorStr = result.rows[0].embedding;
      return this.parseVector(vectorStr);
      
    } catch (error) {
      logger.error('Failed to get embedding:', error);
      return null;
    }
  }

  /**
   * Batch add multiple embeddings
   * @param {string} collectionName - Collection name
   * @param {Array} items - Array of {id, vector, metadata}
   */
  async batchUpsert(collectionName, items) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const item of items) {
        const vectorStr = `[${item.vector.join(',')}]`;
        
        await client.query(`
          INSERT INTO vector_embeddings 
          (collection_name, entity_id, embedding, metadata)
          VALUES ($1, $2, $3::vector, $4)
          ON CONFLICT (collection_name, entity_id) 
          DO UPDATE SET 
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata
        `, [collectionName, item.id, vectorStr, JSON.stringify(item.metadata || {})]);
      }
      
      await client.query('COMMIT');
      logger.info(`Batch upserted ${items.length} embeddings to ${collectionName}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Batch upsert failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get count of embeddings in collection
   * @param {string} collectionName - Collection name
   * @returns {Promise<number>} Count
   */
  async count(collectionName) {
    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as count
        FROM vector_embeddings
        WHERE collection_name = $1
      `, [collectionName]);
      
      return parseInt(result.rows[0].count);
      
    } catch (error) {
      logger.error('Failed to count embeddings:', error);
      return 0;
    }
  }

  /**
   * List all collections
   * @returns {Promise<Array>} List of collections
   */
  async listCollections() {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT collection_name, COUNT(*) as count
        FROM vector_embeddings
        GROUP BY collection_name
        ORDER BY collection_name
      `);
      
      return result.rows.map(row => ({
        name: row.collection_name,
        count: parseInt(row.count)
      }));
      
    } catch (error) {
      logger.error('Failed to list collections:', error);
      return [];
    }
  }

  /**
   * Delete entire collection
   * @param {string} collectionName - Collection to delete
   */
  async deleteCollection(collectionName) {
    try {
      await this.db.query(`
        DELETE FROM vector_embeddings
        WHERE collection_name = $1
      `, [collectionName]);
      
      logger.info(`Deleted collection: ${collectionName}`);
      
    } catch (error) {
      logger.error('Failed to delete collection:', error);
      throw error;
    }
  }

  /**
   * Parse vector from PostgreSQL format
   * @param {string} vectorStr - Vector string from PostgreSQL
   * @returns {Array<number>} Vector array
   */
  parseVector(vectorStr) {
    // Format: [0.1, 0.2, 0.3] or [0.1,0.2,0.3]
    const cleanStr = vectorStr.replace(/[\[\]]/g, '');
    return cleanStr.split(',').map(Number);
  }

  /**
   * Normalize vector to unit length
   * @param {Array<number>} vector - Input vector
   * @returns {Array<number>} Normalized vector
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} v1 - First vector
   * @param {Array<number>} v2 - Second vector
   * @returns {number} Cosine similarity (0-1)
   */
  cosineSimilarity(v1, v2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get nearest neighbors using L2 distance
   * @param {string} collectionName - Collection name
   * @param {Array<number>} queryVector - Query vector
   * @param {number} k - Number of neighbors
   * @returns {Promise<Array>} Nearest neighbors
   */
  async getNearestNeighbors(collectionName, queryVector, k = 10) {
    return await this.similaritySearch(collectionName, queryVector, k);
  }

  /**
   * Hybrid search (vector + metadata)
   * @param {string} collectionName - Collection name
   * @param {Array<number>} queryVector - Query vector
   * @param {Object} metadataFilter - Metadata filter
   * @param {number} limit - Limit results
   * @returns {Promise<Array>} Filtered results
   */
  async hybridSearch(collectionName, queryVector, metadataFilter, limit = 10) {
    return await this.similaritySearch(collectionName, queryVector, limit, metadataFilter);
  }
}

module.exports = { VectorStore };
// ============================================
// PRODUCT SERVICE - Manages products, categories, search
// Databases: PostgreSQL (main data) + Elasticsearch (search)
// Cache: Redis (popular products)
// ============================================

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { Client } = require('@elastic/elasticsearch');
const { createProducer, createConsumer, TOPICS } = require('../shared/kafka-config');
const multer = require('multer');  // For image uploads
const sharp = require('sharp');    // For image optimization
const { devCors } = require('../shared/dev-cors');

const app = express();
app.use(devCors());
app.use(express.json());

// ============ DATABASE CONNECTIONS ============

// PostgreSQL for product data (structured, relational)
const db = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ecommerce_main',
    user: 'ecommerce_user',
    password: 'secure_password_123',
    max: 20
});

// Redis for caching (super fast reads)
const redis = new Redis({
    host: 'localhost',
    port: 6379
});

// Elasticsearch for full-text search
// Like Google but for our products
const esClient = new Client({
    node: 'http://localhost:9200',
    maxRetries: 3,
    requestTimeout: 30000
});

// ============ DATABASE SCHEMA ============

const initDatabase = async () => {
    // Categories table
    await db.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            parent_id INTEGER REFERENCES categories(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Products table
    await db.query(`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            seller_id INTEGER NOT NULL,
            category_id INTEGER REFERENCES categories(id),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            images JSONB DEFAULT '[]',  -- Array of image URLs
            attributes JSONB DEFAULT '{}',  -- Dynamic attributes (size, color, etc.)
            rating DECIMAL(3, 2) DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create indexes for faster queries
    await db.query('CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)');
    
    console.log('✅ Product database tables ready');
};

initDatabase().catch((e) => console.error('Product initDatabase:', e.message));

// ============ ELASTICSEARCH SETUP ============

const setupElasticsearch = async () => {
    try {
        // Check if index exists
        const indexExists = await esClient.indices.exists({ index: 'products' });
        
        if (!indexExists) {
            // Create products index with mapping (schema)
            await esClient.indices.create({
                index: 'products',
                body: {
                    mappings: {
                        properties: {
                            id: { type: 'integer' },
                            name: { type: 'text', analyzer: 'standard' },
                            description: { type: 'text', analyzer: 'standard' },
                            price: { type: 'float' },
                            category: { type: 'keyword' },
                            seller_id: { type: 'integer' },
                            attributes: { type: 'object' },
                            rating: { type: 'float' },
                            is_active: { type: 'boolean' },
                            created_at: { type: 'date' }
                        }
                    }
                }
            });
            console.log('✅ Elasticsearch index created');
        }
    } catch (error) {
        console.error('Elasticsearch setup error:', error);
    }
};

setupElasticsearch();

// ============ KAFKA SETUP ============

let kafkaProducer = null;
let kafkaConsumer = null;

const safeKafkaSend = async (payload) => {
    if (!kafkaProducer) return;
    try {
        await kafkaProducer.send(payload);
    } catch (e) {
        console.warn('Kafka send:', e.message);
    }
};

const setupKafka = async () => {
    try {
        kafkaProducer = await createProducer('product-service');
        kafkaConsumer = await createConsumer(
            'product-service',
            'product-service-group',
            [TOPICS.INVENTORY_UPDATES, TOPICS.ORDER_EVENTS]
        );

        await kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                console.log(`📨 Received event: ${event.eventType}`);

                switch (event.eventType) {
                    case 'ORDER_CREATED':
                        await updateProductStats(event.productId);
                        break;
                    case 'PRODUCT_UPDATED':
                        await indexProductInElasticsearch(event.productId);
                        break;
                    default:
                        console.log('Unknown event type:', event.eventType);
                }
            }
        });

        console.log('✅ Kafka setup complete');
    } catch (e) {
        console.warn('⚠️ Product Kafka unavailable:', e.message);
        kafkaProducer = null;
        kafkaConsumer = null;
    }
};

setupKafka().catch((e) => console.warn('Kafka setup:', e.message));

// ============ HELPER FUNCTIONS ============

// Index product in Elasticsearch for search
const indexProductInElasticsearch = async (productId) => {
    try {
        // Get product from PostgreSQL
        const result = await db.query(
            `SELECT p.*, c.name as category_name 
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = $1`,
            [productId]
        );
        
        if (result.rows.length === 0) return;
        
        const product = result.rows[0];
        
        // Index in Elasticsearch
        await esClient.index({
            index: 'products',
            id: product.id.toString(),
            body: {
                id: product.id,
                name: product.name,
                description: product.description,
                price: parseFloat(product.price),
                category: product.category_name,
                seller_id: product.seller_id,
                attributes: product.attributes,
                rating: product.rating,
                is_active: product.is_active,
                created_at: product.created_at
            }
        });
        
        console.log(`📝 Product ${productId} indexed in Elasticsearch`);
        
    } catch (error) {
        console.error('Elasticsearch indexing error:', error);
    }
};

// Update product statistics (rating, review count)
const updateProductStats = async (productId) => {
    // This would aggregate reviews and update rating
    // Simplified for example
    await db.query(
        `UPDATE products 
         SET review_count = review_count + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [productId]
    );
    
    // Invalidate cache
    await redis.del(`product:${productId}`);
};

// Get product with caching
const getProductWithCache = async (productId) => {
    // Try cache first
    const cached = await redis.get(`product:${productId}`);
    if (cached) {
        return JSON.parse(cached);
    }
    
    // Get from database
    const result = await db.query(
        `SELECT p.*, c.name as category_name 
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1 AND p.is_active = TRUE`,
        [productId]
    );
    
    if (result.rows.length === 0) return null;
    
    const product = result.rows[0];
    
    // Cache for 5 minutes
    await redis.setex(`product:${productId}`, 300, JSON.stringify(product));
    
    return product;
};

// ============ API ROUTES ============

// ========== SEARCH PRODUCTS ==========
// Full-text search using Elasticsearch
app.get('/api/v1/products/search', async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        
        // Build Elasticsearch query
        const must = [];
        
        // Text search
        must.push({
            multi_match: {
                query: q,
                fields: ['name^3', 'description'],  // name has 3x weight
                fuzziness: 'AUTO'  // Allow typos
            }
        });
        
        // Category filter
        if (category) {
            must.push({ term: { category: category } });
        }
        
        // Price range
        if (minPrice || maxPrice) {
            const range = {};
            if (minPrice) range.gte = parseFloat(minPrice);
            if (maxPrice) range.lte = parseFloat(maxPrice);
            must.push({ range: { price: range } });
        }
        
        // Only active products
        must.push({ term: { is_active: true } });
        
        const from = (page - 1) * limit;
        
        const searchResult = await esClient.search({
            index: 'products',
            body: {
                query: { bool: { must } },
                from: from,
                size: limit,
                sort: [{ rating: 'desc' }]  // Sort by rating
            }
        });
        
        const products = searchResult.hits.hits.map(hit => hit._source);
        const total = searchResult.hits.total.value;
        
        res.json({
            products: products,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ========== GET PRODUCT BY ID ==========
app.get('/api/v1/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        const product = await getProductWithCache(productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Increment view count (async, don't wait)
        // In production, use a counter in Redis
        redis.incr(`product:views:${productId}`);
        
        res.json(product);
        
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

// ========== LIST PRODUCTS ==========
app.get('/api/v1/products', async (req, res) => {
    try {
        const { category, seller, page = 1, limit = 20, sort = 'created_at' } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = TRUE
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (category) {
            query += ` AND c.name = $${paramIndex++}`;
            params.push(category);
        }
        
        if (seller) {
            query += ` AND p.seller_id = $${paramIndex++}`;
            params.push(seller);
        }
        
        // Sorting
        const validSortFields = ['price', 'rating', 'created_at'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        query += ` ORDER BY p.${sortField} DESC`;
        
        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        
        // Get total count
        const countResult = await db.query(
            'SELECT COUNT(*) FROM products WHERE is_active = TRUE',
            []
        );
        
        res.json({
            products: result.rows,
            pagination: {
                page: page,
                limit: limit,
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
        
    } catch (error) {
        console.error('List products error:', error);
        res.status(500).json({ error: 'Failed to list products' });
    }
});

// ========== CREATE PRODUCT ==========
// Seller adds a new product
app.post('/api/v1/products', async (req, res) => {
    try {
        const sellerId = req.headers['x-user-id'];
        const { name, description, price, categoryId, attributes } = req.body;
        
        // Validation
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        
        if (price <= 0) {
            return res.status(400).json({ error: 'Price must be positive' });
        }
        
        // Create product
        const result = await db.query(
            `INSERT INTO products (seller_id, name, description, price, category_id, attributes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [sellerId, name, description, price, categoryId, attributes || {}]
        );
        
        const product = result.rows[0];
        
        // Index in Elasticsearch
        await indexProductInElasticsearch(product.id);
        
        // Send event to Kafka
        if (kafkaProducer) {
            await safeKafkaSend({
                topic: TOPICS.PRODUCT_EVENTS,
                messages: [{
                    key: product.id.toString(),
                    value: JSON.stringify({
                        eventType: 'PRODUCT_CREATED',
                        productId: product.id,
                        sellerId: sellerId,
                        name: name,
                        price: price,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        }
        
        res.status(201).json(product);
        
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// ========== UPDATE PRODUCT ==========
app.put('/api/v1/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const sellerId = req.headers['x-user-id'];
        const { name, description, price, categoryId, attributes, isActive } = req.body;
        
        // Check if product belongs to seller (or admin)
        const checkResult = await db.query(
            'SELECT seller_id FROM products WHERE id = $1',
            [productId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = checkResult.rows[0];
        const userRole = req.headers['x-user-role'];
        
        if (product.seller_id !== parseInt(sellerId) && userRole !== 'admin') {
            return res.status(403).json({ error: 'You can only update your own products' });
        }
        
        // Update product
        const updateResult = await db.query(
            `UPDATE products 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 price = COALESCE($3, price),
                 category_id = COALESCE($4, category_id),
                 attributes = COALESCE($5, attributes),
                 is_active = COALESCE($6, is_active),
                 updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [name, description, price, categoryId, attributes, isActive, productId]
        );
        
        const updatedProduct = updateResult.rows[0];
        
        // Invalidate cache
        await redis.del(`product:${productId}`);
        
        // Re-index in Elasticsearch
        await indexProductInElasticsearch(productId);
        
        // Send update event
        if (kafkaProducer) {
            await safeKafkaSend({
                topic: TOPICS.PRODUCT_EVENTS,
                messages: [{
                    key: productId.toString(),
                    value: JSON.stringify({
                        eventType: 'PRODUCT_UPDATED',
                        productId: productId,
                        changes: { name, description, price },
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        }
        
        res.json(updatedProduct);
        
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// ========== DELETE PRODUCT ==========
app.delete('/api/v1/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const sellerId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        
        // Check ownership
        const checkResult = await db.query(
            'SELECT seller_id FROM products WHERE id = $1',
            [productId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = checkResult.rows[0];
        
        if (product.seller_id !== parseInt(sellerId) && userRole !== 'admin') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        
        // Soft delete (just mark inactive)
        await db.query(
            'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
            [productId]
        );
        
        // Invalidate cache
        await redis.del(`product:${productId}`);
        
        // Remove from Elasticsearch
        await esClient.delete({
            index: 'products',
            id: productId.toString()
        }).catch(() => {});  // Ignore if not found
        
        res.json({ success: true, message: 'Product deleted' });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ========== GET CATEGORIES ==========
app.get('/api/v1/categories', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM categories ORDER BY name'
        );
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'product-service', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   📦 PRODUCT SERVICE STARTED         ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Database: PostgreSQL               ║
    ║   Search: Elasticsearch              ║
    ║   Cache: Redis                       ║
    ╚══════════════════════════════════════╝
    `);
});
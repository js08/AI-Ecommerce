// Imports the Express framework for building the web API
const express = require('express');
// Imports the Redis client to handle high-speed data caching
const redis = require('redis');
// Imports your local database configuration (the Pool we discussed earlier)
const db = require('./db');
// Imports Opossum, a library used to stop making requests to a failing service
const CircuitBreaker = require('opossum');

// Initializes the Express application instance
const app = express();
// Middleware to automatically parse incoming JSON request bodies
app.use(express.json());

// --- 1. Redis Client Setup ---
// Creates a Redis client using a URL from environment variables or a local default
const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
// Initiates the connection to Redis and logs an error if the connection fails
redisClient.connect().catch(console.error);

// --- 2. Circuit Breaker Setup ---
// Wraps the database query logic in a "breaker" to prevent cascading failures
const breaker = new CircuitBreaker(async (id) => {
    // Standard SQL query to find a product by ID
    const res = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    // Returns the first row found (the product object)
    return res.rows[0];
}, {
    timeout: 3000, // If the DB takes longer than 3 seconds, consider it a failure
    errorThresholdPercentage: 50 // If 50% of requests fail, trip the breaker
});

// --- 3. Optimized Read Route (GET) ---
app.get('/products/:id', async (req, res) => {
    // Extracts the product ID from the URL parameter
    const productId = req.params.id;
    // Creates a unique string to identify this product in the Redis cache
    const cacheKey = `prod:${productId}`;

    try {
        // Check Redis first (fastest)
        const cached = await redisClient.get(cacheKey);
        // If found, parse the string back into JSON and send it
        if (cached) return res.json(JSON.parse(cached));

        // If not in cache, call the database through the Circuit Breaker
        const product = await breaker.fire(productId);

        if (product) {
            // Store the result in Redis for 1 hour (3600 seconds)
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(product));
            return res.json(product);
        }
        // Send 404 if product doesn't exist
        res.status(404).json({ error: "Product not found" });
    } catch (err) {
        // Send 503 if the DB is down or the Breaker is "Open"
        res.status(503).json({ error: "Service temporarily unavailable" });
    }
});

// --- 4. Update Route with Cache Invalidation (PUT) ---
app.put('/products/:id', async (req, res) => {
    const productId = req.params.id;
    const { name, price } = req.body; // Extract new data from request body
    const cacheKey = `prod:${productId}`;

    try {
        // Step 1: Update the database
        await db.query(
            'UPDATE products SET name = $1, price = $2 WHERE id = $3',
            [name, price, productId]
        );

        // Step 2: Invalidate the cache (Delete the old data from Redis)
        // This forces the next GET request to fetch the fresh data from the DB
        await redisClient.del(cacheKey);

        res.json({ message: "Product updated and cache cleared" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// --- 5. Server Initialization ---
// Simple health check endpoint for monitoring tools
app.get('/health', (req, res) => res.status(200).send("Healthy"));
// Starts the server on port 3001
app.listen(3001, () => console.log('Product Service active on 3001'));
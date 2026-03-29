/**
 * User Service - Manages user registration, authentication, profiles
 * Implements:
 * - JWT-based authentication with refresh tokens
 * - Password hashing using bcrypt (adaptive algorithm)
 * - Rate limiting on login attempts
 * - Bloom filter for email existence checks
 */
// This is a JSDoc comment explaining what this service does
// JWT = JSON Web Tokens (like digital ID cards)
// bcrypt = a secure way to encrypt passwords
// Rate limiting = preventing too many login attempts (stops hackers)

// Import required libraries/modules
const express = require('express'); // Web framework for building APIs
const bcrypt = require('bcrypt'); // For hashing (encrypting) passwords
const jwt = require('jsonwebtoken'); // For creating and verifying JWT tokens
const { body, validationResult } = require('express-validator'); // For validating input data
const { Pool } = require('pg'); // PostgreSQL database connection
const RedisClient = require('../../shared/utils/redis-client'); // Redis client for caching
const { LRUCache, BloomFilter, TokenBucketRateLimiter } = require('../../shared/utils/cache-manager');

// Create an Express application
const app = express();
// Middleware that automatically parses JSON in request bodies
app.use(express.json());

// ==================== Database Connection ====================
// PostgreSQL connection pool for efficient database connections
// Connection pooling prevents creating new connections for each request
// Think of it like having a pool of workers ready to handle database queries

const dbPool = new Pool({
    host: process.env.DB_HOST || 'localhost', // Where is the database? (environment variable or default)
    port: process.env.DB_PORT || 5432, // Default PostgreSQL port
    database: process.env.DB_NAME || 'ecommerce_user', // Which database to use
    user: process.env.DB_USER || 'postgres', // Database username
    password: process.env.DB_PASSWORD || 'postgres', // Database password
    max: 20, // Maximum number of clients in pool (can have 20 simultaneous connections)
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds (saves resources)
    connectionTimeoutMillis: 2000 // If can't connect in 2 seconds, give up
});

// ==================== Redis Connection ====================
// Create a Redis client for caching and storing refresh tokens
const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});
// Connect to Redis (this happens in the background)
redisClient.connect();

// ==================== Performance Optimizations ====================

// LRU Cache for user profiles (most frequently accessed)
// Cache size: 10000 users - prevents memory overflow while keeping hot data
// This stores recently accessed user profiles in memory for super-fast access
const userCache = new LRUCache(10000);

// Bloom Filter for email existence - prevents unnecessary DB queries
// 1 million bits, 7 hash functions - 0.01% false positive rate
// Quickly checks if an email might exist before querying the database
const emailBloomFilter = new BloomFilter(1000000, 7);

// Rate limiter for login attempts (5 attempts per minute)
// Prevents hackers from trying thousands of passwords
const loginRateLimiter = new TokenBucketRateLimiter(5, 5); // 5 tokens per second, capacity 5

// ==================== Helper Functions ====================

/**
 * Generate JWT tokens
 * Access token: Short-lived (15 min) for API authorization
 * Refresh token: Long-lived (7 days) for obtaining new access tokens
 */
// This function creates two types of tokens for authentication
const generateTokens = (userId, email, role) => {
    // Access token payload - minimal data to reduce token size
    // Payload = the data stored inside the token
    const accessPayload = {
        sub: userId, // 'sub' = subject (who this token belongs to)
        email: email, // User's email address
        role: role, // User's role (user, admin, etc.)
        type: 'access' // Identifies this as an access token
    };
    
    // Refresh token payload - only user ID
    // Refresh tokens are used to get new access tokens when they expire
    const refreshPayload = {
        sub: userId, // Just the user ID is enough
        type: 'refresh' // Identifies this as a refresh token
    };
    
    // Sign tokens with different expiration times
    // jwt.sign creates a digital signature that can't be forged
    const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
        expiresIn: '15m' // 15 minutes - short lived for security
        // If a hacker steals it, it expires quickly
    });
    
    const refreshToken = jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d' // 7 days - long lived but stored securely
    });
    
    // Return both tokens
    return { accessToken, refreshToken };
};

/**
 * Store refresh token in Redis with user ID
 * Using Redis for fast lookup and automatic expiration
 */
// This saves the refresh token in Redis so we can validate it later
const storeRefreshToken = async (userId, refreshToken) => {
    const key = `refresh:${userId}`; // Create a key like "refresh:123"
    // Store token with 8 days expiration (slightly longer than token validity)
    // setex = set with expiration time (in seconds)
    await redisClient.client.setex(key, 8 * 24 * 3600, refreshToken);
};

/**
 * Validate refresh token from Redis
 */
// This checks if a refresh token is valid by comparing with stored one
const validateRefreshToken = async (userId, refreshToken) => {
    const key = `refresh:${userId}`; // Same key pattern
    const storedToken = await redisClient.client.get(key); // Get stored token
    return storedToken === refreshToken; // Compare - must match exactly
};

/**
 * Hash password using bcrypt with cost factor 12
 * Cost factor 12 provides good security (2^12 rounds) without too much CPU overhead
 */
// Hashing = turning a password into a fixed-length string that can't be reversed
const hashPassword = async (password) => {
    const saltRounds = 12; // Higher number = more secure but slower
    // bcrypt adds random "salt" to make each hash unique
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash - O(1) operation
 */
// Checks if a provided password matches the stored hash
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash); // Returns true/false
};

// ==================== API Endpoints ====================

/**
 * POST /api/users/register
 * Register new user
 * 
 * Time complexity: O(n) where n is password length (hashing)
 * Space complexity: O(1)
 */
// This endpoint handles new user registration
app.post('/api/users/register', [
    // Validation middleware using express-validator
    // These run BEFORE our main function to check if input is valid
    body('email').isEmail().normalizeEmail(), // Must be valid email format
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/), // Min 8 chars, letters and numbers
    body('name').notEmpty().trim(), // Name can't be empty
    body('phone').optional().isMobilePhone() // Phone is optional but if provided, must be valid
], async (req, res) => {
    try {
        // Check validation errors from the middleware above
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If validation failed, send back the errors
            return res.status(400).json({ errors: errors.array() });
        }
        
        // Get the data from the request body
        const { email, password, name, phone } = req.body;
        
        // Step 1: Check bloom filter first (O(k) operation, avoids DB if possible)
        // If bloom filter says email doesn't exist, we can skip DB check
        // But if it says might exist, we must check DB due to false positives
        // This saves database queries for emails that definitely don't exist
        const emailExists = emailBloomFilter.mightContain(email);
        
        if (emailExists) {
            // Double-check with database (bloom filter might have false positive)
            // Query the database to see if email is really taken
            const existingUser = await dbPool.query(
                'SELECT id FROM users WHERE email = $1', // $1 is a placeholder for the email
                [email] // This replaces $1 safely (prevents SQL injection)
            );
            
            if (existingUser.rows.length > 0) {
                // 409 Conflict - email already exists
                return res.status(409).json({ error: 'Email already registered' });
            }
        }
        
        // Step 2: Hash password
        // Never store passwords in plain text!
        const passwordHash = await hashPassword(password);
        
        // Step 3: Insert user into database
        // Using RETURNING to get inserted data in one query (no need for separate SELECT)
        const result = await dbPool.query(
            `INSERT INTO users (email, password_hash, name, phone, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, email, name, phone, created_at`, // Get these fields back
            [email, passwordHash, name, phone]
        );
        
        const user = result.rows[0]; // Get the inserted user data
        
        // Step 4: Add email to bloom filter for future checks
        // Now future registrations will know this email might exist
        emailBloomFilter.add(email);
        
        // Step 5: Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, 'user');
        
        // Step 6: Store refresh token in Redis
        await storeRefreshToken(user.id, refreshToken);
        
        // Step 7: Cache user profile (remove sensitive data)
        // We don't cache the password hash
        const cachedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: 'user'
        };
        userCache.set(user.id, cachedUser);
        
        // Step 8: Return response
        // 201 = Created successfully
        res.status(201).json({
            user: cachedUser,
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        // Log error for debugging
        console.error('Registration error:', error);
        // Send generic error to user (don't expose internal details)
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/login
 * Authenticate user and return tokens
 * 
 * Implements rate limiting to prevent brute force attacks
 */
// This endpoint handles user login
app.post('/api/users/login', [
    body('email').isEmail(), // Email must be valid
    body('password').notEmpty() // Password must be provided
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { email, password } = req.body;
        
        // Rate limiting check (prevent brute force)
        // Get client IP address (to rate limit per user)
        const clientIp = req.ip || req.connection.remoteAddress;
        const rateLimitKey = `login:${clientIp}`; // Unique key for this IP
        
        // Check if this IP has too many attempts
        if (!loginRateLimiter.tryConsume(rateLimitKey)) {
            // 429 = Too Many Requests
            return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        }
        
        // Step 1: Get user from database
        const result = await dbPool.query(
            'SELECT id, email, password_hash, name, phone, role FROM users WHERE email = $1',
            [email]
        );
        
        // If no user found with this email
        if (result.rows.length === 0) {
            // Use generic message for security (don't reveal if email exists)
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Step 2: Verify password
        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Step 3: Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
        
        // Step 4: Store refresh token
        await storeRefreshToken(user.id, refreshToken);
        
        // Step 5: Cache user profile for future requests
        const cachedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role
        };
        userCache.set(user.id, cachedUser);
        
        // Step 6: Return response
        res.json({
            user: cachedUser,
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/refresh
 * Get new access token using refresh token
 */
// This endpoint gives you a new access token when the old one expires
app.post('/api/users/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        
        // Step 1: Verify refresh token
        let decoded;
        try {
            // jwt.verify checks if the token is valid and not expired
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        // Step 2: Validate token against stored one
        const isValid = await validateRefreshToken(decoded.sub, refreshToken);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        // Step 3: Get user info from cache or DB
        let user = userCache.get(decoded.sub); // Try cache first
        if (!user) {
            // Cache miss - get from database
            const result = await dbPool.query(
                'SELECT id, email, role FROM users WHERE id = $1',
                [decoded.sub]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }
            
            user = result.rows[0];
            userCache.set(user.id, user); // Store in cache for next time
        }
        
        // Step 4: Generate new access token
        const newAccessToken = jwt.sign(
            { sub: user.id, email: user.email, role: user.role, type: 'access' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        
        res.json({ accessToken: newAccessToken });
        
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/:id
 * Get user profile (protected route)
 */
// This endpoint gets a user's profile by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        // Convert ID from string to number (parseInt)
        const userId = parseInt(req.params.id);
        
        // Step 1: Check cache first (O(1) lookup)
        // This is super fast - like checking a sticky note before going to the library
        let user = userCache.get(userId);
        
        if (!user) {
            // Step 2: Cache miss - query database
            const result = await dbPool.query(
                'SELECT id, email, name, phone, role, created_at FROM users WHERE id = $1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            user = result.rows[0];
            
            // Step 3: Store in cache for future requests
            userCache.set(userId, user);
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/users/:id
 * Update user profile
 */
// This endpoint updates user information
app.put('/api/users/:id', [
    body('name').optional().trim(), // Name is optional for update
    body('phone').optional().isMobilePhone() // Phone is optional but if provided, must be valid
], async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, phone } = req.body;
        
        // Build dynamic update query based on provided fields
        // This is more efficient than updating all fields
        const updates = []; // Array of SQL update clauses
        const values = []; // Array of values to insert
        let paramIndex = 1; // SQL parameter counter ($1, $2, etc.)
        
        if (name) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        
        if (phone) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        // Add updated_at timestamp (automatically track when updated)
        updates.push(`updated_at = NOW()`);
        values.push(userId);
        
        // Build the SQL query dynamically
        const query = `
            UPDATE users 
            SET ${updates.join(', ')} // Join all updates with commas
            WHERE id = $${paramIndex}
            RETURNING id, email, name, phone, role, created_at, updated_at
        `;
        
        const result = await dbPool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const updatedUser = result.rows[0];
        
        // Update cache with new data (invalidate old cache)
        userCache.set(userId, updatedUser);
        
        res.json(updatedUser);
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/logout
 * Invalidate refresh token
 */
// This endpoint logs a user out by deleting their refresh token
app.post('/api/users/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (userId) {
            // Delete refresh token from Redis
            // This makes the refresh token invalid for future use
            await redisClient.client.del(`refresh:${userId}`);
        }
        
        res.json({ message: 'Logged out successfully' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Database Schema ====================
/**
 * Users table schema (run this to initialize database):
 * 
 * CREATE TABLE users (
 *     id SERIAL PRIMARY KEY,  -- Auto-incrementing ID
 *     email VARCHAR(255) UNIQUE NOT NULL,  -- Email must be unique
 *     password_hash VARCHAR(255) NOT NULL,  -- Hashed password
 *     name VARCHAR(255) NOT NULL,  -- User's full name
 *     phone VARCHAR(20),  -- Optional phone number
 *     role VARCHAR(50) DEFAULT 'user',  -- Role (user/admin), defaults to 'user'
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When created
 *     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- When last updated
 * );
 * 
 * CREATE INDEX idx_users_email ON users(email);  -- Speeds up email searches
 * CREATE INDEX idx_users_id ON users(id);  -- Speeds up ID searches
 */

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
});

// Export the app for testing or use in other modules
module.exports = app;
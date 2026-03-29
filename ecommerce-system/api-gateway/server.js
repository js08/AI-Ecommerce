// Import required packages
const express = require('express');  // Web framework for Node.js
const httpProxy = require('express-http-proxy');  // Forwards requests to microservices
const rateLimit = require('express-rate-limit');  // Prevents abuse by limiting requests
const cors = require('cors');  // Allows web browsers to call APIs from different domains
const Redis = require('ioredis');  // Redis client for caching JWT tokens

// Create Express application
const app = express();

// Create Redis connection (port 6379 is default Redis port)
// Redis stores data in memory (RAM) - much faster than database
const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: (times) => {
        // If Redis disconnects, try to reconnect every 3 seconds
        return Math.min(times * 50, 3000);
    }
});

// Enable CORS - allows your web app to call this API
// Without this, browsers block requests from different domains
app.use(cors());

// Parse JSON bodies in incoming requests
// When client sends JSON, it becomes available in req.body
app.use(express.json());

// Global rate limiting: maximum 1000 requests per 15 minutes per IP
// Prevents DDoS attacks and brute force attempts
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes in milliseconds
    max: 1000,  // Maximum 1000 requests per IP
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,  // Send rate limit info in response headers
    legacyHeaders: false
});

// Apply global rate limiter to ALL routes
app.use(globalLimiter);

// Authentication middleware - verifies JWT tokens
// JWT (JSON Web Token) is like a digital ID card issued after login
const authenticate = async (req, res, next) => {
    // Get token from Authorization header (format: "Bearer TOKEN_HERE")
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    // Extract just the token part (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];
    
    try {
        // Check if token exists in Redis cache
        // We store valid tokens in Redis to allow logout (blacklist)
        const userId = await redis.get(`session:${token}`);
        
        if (!userId) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Attach user ID to request for downstream services
        req.userId = userId;
        next();  // Continue to the next middleware/route handler
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication service error' });
    }
};

// Define microservice proxy configurations
// Each service runs on a different port (like different apartments in a building)

// User Service - handles registration, login, profile management
// Port 3001: Because it's the first microservice
const userServiceProxy = httpProxy('http://localhost:3001', {
    proxyReqBodyDecorator: (bodyContent, srcReq) => {
        // Forward user ID from gateway to service
        if (srcReq.userId) {
            bodyContent.userId = srcReq.userId;
        }
        return bodyContent;
    },
    proxyErrorHandler: (err, res, next) => {
        // If service is down, return friendly error
        console.error('User service error:', err);
        res.status(503).json({ error: 'User service unavailable' });
    }
});

// Product Service - handles product search, details, inventory checks
// Port 3002: Second microservice
const productServiceProxy = httpProxy('http://localhost:3002', {
    proxyErrorHandler: (err, res) => {
        res.status(503).json({ error: 'Product service unavailable' });
    }
});

// Order Service - handles order creation, status updates
// Port 3003: Third microservice
const orderServiceProxy = httpProxy('http://localhost:3003', {
    proxyErrorHandler: (err, res) => {
        res.status(503).json({ error: 'Order service unavailable' });
    }
});

// Public routes (no authentication needed)
app.post('/api/auth/register', userServiceProxy);  // Create new account
app.post('/api/auth/login', userServiceProxy);      // Login to existing account

// Protected routes (require valid JWT token)
app.get('/api/users/profile', authenticate, userServiceProxy);
app.put('/api/users/profile', authenticate, userServiceProxy);

// Product routes (read-only public, write needs auth)
app.get('/api/products', productServiceProxy);      // Search products - public
app.get('/api/products/:id', productServiceProxy);  // Get single product - public
app.post('/api/products', authenticate, productServiceProxy);  // Add product - sellers only

// Order routes (always need authentication)
app.post('/api/orders', authenticate, orderServiceProxy);  // Create new order
app.get('/api/orders/:id', authenticate, orderServiceProxy);  // Get order details
app.get('/api/users/:userId/orders', authenticate, orderServiceProxy);  // User's orders

// Health check endpoint - used by load balancers to check if gateway is alive
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the API Gateway server
const PORT = process.env.PORT || 3000;  // Use environment variable or default 3000
app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`);
    console.log(`📦 User Service proxy: http://localhost:3001`);
    console.log(`📦 Product Service proxy: http://localhost:3002`);
    console.log(`📦 Order Service proxy: http://localhost:3003`);
});
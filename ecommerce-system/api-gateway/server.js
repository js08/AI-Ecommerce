// ============================================
// API GATEWAY - The "Front Door" of our system
// All client requests (web/mobile) go through here first
// ============================================

const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const m = t.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const express = require('express');
const httpProxy = require('express-http-proxy');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');  // Security headers
const compression = require('compression');  // Compress responses (faster transfer)

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8008';

// Initialize Express app
const app = express();

// ============ SECURITY MIDDLEWARE ============

// Helmet adds security headers to prevent common attacks
// XSS protection, clickjacking, MIME sniffing, etc.
app.use(helmet());

// Compress responses (gzip) - reduces bandwidth by 70-90%
app.use(compression());

// Enable CORS for specific origins only (not * in production)
// CORS allows web browsers to call this API from different domains
app.use(cors({
    origin: [
        'https://yourecommerce.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3010',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3010',
        'http://127.0.0.1:3000'
    ],
    credentials: true
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));  // Max 10MB payload

// Parse URL-encoded form data (from HTML forms)
app.use(express.urlencoded({ extended: true }));

// ============ REDIS CONNECTION (for caching and sessions) ============

// Single Redis node (matches docker-compose redis:6379; use REDIS_HOST/REDIS_PORT in Docker)
const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: (times) => Math.min(times * 100, 3000)
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

// ============ RATE LIMITING ============

// Prevent DDoS attacks and API abuse
// Different limits for different endpoints

// Strict limit for login/registration (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,  // Only 5 attempts per 15 minutes
    message: { error: 'Too many login attempts. Please try again later.' },
    keyGenerator: (req) => req.ip  // Track by IP address
});

// Moderate limit for read operations
const readLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,  // 100 requests per minute
    message: { error: 'Too many requests. Slow down!' }
});

// Strict limit for write operations
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 20,  // 20 writes per minute
    message: { error: 'Rate limit exceeded for write operations' }
});

// ============ AUTHENTICATION MIDDLEWARE ============

// Verifies JWT tokens for protected routes
// JWT = JSON Web Token - digital ID card issued after login
const authenticate = async (req, res, next) => {
    // Get token from Authorization header
    // Format: "Bearer eyJhbGciOiJIUzI1NiIs..."
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please provide a valid JWT token' 
        });
    }
    
    // Extract token (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];
    
    try {
        // Check if token exists in Redis (session store)
        // Redis key format: "session:TOKEN_HERE"
        const sessionData = await redis.get(`session:${token}`);
        
        if (!sessionData) {
            return res.status(401).json({ 
                error: 'Invalid or expired session',
                message: 'Please login again' 
            });
        }
        
        // Parse session data (stored as JSON string)
        const session = JSON.parse(sessionData);
        
        // Attach user info to request for downstream services
        req.user = {
            id: session.userId,
            email: session.email,
            role: session.role  // 'user', 'seller', or 'admin'
        };
        
        // Cache the auth result for 5 minutes (performance optimization)
        // This avoids checking Redis for every request from same user
        const cacheKey = `auth:${token}`;
        await redis.setex(cacheKey, 300, JSON.stringify(req.user));
        
        next();  // Proceed to the next middleware or route handler
        
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication service error' });
    }
};

// Optional authentication (for public pages that show personalized content if logged in)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sessionData = await redis.get(`session:${token}`);
        
        if (sessionData) {
            req.user = JSON.parse(sessionData);
        }
    }
    next();  // Continue even if no auth
};

// ============ PROXY CONFIGURATIONS ============

// Proxy: Forwards requests to the appropriate microservice
// Each service runs on a different port

// Helper function to create proxy with timeout and error handling
const createProxy = (targetUrl) => {
    return httpProxy(targetUrl, {
        timeout: 30000,  // 30 seconds timeout
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            // Forward user info from gateway to service
            if (srcReq.user) {
                proxyReqOpts.headers['x-user-id'] = srcReq.user.id;
                proxyReqOpts.headers['x-user-email'] = srcReq.user.email;
                proxyReqOpts.headers['x-user-role'] = srcReq.user.role;
            }
            return proxyReqOpts;
        },
        proxyErrorHandler: (err, res, next) => {
            console.error('Proxy error:', err.message);
            
            // Different error messages based on error type
            if (err.code === 'ECONNREFUSED') {
                res.status(503).json({ 
                    error: 'Service unavailable',
                    message: 'The requested service is temporarily down' 
                });
            } else if (err.code === 'ETIMEDOUT') {
                res.status(504).json({ 
                    error: 'Gateway timeout',
                    message: 'Service took too long to respond' 
                });
            } else {
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: 'An error occurred while processing your request' 
                });
            }
        }
    });
};

// Define all microservice proxies
const userServiceProxy = createProxy('http://localhost:3001');
const productServiceProxy = createProxy('http://localhost:3002');
const cartServiceProxy = createProxy('http://localhost:3003');
const orderServiceProxy = createProxy('http://localhost:3004');
const paymentServiceProxy = createProxy('http://localhost:3005');
const inventoryServiceProxy = createProxy('http://localhost:3006');
const notificationServiceProxy = createProxy('http://localhost:3007');
const aiServiceProxy = createProxy(AI_SERVICE_URL);

// ============ ROUTES ============

// Health check endpoint (used by load balancers and Kubernetes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            redis: redis.status === 'ready' ? 'up' : 'down',
            // Add more service health checks here
        }
    });
});

// ============ USER SERVICE ROUTES ============

// Public routes (no authentication needed)
app.post('/api/v1/auth/register', authLimiter, userServiceProxy);
app.post('/api/v1/auth/login', authLimiter, userServiceProxy);
app.post('/api/v1/auth/refresh-token', userServiceProxy);  // Get new access token
app.post('/api/v1/auth/forgot-password', authLimiter, userServiceProxy);
app.post('/api/v1/auth/reset-password', authLimiter, userServiceProxy);

// Protected user routes (require authentication)
app.get('/api/v1/users/profile', authenticate, userServiceProxy);
app.put('/api/v1/users/profile', authenticate, writeLimiter, userServiceProxy);
app.put('/api/v1/users/change-password', authenticate, writeLimiter, userServiceProxy);
app.post('/api/v1/users/logout', authenticate, userServiceProxy);
app.delete('/api/v1/users/account', authenticate, writeLimiter, userServiceProxy);

// Admin routes (require special role)
app.get('/api/v1/admin/users', authenticate, userServiceProxy);  // Check role in service
app.put('/api/v1/admin/users/:id/role', authenticate, writeLimiter, userServiceProxy);

// ============ PRODUCT SERVICE ROUTES ============

// Public read routes (cached for performance)
app.get('/api/v1/products', optionalAuth, readLimiter, productServiceProxy);
app.get('/api/v1/products/:id', optionalAuth, readLimiter, productServiceProxy);
app.get('/api/v1/products/search', optionalAuth, readLimiter, productServiceProxy);
app.get('/api/v1/categories', productServiceProxy);
app.get('/api/v1/categories/:id/products', productServiceProxy);

// Protected write routes (require authentication)
app.post('/api/v1/products', authenticate, writeLimiter, productServiceProxy);
app.put('/api/v1/products/:id', authenticate, writeLimiter, productServiceProxy);
app.delete('/api/v1/products/:id', authenticate, writeLimiter, productServiceProxy);

// Seller routes (for managing own products)
app.get('/api/v1/seller/products', authenticate, productServiceProxy);
app.put('/api/v1/seller/products/:id/stock', authenticate, writeLimiter, productServiceProxy);

// ============ CART SERVICE ROUTES ============

// All cart routes require authentication
app.get('/api/v1/cart', authenticate, cartServiceProxy);
app.post('/api/v1/cart/items', authenticate, writeLimiter, cartServiceProxy);
app.put('/api/v1/cart/items/:itemId', authenticate, writeLimiter, cartServiceProxy);
app.delete('/api/v1/cart/items/:itemId', authenticate, writeLimiter, cartServiceProxy);
app.delete('/api/v1/cart/clear', authenticate, writeLimiter, cartServiceProxy);

// ============ ORDER SERVICE ROUTES ============

app.post('/api/v1/orders', authenticate, writeLimiter, orderServiceProxy);
app.get('/api/v1/orders', authenticate, orderServiceProxy);
app.get('/api/v1/orders/:id', authenticate, orderServiceProxy);
app.put('/api/v1/orders/:id/cancel', authenticate, writeLimiter, orderServiceProxy);

// ============ PAYMENT SERVICE ROUTES ============

app.post('/api/v1/payments/process', authenticate, writeLimiter, paymentServiceProxy);
app.get('/api/v1/payments/methods', authenticate, paymentServiceProxy);
app.post('/api/v1/payments/methods', authenticate, writeLimiter, paymentServiceProxy);
app.get('/api/v1/payments/history', authenticate, paymentServiceProxy);

// ============ INVENTORY SERVICE ROUTES (Internal use mostly) ============

// These are typically called by other services, not directly by clients
app.get('/api/v1/inventory/check/:productId', inventoryServiceProxy);
app.post('/api/v1/inventory/reserve', inventoryServiceProxy);
app.post('/api/v1/inventory/release', inventoryServiceProxy);

// ============ NOTIFICATION SERVICE ROUTES ============

app.post('/api/v1/notifications/preferences', authenticate, writeLimiter, notificationServiceProxy);
app.get('/api/v1/notifications/history', authenticate, notificationServiceProxy);


// AI Service routes
app.post('/api/ai/chat', authenticate, aiServiceProxy);
app.get('/api/ai/recommendations/:userId', authenticate, aiServiceProxy);
// Multipart forwarded as-is to ai-service (do not parse body here)
app.post('/api/ai/visual-search', authenticate, aiServiceProxy);
app.post('/api/ai/fraud-check', authenticate, aiServiceProxy);
app.post('/api/ai/sentiment', authenticate, aiServiceProxy);
app.get('/api/ai/optimal-price/:productId', authenticate, aiServiceProxy);
app.get('/api/ai/forecast/:productId', authenticate, aiServiceProxy);
app.post('/api/ai/search', authenticate, aiServiceProxy);

// ============ ERROR HANDLING ============

// 404 handler for routes that don't exist
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} does not exist` 
    });
});

// Global error handler (catches any unhandled errors)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: isProduction ? 'Something went wrong' : err.message,
        requestId: req.headers['x-request-id'] || 'unknown'  // For tracing
    });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║     🚀 API GATEWAY STARTED SUCCESSFULLY              ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Port: ${PORT}                                           ║
    ║  Environment: ${process.env.NODE_ENV || 'development'}                           ║
    ║  Redis: ${REDIS_HOST}:${REDIS_PORT}                    ║
    ╚═══════════════════════════════════════════════════════╝
    `);
    
    // Log all registered routes (for debugging)
    console.log('\n📋 Registered Routes:');
    console.log('  POST   /api/v1/auth/register');
    console.log('  POST   /api/v1/auth/login');
    console.log('  GET    /api/v1/users/profile');
    console.log('  GET    /api/v1/products');
    console.log('  GET    /api/v1/cart');
    console.log('  POST   /api/v1/orders');
    console.log('  POST   /api/v1/payments/process');
});
// Imports the Express framework for building the gateway server
const express = require('express');
// Imports the proxy middleware to forward requests to microservices
const { createProxyMiddleware } = require('http-proxy-middleware');
// Imports jsonwebtoken to verify the identity of the user
const jwt = require('jsonwebtoken');

// Initializes the Express application
const app = express();

// A secret key used to sign and verify tokens (keep this in an environment variable!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

// --- Authentication Middleware ---
// This function checks if a request has a valid token before letting it pass
const authenticate = (req, res, next) => {
    // Looks for the 'Authorization' header (usually: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // If no token is provided, block the request with a 401 Unauthorized status
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    // Verifies the token using our secret key
    jwt.verify(token, JWT_SECRET, (err, user) => {
        // If the token is fake or expired, block the request with a 403 Forbidden status
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        
        // Attach the decoded user info to the request object for downstream services
        req.user = user;
        // Move to the next step (which is the proxy)
        next();
    });
};

// --- Proxy Configuration with Auth Protection ---
// We apply the 'authenticate' middleware ONLY to the /products route
app.use('/products', authenticate, createProxyMiddleware({ 
    // Forwards the request to the internal product-service
    target: 'http://product-service:3001', 
    // Rewrites the origin header to match the target service
    changeOrigin: true,
    // Optional: Pass the authenticated user's ID to the microservice in a header
    onProxyReq: (proxyReq, req) => {
        if (req.user) {
            proxyReq.setHeader('X-User-ID', req.user.id);
        }
    }
}));

// Starts the API Gateway on port 8080
app.listen(8080, () => console.log('Secure API Gateway running on 8080'));
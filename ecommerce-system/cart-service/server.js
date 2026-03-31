// ============================================
// CART SERVICE - Manages user shopping carts
// Storage: Redis ONLY (fast, temporary, doesn't need persistence)
// ============================================

const express = require('express');
const Redis = require('ioredis');
const axios = require('axios');  // To fetch product details
const { devCors } = require('../shared/dev-cors');

const app = express();
app.use(devCors());
app.use(express.json());

// ============ REDIS CONNECTION ============
// Cart data is stored in Redis because:
// 1. Very fast (in-memory)
// 2. Cart is temporary (doesn't need to survive database failure)
// 3. High write volume (users add/remove items frequently)

const redis = new Redis({
    host: 'localhost',
    port: 6379,
    keyPrefix: 'cart:'  // All cart keys will have this prefix
});

// ============ HELPER FUNCTIONS ============

// Get cart key for a user
// Redis key format: cart:USER_ID
const getCartKey = (userId) => `user:${userId}`;

// Get cart contents with product details
const getCartWithDetails = async (userId) => {
    const cartKey = getCartKey(userId);
    
    // Get all items from Redis hash
    // Hash is like a JavaScript object stored in Redis
    const cartItems = await redis.hgetall(cartKey);
    
    if (Object.keys(cartItems).length === 0) {
        return { items: [], totalItems: 0, totalPrice: 0 };
    }
    
    const items = [];
    let totalPrice = 0;
    let totalItems = 0;
    
    // For each item in cart, fetch product details
    for (const [productId, quantityStr] of Object.entries(cartItems)) {
        const quantity = parseInt(quantityStr);
        totalItems += quantity;
        
        try {
            // Call Product Service to get product details
            // In production, cache this or batch requests
            const productResponse = await axios.get(
                `http://localhost:3002/api/v1/products/${productId}`,
                { timeout: 5000 }
            );
            
            const product = productResponse.data;
            const itemTotal = product.price * quantity;
            totalPrice += itemTotal;
            
            items.push({
                productId: parseInt(productId),
                name: product.name,
                price: parseFloat(product.price),
                quantity: quantity,
                total: itemTotal,
                image: product.images ? product.images[0] : null
            });
        } catch (error) {
            console.error(`Failed to fetch product ${productId}:`, error.message);
            // If product fetch fails, still include item with basic info
            items.push({
                productId: parseInt(productId),
                quantity: quantity,
                error: 'Product details unavailable'
            });
        }
    }
    
    return {
        items: items,
        totalItems: totalItems,
        totalPrice: totalPrice
    };
};

// ============ API ROUTES ============

// ========== GET CART ==========
app.get('/api/v1/cart', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const cart = await getCartWithDetails(userId);
        
        res.json(cart);
        
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to get cart' });
    }
});

// ========== ADD TO CART ==========
app.post('/api/v1/cart/items', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { productId, quantity = 1 } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        
        if (quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }
        
        // Verify product exists (call Product Service)
        try {
            const productResponse = await axios.get(
                `http://localhost:3002/api/v1/products/${productId}`,
                { timeout: 5000 }
            );
            
            if (!productResponse.data || !productResponse.data.is_active) {
                return res.status(404).json({ error: 'Product not available' });
            }
        } catch (error) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const cartKey = getCartKey(userId);
        
        // Add to cart (increment quantity if already exists)
        // HINCRBY: Increment field in hash by amount
        const newQuantity = await redis.hincrby(cartKey, productId.toString(), quantity);
        
        // Set expiry on cart (7 days of inactivity)
        await redis.expire(cartKey, 604800);  // 7 days in seconds
        
        const updatedCart = await getCartWithDetails(userId);
        
        res.json({
            success: true,
            message: 'Item added to cart',
            cart: updatedCart
        });
        
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add item to cart' });
    }
});

// ========== UPDATE CART ITEM QUANTITY ==========
app.put('/api/v1/cart/items/:productId', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const productId = req.params.productId;
        const { quantity } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        if (quantity === undefined || quantity < 0) {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }
        
        const cartKey = getCartKey(userId);
        
        if (quantity === 0) {
            // Remove item from cart
            await redis.hdel(cartKey, productId);
        } else {
            // Update quantity
            await redis.hset(cartKey, productId, quantity);
        }
        
        const updatedCart = await getCartWithDetails(userId);
        
        res.json({
            success: true,
            cart: updatedCart
        });
        
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// ========== REMOVE FROM CART ==========
app.delete('/api/v1/cart/items/:productId', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const productId = req.params.productId;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const cartKey = getCartKey(userId);
        
        // Remove item from hash
        await redis.hdel(cartKey, productId);
        
        const updatedCart = await getCartWithDetails(userId);
        
        res.json({
            success: true,
            message: 'Item removed from cart',
            cart: updatedCart
        });
        
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

// ========== CLEAR CART ==========
app.delete('/api/v1/cart/clear', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const cartKey = getCartKey(userId);
        
        // Delete entire cart
        await redis.del(cartKey);
        
        res.json({
            success: true,
            message: 'Cart cleared',
            cart: { items: [], totalItems: 0, totalPrice: 0 }
        });
        
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});

// ========== CART SUMMARY (for checkout) ==========
app.get('/api/v1/cart/summary', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const cart = await getCartWithDetails(userId);
        
        // Return only summary (no item details)
        res.json({
            totalItems: cart.totalItems,
            totalPrice: cart.totalPrice,
            itemCount: cart.items.length
        });
        
    } catch (error) {
        console.error('Cart summary error:', error);
        res.status(500).json({ error: 'Failed to get cart summary' });
    }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'cart-service', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   🛒 CART SERVICE STARTED            ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Storage: Redis (in-memory)         ║
    ║   TTL: 7 days                        ║
    ╚══════════════════════════════════════╝
    `);
});
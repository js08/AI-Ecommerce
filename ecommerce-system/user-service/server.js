// ============================================
// USER SERVICE - Handles user accounts, authentication, profiles
// Database: PostgreSQL (for ACID compliance)
// Cache: Redis (for sessions)
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { createProducer, TOPICS } = require('../shared/kafka-config');
const validator = require('validator');  // Email validation
const crypto = require('crypto');  // For generating reset tokens
const { devCors } = require('../shared/dev-cors');

const app = express();
app.use(devCors());
app.use(express.json());

// ============ DATABASE CONNECTION ============

// PostgreSQL connection pool
// Pool manages multiple database connections efficiently
const db = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ecommerce_main',
    user: 'ecommerce_user',
    password: 'secure_password_123',
    max: 20,              // Maximum 20 connections in pool
    idleTimeoutMillis: 30000,  // Close idle connections after 30s
    connectionTimeoutMillis: 2000  // Fail fast if can't connect
});

// Test database connection on startup (do not exit — allow /health while DB comes up)
db.connect((err, client, release) => {
    if (err) {
        console.error('❌ Database connection failed:', err.stack);
        console.warn('⚠️ User service continues; auth routes need PostgreSQL.');
    } else {
        console.log('✅ PostgreSQL connected');
        release();
    }
});

// ============ DATABASE SCHEMA INITIALIZATION ============

const initDatabase = async () => {
    // Create users table
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            phone_number VARCHAR(20),
            role VARCHAR(50) DEFAULT 'user',  -- user, seller, admin
            email_verified BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    `);
    
    // Create refresh tokens table (for longer-lived sessions)
    await db.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(500) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create password reset tokens table
    await db.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Database tables ready');
    
    // Create indexes for performance (makes queries faster)
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
};

initDatabase().catch((e) => console.error('initDatabase:', e.message));

// ============ REDIS CONNECTION (Session Storage) ============

const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: (times) => {
        // Exponential backoff: 100ms, 200ms, 400ms...
        return Math.min(times * 100, 3000);
    }
});

// ============ KAFKA SETUP ============

let kafkaProducer = null;

const setupKafka = async () => {
    try {
        kafkaProducer = await createProducer('user-service');
        console.log('✅ Kafka producer ready');
    } catch (e) {
        console.warn('⚠️ Kafka unavailable (events disabled):', e.message);
        kafkaProducer = null;
    }
};

setupKafka().catch((e) => console.warn('Kafka setup:', e.message));

// ============ HELPER FUNCTIONS ============

// Hash password - converts plain text to encrypted string
// bcrypt adds "salt" (random data) - same password produces different hashes
const hashPassword = async (password) => {
    const saltRounds = 12;  // Higher = more secure but slower (12 is good balance)
    return await bcrypt.hash(password, saltRounds);
};

// Compare plain password with stored hash
const comparePassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};

// Generate JWT access token (short-lived: 15 minutes)
const generateAccessToken = (userId, email, role) => {
    const payload = {
        userId: userId,
        email: email,
        role: role,
        type: 'access'
    };
    
    const secret = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
    const expiresIn = '15m';  // 15 minutes - short for security
    
    return jwt.sign(payload, secret, { expiresIn });
};

// Generate refresh token (long-lived: 7 days)
const generateRefreshToken = async (userId) => {
    // Generate random token string (not JWT for refresh tokens)
    const token = crypto.randomBytes(40).toString('hex');
    
    // Store in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);  // 7 days from now
    
    await db.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, token, expiresAt]
    );
    
    return token;
};

// Validate email format
const isValidEmail = (email) => {
    return validator.isEmail(email);
};

// Validate password strength
const isStrongPassword = (password) => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
};

// ============ API ROUTES ============

// ========== REGISTRATION ==========
app.post('/api/v1/auth/register', async (req, res) => {
    try {
        const { email, password, fullName, phoneNumber } = req.body;
        
        // Input validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Validation Error',
                message: 'Email and password are required' 
            });
        }
        
        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ 
                error: 'Invalid email',
                message: 'Please provide a valid email address' 
            });
        }
        
        // Validate password strength
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
            });
        }
        
        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ 
                error: 'User exists',
                message: 'An account with this email already exists' 
            });
        }
        
        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, phone_number)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, full_name, phone_number, role, created_at`,
            [email, hashedPassword, fullName, phoneNumber]
        );
        
        const newUser = result.rows[0];
        
        // Generate tokens
        const accessToken = generateAccessToken(newUser.id, newUser.email, newUser.role);
        const refreshToken = await generateRefreshToken(newUser.id);
        
        // Store session in Redis (for quick validation)
        const sessionData = {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            createdAt: new Date().toISOString()
        };
        
        // Store with 15 minute expiry (matches access token)
        await redis.setex(`session:${accessToken}`, 900, JSON.stringify(sessionData));
        
        // Send welcome email via Kafka (async)
        if (kafkaProducer) {
            await kafkaProducer.send({
                topic: TOPICS.NOTIFICATION_EVENTS,
                messages: [{
                    key: newUser.id.toString(),
                    value: JSON.stringify({
                        eventType: 'USER_REGISTERED',
                        userId: newUser.id,
                        email: newUser.email,
                        fullName: newUser.full_name,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        }
        
        // Don't return password hash to client
        delete newUser.password_hash;
        
        res.status(201).json({
            success: true,
            user: newUser,
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: 900  // 15 minutes in seconds
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ========== LOGIN ==========
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Missing credentials',
                message: 'Email and password are required' 
            });
        }
        
        // Find user by email
        const result = await db.query(
            `SELECT id, email, password_hash, full_name, role, is_active 
             FROM users WHERE email = $1`,
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Email or password is incorrect' 
            });
        }
        
        const user = result.rows[0];
        
        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                error: 'Account disabled',
                message: 'This account has been disabled. Please contact support.'
            });
        }
        
        // Verify password
        const isValid = await comparePassword(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Email or password is incorrect' 
            });
        }
        
        // Update last login time
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );
        
        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.email, user.role);
        const refreshToken = await generateRefreshToken(user.id);
        
        // Store session in Redis
        const sessionData = {
            userId: user.id,
            email: user.email,
            role: user.role,
            loginAt: new Date().toISOString()
        };
        
        await redis.setex(`session:${accessToken}`, 900, JSON.stringify(sessionData));
        
        // Send login event to Kafka (for analytics)
        if (kafkaProducer) {
            await kafkaProducer.send({
                topic: TOPICS.USER_EVENTS,
                messages: [{
                    key: user.id.toString(),
                    value: JSON.stringify({
                        eventType: 'USER_LOGIN',
                        userId: user.id,
                        email: user.email,
                        timestamp: new Date().toISOString(),
                        ip: req.ip
                    })
                }]
            });
        }
        
        // Return user data (without sensitive info)
        const userData = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        };
        
        res.json({
            success: true,
            user: userData,
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: 900
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ========== REFRESH TOKEN ==========
app.post('/api/v1/auth/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        
        // Find refresh token in database
        const result = await db.query(
            `SELECT rt.*, u.id as user_id, u.email, u.role 
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token = $1 AND rt.used = FALSE AND rt.expires_at > NOW()`,
            [refreshToken]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        
        const tokenData = result.rows[0];
        
        // Mark this refresh token as used (one-time use)
        await db.query(
            'UPDATE refresh_tokens SET used = TRUE WHERE id = $1',
            [tokenData.id]
        );
        
        // Generate new tokens
        const newAccessToken = generateAccessToken(tokenData.user_id, tokenData.email, tokenData.role);
        const newRefreshToken = await generateRefreshToken(tokenData.user_id);
        
        // Store new session
        const sessionData = {
            userId: tokenData.user_id,
            email: tokenData.email,
            role: tokenData.role
        };
        
        await redis.setex(`session:${newAccessToken}`, 900, JSON.stringify(sessionData));
        
        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 900
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// ========== GET PROFILE ==========
app.get('/api/v1/users/profile', async (req, res) => {
    try {
        // User ID is added by API Gateway in header
        const userId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const result = await db.query(
            `SELECT id, email, full_name, phone_number, role, email_verified, 
                    created_at, last_login
             FROM users WHERE id = $1 AND is_active = TRUE`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ========== UPDATE PROFILE ==========
app.put('/api/v1/users/profile', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { fullName, phoneNumber } = req.body;
        
        const result = await db.query(
            `UPDATE users 
             SET full_name = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, email, full_name, phone_number, role`,
            [fullName, phoneNumber, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ========== CHANGE PASSWORD ==========
app.put('/api/v1/users/change-password', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { currentPassword, newPassword } = req.body;
        
        // Get current password hash
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isValid = await comparePassword(currentPassword, result.rows[0].password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Validate new password strength
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'Password must meet security requirements'
            });
        }
        
        // Hash and update new password
        const newHashedPassword = await hashPassword(newPassword);
        
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHashedPassword, userId]
        );
        
        // Invalidate all sessions (force re-login)
        // This is a security measure after password change
        // In production, you'd delete all Redis sessions for this user
        
        res.json({ success: true, message: 'Password changed successfully' });
        
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ========== LOGOUT ==========
app.post('/api/v1/users/logout', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        // Delete session from Redis
        await redis.del(`session:${token}`);
        
        // Also delete associated refresh tokens (optional)
        // This would require knowing the user ID
        
        res.json({ success: true, message: 'Logged out successfully' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ========== FORGOT PASSWORD ==========
app.post('/api/v1/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user by email
        const result = await db.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            // Don't reveal that email doesn't exist (security)
            return res.json({ 
                success: true, 
                message: 'If an account exists, a reset link will be sent' 
            });
        }
        
        const user = result.rows[0];
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);  // 1 hour expiry
        
        // Store reset token
        await db.query(
            `INSERT INTO password_resets (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, resetToken, expiresAt]
        );
        
        // Send reset email via Kafka
        if (kafkaProducer) {
            await kafkaProducer.send({
                topic: TOPICS.NOTIFICATION_EVENTS,
                messages: [{
                    key: user.id.toString(),
                    value: JSON.stringify({
                        eventType: 'PASSWORD_RESET_REQUESTED',
                        userId: user.id,
                        email: user.email,
                        resetToken: resetToken,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Password reset link sent to your email',
            // In development, return token for testing
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// ========== RESET PASSWORD ==========
app.post('/api/v1/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        // Validate token
        const result = await db.query(
            `SELECT user_id FROM password_resets 
             WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        const userId = result.rows[0].user_id;
        
        // Validate new password
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'Password must meet security requirements'
            });
        }
        
        // Update password
        const hashedPassword = await hashPassword(newPassword);
        
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, userId]
        );
        
        // Mark token as used
        await db.query(
            'UPDATE password_resets SET used = TRUE WHERE token = $1',
            [token]
        );
        
        // Invalidate all refresh tokens for this user
        await db.query(
            'DELETE FROM refresh_tokens WHERE user_id = $1',
            [userId]
        );
        
        res.json({ success: true, message: 'Password reset successfully' });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   👤 USER SERVICE STARTED            ║
    ╠══════════════════════════════════════╣
    ║   Port: ${PORT}                         ║
    ║   Database: PostgreSQL               ║
    ║   Cache: Redis                       ║
    ╚══════════════════════════════════════╝
    `);
});
const express = require('express');
const bcrypt = require('bcrypt');  // Hashes passwords (one-way encryption)
const jwt = require('jsonwebtoken');  // Creates and verifies JWT tokens
const { Pool } = require('pg');  // PostgreSQL database client
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');  // Kafka client for event streaming

const app = express();
app.use(express.json());

// ============ DATABASE SETUP (PostgreSQL) ============
// PostgreSQL is a relational database - good for structured data like users
// Each user has an ID, email, password hash, etc.
const db = new Pool({
    host: 'localhost',
    port: 5432,      // Default PostgreSQL port
    database: 'ecommerce',
    user: 'postgres',
    password: 'password',
    max: 20,  // Maximum 20 database connections at once
});

// Create users table if it doesn't exist
// SQL (Structured Query Language) commands to define table structure
const initDatabase = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,           -- Auto-incrementing ID
            email VARCHAR(255) UNIQUE NOT NULL,  -- Email must be unique
            password_hash VARCHAR(255) NOT NULL, -- Hashed password (not plain text)
            full_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    try {
        await db.query(createTableQuery);
        console.log('✅ Users table ready');
    } catch (error) {
        console.error('Database init error:', error);
    }
};
initDatabase();

// ============ REDIS CACHE SETUP ============
// Redis stores active sessions for fast lookup
const redis = new Redis({ host: 'localhost', port: 6379 });

// ============ KAFKA SETUP ============
// Kafka is a message broker - sends events between services
// Events are like "user just registered" or "user updated profile"
const kafka = new Kafka({
    clientId: 'user-service',
    brokers: ['localhost:9092']  // Kafka runs on port 9092
});

const producer = kafka.producer();  // For sending events
const connectKafka = async () => {
    await producer.connect();
    console.log('✅ Kafka producer connected');
};
connectKafka();

// ============ HELPER FUNCTIONS ============

// Hash password - converts plain text to encrypted string
// bcrypt adds "salt" (random data) to prevent rainbow table attacks
const hashPassword = async (password) => {
    const saltRounds = 10;  // Higher = more secure but slower
    return await bcrypt.hash(password, saltRounds);
};

// Compare plain password with stored hash
const verifyPassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};

// Generate JWT token - digital ID card for authenticated users
// JWT contains user ID and expires in 24 hours
const generateToken = (userId) => {
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const expiresIn = '24h';  // Token valid for 24 hours
    
    // jwt.sign creates a token with the payload (userId)
    return jwt.sign({ userId }, secret, { expiresIn });
};

// ============ API ROUTES ============

// REGISTER - Create new user account
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;
        
        // Validation: Check if required fields are present
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        // Hash password before storing (never store plain passwords!)
        const hashedPassword = await hashPassword(password);
        
        // Insert new user into database
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name) 
             VALUES ($1, $2, $3) RETURNING id, email, full_name, created_at`,
            [email, hashedPassword, fullName]
        );
        
        const newUser = result.rows[0];
        
        // Generate JWT token for auto-login after registration
        const token = generateToken(newUser.id);
        
        // Store session in Redis (for logout functionality)
        // Key: session:TOKEN, Value: userId, Expires: 24 hours
        await redis.setex(`session:${token}`, 86400, newUser.id);
        
        // Send event to Kafka - other services need to know about new user
        // This allows notification service to send welcome email
        await producer.send({
            topic: 'user-events',  // Kafka topic name (like a channel)
            messages: [
                {
                    key: newUser.id.toString(),
                    value: JSON.stringify({
                        eventType: 'USER_REGISTERED',
                        userId: newUser.id,
                        email: newUser.email,
                        fullName: newUser.full_name,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
        
        // Return user data and token (don't return password hash!)
        res.status(201).json({
            user: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.full_name,
                createdAt: newUser.created_at
            },
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// LOGIN - Authenticate existing user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email
        const result = await db.query(
            'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate token for this session
        const token = generateToken(user.id);
        
        // Store session in Redis
        await redis.setex(`session:${token}`, 86400, user.id);
        
        // Send login event to Kafka
        await producer.send({
            topic: 'user-events',
            messages: [
                {
                    key: user.id.toString(),
                    value: JSON.stringify({
                        eventType: 'USER_LOGIN',
                        userId: user.id,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name
            },
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET PROFILE - Get authenticated user's data
app.get('/api/users/profile', async (req, res) => {
    try {
        // userId is added by API Gateway
        const userId = req.body.userId;
        
        const result = await db.query(
            'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// LOGOUT - Invalidate user's token
app.post('/api/auth/logout', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        // Delete session from Redis - token is no longer valid
        await redis.del(`session:${token}`);
        
        res.json({ message: 'Logged out successfully' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start user service on port 3001
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`👤 User Service running on port ${PORT}`);
});
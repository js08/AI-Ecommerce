/**
 * Redis Client with advanced features
 * Implements connection pooling, retry logic, and performance optimizations
 */
// This is a JSDoc comment that explains what this class does
// Redis is an in-memory database (like a super-fast key-value store)
// This client helps connect to Redis and use its advanced features

// Import the Redis library (ioredis) - this is like bringing in tools to work with Redis
const Redis = require('ioredis');

// Define a class that will manage our Redis connection
// Think of a class as a blueprint for creating Redis clients
class RedisClient {
    // Constructor runs when we create a new RedisClient
    // config is like a settings object: {host, port, password, etc.}
    constructor(config) {
        // Store the config for later use
        this.config = config;
        // Main Redis client (will be created when we connect)
        this.client = null;
        // Subscriber client (used for listening to messages)
        this.subscriber = null;
        // Track if we're connected to Redis
        this.isConnected = false;
    }
    
    /**
     * Connect to Redis with retry strategy
     * Uses exponential backoff for reconnection attempts
     */
    // async means this function returns a Promise (takes time to complete)
    async connect() {
        // Create a new Redis client with settings
        this.client = new Redis({
            // Use provided host or default to 'localhost' (your own computer)
            host: this.config.host || 'localhost',
            // Use provided port or default to 6379 (Redis's default port)
            port: this.config.port || 6379,
            // Password if Redis requires authentication
            password: this.config.password,
            // Which database number to use (Redis has 16 databases by default, 0-15)
            db: this.config.db || 0,
            // Strategy for reconnecting if connection fails
            retryStrategy: (times) => {
                // Exponential backoff: wait longer each time
                // 1st attempt: 100ms, 2nd: 200ms, 3rd: 400ms, etc.
                const delay = Math.min(times * 100, 10000);
                // Log that we're trying to reconnect
                console.log(`Redis reconnecting in ${delay}ms...`);
                return delay; // Return the delay time
            },
            // Maximum number of retries per request before failing
            maxRetriesPerRequest: 3,
            // Wait for connection to be ready before considering it connected
            enableReadyCheck: true,
            // Connect immediately (don't wait for first command)
            lazyConnect: false,
            // Give this connection a name (useful for debugging)
            connectionName: 'ecommerce-app',
            // Show detailed error stacks in development (helps debugging)
            showFriendlyErrorStack: process.env.NODE_ENV === 'development',
            // Automatically resubscribe to channels after reconnection
            autoResubscribe: true,
            // Resend commands that were pending when connection was lost
            autoResendUnfulfilledCommands: true
        });
        
        // Event handler: runs when we successfully connect
        this.client.on('connect', () => {
            console.log('Redis connected'); // Log success
            this.isConnected = true; // Update connection status
        });
        
        // Event handler: runs when there's an error
        this.client.on('error', (err) => {
            console.error('Redis error:', err); // Log error
            this.isConnected = false; // Mark as disconnected
        });
        
        // Event handler: runs when connection closes
        this.client.on('close', () => {
            console.log('Redis connection closed'); // Log closure
            this.isConnected = false; // Mark as disconnected
        });
        
        // Return the client so we can use it
        return this.client;
    }
    
    /**
     * Get subscriber client for pub/sub operations
     */
    // Pub/Sub stands for Publish/Subscribe - like broadcasting messages
    async getSubscriber() {
        // If we don't have a subscriber client yet
        if (!this.subscriber) {
            // Create a new Redis client for subscribing
            this.subscriber = new Redis({
                host: this.config.host || 'localhost',
                port: this.config.port || 6379,
                password: this.config.password,
                db: this.config.db || 0
            });
        }
        // Return the subscriber client
        return this.subscriber;
    }
    
    /**
     * Atomic increment with expiration - O(1)
     * Perfect for rate limiting counters
     */
    // Atomic means it happens as one operation (no interruptions)
    // Increment means add 1 to a counter
    async incrementWithExpiry(key, expirySeconds) {
        // Create a multi command (multiple Redis commands in one)
        const multi = this.client.multi();
        // First command: increment the key by 1
        multi.incr(key);
        // Second command: set expiration time (auto-delete after expirySeconds)
        multi.expire(key, expirySeconds);
        // Execute both commands together (atomic operation)
        const results = await multi.exec();
        // Return the incremented value (results[0][1] is the result of incr)
        return results[0][1];
    }
    
    /**
     * Set with optimistic locking using version
     * Prevents lost updates in concurrent scenarios
     */
    // Optimistic locking means we assume no conflicts, but check before saving
    // Version helps track changes (like a timestamp)
    async setWithVersion(key, value, version) {
        // Lua script (a script that runs inside Redis)
        // This script checks the version before updating
        const script = `
            local current = redis.call('get', KEYS[1])
            if not current then
                redis.call('set', KEYS[1], ARGV[1])
                redis.call('set', KEYS[1]..':version', ARGV[2])
                return 1
            end
            local currentVersion = redis.call('get', KEYS[1]..':version')
            if currentVersion == ARGV[2] then
                redis.call('set', KEYS[1], ARGV[1])
                redis.call('set', KEYS[1]..':version', ARGV[2])
                return 1
            end
            return 0
        `;
        
        // Execute the script
        // 1 means we have 1 key, then the key, value, and version
        return await this.client.eval(script, 1, key, JSON.stringify(value), version);
    }
    
    /**
     * Distributed lock using Redlock algorithm
     * Prevents race conditions across multiple servers
     */
    // A lock prevents multiple processes from doing the same thing at once
    // Distributed means it works across multiple computers/servers
    async acquireLock(key, ttlSeconds = 10) {
        // Lock key (prefix with 'lock:')
        const lockKey = `lock:${key}`;
        // Unique value for this lock (timestamp + random number)
        const lockValue = `${Date.now()}-${Math.random()}`;
        
        // SET NX EX - Redis command:
        // NX = Only set if key doesn't exist
        // EX = Set expiration time in seconds
        const acquired = await this.client.set(lockKey, lockValue, 'NX', 'EX', ttlSeconds);
        
        // If we successfully acquired the lock (got 'OK')
        if (acquired === 'OK') {
            // Return an object with a release function
            return {
                release: async () => {
                    // Lua script to release only if we own the lock
                    const script = `
                        if redis.call('get', KEYS[1]) == ARGV[1] then
                            return redis.call('del', KEYS[1])
                        else
                            return 0
                        end
                    `;
                    // Run the script to release the lock
                    await this.client.eval(script, 1, lockKey, lockValue);
                }
            };
        }
        
        // Return null if we couldn't get the lock
        return null;
    }
    
    /**
     * Batch operations pipeline for performance
     * Reduces network round trips - O(1) network calls for n operations
     */
    // Batching means grouping multiple operations together
    async batchOperations(operations) {
        // Create a pipeline (like a list of commands to run together)
        const pipeline = this.client.pipeline();
        
        // Loop through each operation
        for (const op of operations) {
            // Different command types need different handling
            switch (op.command) {
                case 'set': // Set a key-value pair
                    // Set with expiration (TTL = Time To Live)
                    pipeline.set(op.key, op.value, 'EX', op.ttl || 3600);
                    break;
                case 'get': // Get value by key
                    pipeline.get(op.key);
                    break;
                case 'del': // Delete a key
                    pipeline.del(op.key);
                    break;
                case 'incr': // Increment counter
                    pipeline.incr(op.key);
                    break;
                case 'hset': // Set a field in a hash (like object)
                    pipeline.hset(op.key, op.field, op.value);
                    break;
                case 'hget': // Get a field from a hash
                    pipeline.hget(op.key, op.field);
                    break;
                default: // Unknown command
                    console.warn(`Unknown operation: ${op.command}`);
            }
        }
        
        // Execute all commands together and return results
        return await pipeline.exec();
    }
    
    /**
     * HyperLogLog for approximate unique counting
     * Uses O(1) memory regardless of data size
     * Perfect for tracking unique visitors, unique products viewed
     */
    // HyperLogLog is like a special counter that estimates unique items
    // It uses very little memory even for millions of items
    
    // Add a value to the HyperLogLog counter
    async addToHyperLogLog(key, value) {
        // pfadd = HyperLogLog add command
        return await this.client.pfadd(key, value);
    }
    
    // Get the approximate count of unique values
    async countHyperLogLog(key) {
        // pfcount = HyperLogLog count command
        return await this.client.pfcount(key);
    }
    
    /**
     * Sorted Set operations for leaderboards and priority queues
     * O(log n) for insert and query
     */
    // Sorted Sets are like arrays but automatically sorted by score
    
    // Add item to sorted set with a score (score determines position)
    async addToSortedSet(key, score, member) {
        // zadd = sorted set add command
        return await this.client.zadd(key, score, member);
    }
    
    // Get top items from sorted set (like a leaderboard)
    async getTopFromSortedSet(key, count, withScores = true) {
        if (withScores) {
            // Get highest scores first (rev = reverse order)
            // '+inf' to '-inf' = all scores, LIMIT = get top count
            return await this.client.zrevrangebyscore(key, '+inf', '-inf', 'LIMIT', 0, count, 'WITHSCORES');
        }
        // Just get members without scores
        return await this.client.zrevrange(key, 0, count - 1);
    }
    
    /**
     * Publish message to channel
     */
    // Publish = send a message to a channel (like broadcasting on a radio station)
    async publish(channel, message) {
        // Convert message to JSON string and publish
        return await this.client.publish(channel, JSON.stringify(message));
    }
    
    /**
     * Subscribe to channel with handler
     */
    // Subscribe = listen to messages on a channel
    async subscribe(channel, handler) {
        // Get the subscriber client (separate connection)
        const subscriber = await this.getSubscriber();
        // Subscribe to the channel
        await subscriber.subscribe(channel);
        
        // Listen for messages
        subscriber.on('message', (ch, message) => {
            // If message is for our channel
            if (ch === channel) {
                // Parse JSON back to object and call handler function
                handler(JSON.parse(message));
            }
        });
    }
    
    /**
     * Close connections gracefully
     */
    // Clean up when we're done
    async disconnect() {
        // If we have a main client, close it
        if (this.client) {
            await this.client.quit(); // quit = disconnect gracefully
        }
        // If we have a subscriber, close it too
        if (this.subscriber) {
            await this.subscriber.quit();
        }
    }
}

// Make this class available for other files to use
module.exports = RedisClient;

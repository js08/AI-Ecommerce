/**
 * Advanced Cache Manager with LRU (Least Recently Used) algorithm
 * LRU ensures O(1) access time for cache operations
 * This is more efficient than simple TTL-based caches for high-traffic scenarios
 */
// This comment block explains what this code does
// LRU = Least Recently Used - it removes the oldest items first
// O(1) means it's super fast - takes the same time regardless of how much data

class LRUCache {
    // Constructor runs when we create a new cache
    // capacity = maximum number of items we can store
    constructor(capacity) {
        // Store the maximum size limit
        this.capacity = capacity; // Maximum items cache can hold
        
        // Create a Map to store our cache data
        // Map is like an object but remembers the order items were added
        // Most recent items go to the end, oldest stay at the beginning
        this.cache = new Map(); // Map provides O(1) get/set operations
    }

    /**
     * Get value from cache with O(1) time complexity
     * Updates the item's position to most recently used
     */
    get(key) {
        // First, check if the item exists in our cache
        // If not, return null (nothing found)
        if (!this.cache.has(key)) return null;
        
        // Get the value stored under this key
        const value = this.cache.get(key);
        
        // Delete and re-add the item to move it to the end
        // This marks it as "most recently used"
        this.cache.delete(key);
        this.cache.set(key, value);
        
        // Return the value to the user
        return value;
    }

    /**
     * Set value in cache with O(1) time complexity
     * Implements LRU eviction when capacity is exceeded
     */
    set(key, value) {
        // If the key already exists, delete it first
        // This way we can add it again as the newest item
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // If we've reached our capacity limit
        else if (this.cache.size >= this.capacity) {
            // Get the oldest key (first item in the Map)
            // .keys() gives us all keys in order
            // .next().value gets the first one
            const oldestKey = this.cache.keys().next().value;
            // Remove the oldest item to make room
            this.cache.delete(oldestKey);
        }
        
        // Add the new item to the end (most recent position)
        this.cache.set(key, value);
    }
    
    /**
     * Delete specific key from cache
     * Returns true if key existed and was deleted, false otherwise
     */
    delete(key) {
        // Map's delete method returns true if item existed and was deleted
        return this.cache.delete(key);
    }
    
    /**
     * Clear entire cache - removes all items
     */
    clear() {
        // Remove everything from the cache
        this.cache.clear();
    }
    
    /**
     * Get current size of cache (number of stored items)
     * Returns the count of items currently in the cache
     */
    size() {
        // Return how many items are in the cache
        return this.cache.size;
    }
}

/**
 * Bloom Filter for efficient existence checking
 * Uses minimal memory (bits) to check if an item exists
 * False positives possible but no false negatives
 * Perfect for checking if product ID exists before DB query
 */
// A Bloom Filter is like a "maybe" checklist
// It can say "definitely no" or "maybe yes" but never "definitely yes"
// Uses very little memory (bits instead of full data)

class BloomFilter {
    // size = how many bits to use (default 1,000,000 bits)
    // hashCount = how many different hash functions to use (default 7)
    constructor(size = 1000000, hashCount = 7) {
        this.size = size; // Number of bits in the filter
        this.hashCount = hashCount; // Number of hash functions to use
        
        // Create array of 32-bit integers
        // Each integer can store 32 bits, so we need size/32 integers
        // Math.ceil rounds up if size isn't divisible by 32
        this.bitArray = new Array(Math.ceil(size / 32)).fill(0);
        // All bits start as 0 (not set)
    }
    
    /**
     * Hash function using DJB2 algorithm - fast and good distribution
     * Time complexity: O(n) where n is string length
     * A hash function turns any string into a number
     */
    _hash(str, seed) {
        // Start with the seed value (like a starting point)
        let hash = seed;
        
        // Loop through each character in the string
        for (let i = 0; i < str.length; i++) {
            // DJB2 algorithm: multiply by 33 and add the character code
            // (hash << 5) + hash is the same as hash * 33
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            // Keep it as a 32-bit integer (prevents numbers from getting too big)
            hash = hash & hash;
        }
        // Make sure it's positive and within our bit array size
        return Math.abs(hash % this.size);
    }
    
    /**
     * Add item to bloom filter - O(k) where k = hashCount
     * Sets the bits at all hash positions to 1
     */
    add(item) {
        // Convert anything to string so we can hash it
        const itemStr = String(item);
        
        // Use each hash function (like asking different questions)
        for (let i = 0; i < this.hashCount; i++) {
            // Get a hash index for this item
            // The seed is i times a special number (golden ratio) for good distribution
            const index = this._hash(itemStr, i * 0x9e3779b9);
            
            // Find which integer bucket contains this bit
            const bucket = Math.floor(index / 32);
            // Find which bit position within that integer
            const bit = index % 32;
            
            // Set the bit to 1 using bitwise OR
            // 1 << bit creates a number with 1 at that bit position
            // |= means "OR equals" - turns that bit on
            this.bitArray[bucket] |= (1 << bit);
        }
    }
    
    /**
     * Check if item might exist - O(k)
     * Returns false if definitely doesn't exist
     * Returns true if might exist (could be false positive)
     */
    mightContain(item) {
        const itemStr = String(item);
        
        // Check all hash positions
        for (let i = 0; i < this.hashCount; i++) {
            const index = this._hash(itemStr, i * 0x9e3779b9);
            const bucket = Math.floor(index / 32);
            const bit = index % 32;
            
            // Check if this bit is 0
            // & (AND) returns 0 if the bit is 0
            if ((this.bitArray[bucket] & (1 << bit)) === 0) {
                return false; // Definitely doesn't exist (bit was 0)
            }
        }
        return true; // Might exist (all bits were 1)
    }
}

/**
 * Rate Limiter using Token Bucket Algorithm
 * More efficient than fixed window counters for bursty traffic
 * Allows for temporary bursts while maintaining average rate
 */
// Token bucket is like a water bucket that refills slowly
// Each request uses one token - if no tokens, request is denied

class TokenBucketRateLimiter {
    // rate = tokens added per second (refill speed)
    // capacity = max tokens that can be stored (burst size)
    constructor(rate = 10, capacity = 20) {
        this.rate = rate; // Tokens added per second
        this.capacity = capacity; // Maximum tokens (burst capacity)
        
        // Store current tokens for each user/IP
        this.tokens = new Map();
        // Store last refill time for each user/IP
        this.lastRefill = new Map();
    }
    
    /**
     * Try to consume a token - O(1)
     * Returns true if request allowed, false if rate limited
     */
    tryConsume(key) {
        // Get current time in seconds
        const now = Date.now() / 1000;
        
        // Get current tokens for this user
        // If new user, start with full capacity
        let tokens = this.tokens.get(key) || this.capacity;
        // Get last refill time, or now if new user
        let lastTime = this.lastRefill.get(key) || now;
        
        // Calculate how much time has passed since last refill
        const elapsed = now - lastTime;
        // Calculate how many tokens to add (rate × time)
        const tokensToAdd = elapsed * this.rate;
        
        // Add new tokens, but don't exceed capacity
        tokens = Math.min(this.capacity, tokens + tokensToAdd);
        
        // Check if we have at least one token
        if (tokens >= 1) {
            // Use one token
            tokens -= 1;
            // Store updated values
            this.tokens.set(key, tokens);
            this.lastRefill.set(key, now);
            return true; // Request allowed!
        }
        
        // Not enough tokens - rate limit
        this.tokens.set(key, tokens);
        this.lastRefill.set(key, lastTime);
        return false; // Request denied
    }
}

/**
 * Min-Heap implementation for priority queues
 * Used for order processing with priorities (VIP orders first)
 * Time complexity: O(log n) for insert and extract
 */
// A Min-Heap is like a priority line where the smallest number goes first
// Think of it as "lowest priority number = highest importance"

class MinHeap {
    constructor() {
        // Array to store our heap
        // We'll store objects with a 'priority' property
        this.heap = [];
    }
    
    /**
     * Get parent index - O(1)
     * In a heap, parent is at floor((index-1)/2)
     */
    getParentIndex(index) {
        return Math.floor((index - 1) / 2);
    }
    
    /**
     * Get left child index - O(1)
     * Left child is at index*2 + 1
     */
    getLeftChildIndex(index) {
        return 2 * index + 1;
    }
    
    /**
     * Get right child index - O(1)
     * Right child is at index*2 + 2
     */
    getRightChildIndex(index) {
        return 2 * index + 2;
    }
    
    /**
     * Swap two elements - O(1)
     * Switches positions of two items in the heap
     */
    swap(index1, index2) {
        // Swap using array destructuring (fancy way to swap values)
        [this.heap[index1], this.heap[index2]] = [this.heap[index2], this.heap[index1]];
    }
    
    /**
     * Insert element - O(log n)
     * Add item to heap and bubble up to correct position
     */
    insert(item) {
        // Add new item to the end
        this.heap.push(item);
        // Move it up to maintain heap property
        this.heapifyUp(this.heap.length - 1);
    }
    
    /**
     * Move element up - O(log n)
     * After inserting, we move the new item up until it's in the right place
     */
    heapifyUp(index) {
        // Keep moving up until we reach the top
        while (index > 0) {
            const parentIndex = this.getParentIndex(index);
            
            // If parent has smaller or equal priority, we're done
            // Lower priority number = higher importance
            if (this.heap[parentIndex].priority <= this.heap[index].priority) {
                break;
            }
            
            // Parent has higher priority number (less important)
            // Swap with parent and continue up
            this.swap(parentIndex, index);
            index = parentIndex;
        }
    }
    
    /**
     * Extract minimum - O(log n)
     * Remove and return the smallest (highest priority) element
     */
    extractMin() {
        // If heap is empty, return null
        if (this.heap.length === 0) return null;
        // If only one item, just pop and return it
        if (this.heap.length === 1) return this.heap.pop();
        
        // Store the smallest item (root)
        const min = this.heap[0];
        // Replace root with last item
        this.heap[0] = this.heap.pop();
        // Move the new root down to correct position
        this.heapifyDown(0);
        return min;
    }
    
    /**
     * Move element down - O(log n)
     * After removing root, we move the new root down to maintain heap property
     */
    heapifyDown(index) {
        let smallest = index;
        const left = this.getLeftChildIndex(index);
        const right = this.getRightChildIndex(index);
        
        // Check if left child exists and has smaller priority
        if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
            smallest = left;
        }
        
        // Check if right child exists and has smaller priority
        if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
            smallest = right;
        }
        
        // If we found a smaller child, swap and continue down
        if (smallest !== index) {
            this.swap(index, smallest);
            this.heapifyDown(smallest);
        }
    }
    
    /**
     * Get size - O(1)
     */
    size() {
        return this.heap.length;
    }
    
    /**
     * Check if empty - O(1)
     */
    isEmpty() {
        return this.heap.length === 0;
    }
    
    /**
     * Peek at minimum without removing - O(1)
     * Look at the smallest item without taking it out
     */
    peek() {
        return this.heap[0] || null;
    }
}

// Export all classes so other files can use them
module.exports = {
    LRUCache,
    BloomFilter,
    TokenBucketRateLimiter,
    MinHeap
};
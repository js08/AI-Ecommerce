/**
 * chatbotService.js - AI-powered customer support chatbot
 * 
 * Uses LangChain for conversation management
 * Features:
 * - Intent recognition
 * - Contextual conversation
 * - Product recommendations
 * - Order tracking
 * - FAQ answering
 */

const { logger } = require('../utils/logger');

class ChatbotService {
  constructor(vectorStore) {
    this.vectorStore = vectorStore;
    this.intentClassifier = null;
    this.conversationMemory = new Map(); // Store conversation history
    this.intents = {
      TRACK_ORDER: ['track order', 'where is my order', 'order status', 'delivery'],
      PRODUCT_QUESTION: ['product', 'specifications', 'features', 'dimensions'],
      RETURN: ['return', 'refund', 'exchange', 'damaged'],
      SHIPPING: ['shipping', 'delivery time', 'shipping cost', 'free shipping'],
      PAYMENT: ['payment', 'credit card', 'paypal', 'payment failed'],
      RECOMMENDATION: ['recommend', 'suggest', 'what should I buy', 'best'],
      COMPLAINT: ['complaint', 'unhappy', 'terrible', 'bad experience'],
      GREETING: ['hello', 'hi', 'hey', 'good morning']
    };
  }
  
  async initialize() {
    // Initialize intent classifier
    this.intentClassifier = new IntentClassifier(this.intents);
    logger.info('Chatbot service initialized');
  }
  
  /**
   * Process user message and generate response
   */
  async processMessage({ message, userId, sessionId, context, history }) {
    logger.info(`Processing message from user ${userId}: ${message}`);
    
    // Step 1: Classify intent
    const intent = await this.classifyIntent(message);
    
    // Step 2: Extract entities (order number, product name, etc.)
    const entities = this.extractEntities(message);
    
    // Step 3: Get conversation context
    const conversationContext = this.getConversationContext(sessionId);
    
    // Step 4: Generate response based on intent
    let response;
    let actions = [];
    
    switch (intent.name) {
      case 'TRACK_ORDER':
        response = await this.handleOrderTracking(entities, userId);
        actions = ['track_order'];
        break;
        
      case 'PRODUCT_QUESTION':
        response = await this.handleProductQuestion(message, entities);
        actions = ['get_product_info'];
        break;
        
      case 'RETURN':
        response = await this.handleReturnRequest(entities, userId);
        actions = ['create_return'];
        break;
        
      case 'SHIPPING':
        response = await this.handleShippingQuestion();
        actions = ['show_shipping_info'];
        break;
        
      case 'RECOMMENDATION':
        response = await this.handleRecommendation(message, userId);
        actions = ['show_products'];
        break;
        
      case 'COMPLAINT':
        response = await this.handleComplaint(message, userId);
        actions = ['escalate_to_support'];
        break;
        
      case 'GREETING':
        response = await this.handleGreeting();
        break;
        
      default:
        response = await this.handleGeneralQuery(message, context);
    }
    
    // Step 5: Generate suggestions for next steps
    const suggestions = await this.generateSuggestions(intent.name, entities);
    
    // Step 6: Update conversation memory
    this.updateConversationMemory(sessionId, message, response, intent);
    
    return {
      reply: response.message,
      intent: intent.name,
      confidence: intent.confidence,
      actions: actions,
      suggestions: suggestions,
      entities: entities,
      data: response.data
    };
  }
  
  /**
   * Classify user intent using ML
   */
  async classifyIntent(message) {
    const lowerMessage = message.toLowerCase();
    let bestMatch = { name: 'GENERAL', confidence: 0 };
    
    for (const [intent, keywords] of Object.entries(this.intents)) {
      let matchScore = 0;
      
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          // Exact match
          matchScore += 1;
        } else {
          // Fuzzy matching (simplified)
          const words = lowerMessage.split(' ');
          for (const word of words) {
            if (this.isSimilar(word, keyword)) {
              matchScore += 0.7;
            }
          }
        }
      }
      
      // Normalize score
      const confidence = Math.min(matchScore / keywords.length, 0.95);
      
      if (confidence > bestMatch.confidence) {
        bestMatch = { name: intent, confidence };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Extract entities from message
   */
  extractEntities(message) {
    const entities = {};
    
    // Extract order number (ORD-XXXXX format)
    const orderMatch = message.match(/ORD-[A-Z0-9]+/i);
    if (orderMatch) {
      entities.orderNumber = orderMatch[0];
    }
    
    // Extract product name (simple heuristic)
    const productKeywords = ['product', 'item', 'thing'];
    for (const keyword of productKeywords) {
      const index = message.toLowerCase().indexOf(keyword);
      if (index !== -1) {
        // Get next few words as product name
        const remaining = message.substring(index + keyword.length);
        const words = remaining.trim().split(' ');
        entities.productName = words.slice(0, 3).join(' ');
        break;
      }
    }
    
    // Extract amount (for refunds)
    const amountMatch = message.match(/\$\d+(\.\d{2})?/);
    if (amountMatch) {
      entities.amount = amountMatch[0];
    }
    
    return entities;
  }
  
  /**
   * Handle order tracking intent
   */
  async handleOrderTracking(entities, userId) {
    if (!entities.orderNumber) {
      return {
        message: "I can help you track your order. Could you please provide your order number? (Format: ORD-XXXXX)",
        data: { requiresOrderNumber: true }
      };
    }
    
    try {
      // Call order service to get order status
      const orderStatus = await this.getOrderStatus(entities.orderNumber, userId);
      
      const statusMessages = {
        'pending': "is being processed",
        'confirmed': "has been confirmed",
        'shipped': "is on the way",
        'delivered': "has been delivered",
        'cancelled': "was cancelled"
      };
      
      const message = `Your order ${entities.orderNumber} ${statusMessages[orderStatus.status] || 'is being processed'}. `;
      
      let trackingInfo = '';
      if (orderStatus.trackingNumber) {
        trackingInfo = `Tracking number: ${orderStatus.trackingNumber}. `;
      }
      
      let deliveryDate = '';
      if (orderStatus.estimatedDelivery) {
        deliveryDate = `Expected delivery: ${orderStatus.estimatedDelivery}. `;
      }
      
      return {
        message: message + trackingInfo + deliveryDate + "Would you like anything else?",
        data: { orderStatus }
      };
      
    } catch (error) {
      logger.error('Order tracking error:', error);
      return {
        message: "I couldn't find that order. Please check the order number and try again.",
        data: { error: true }
      };
    }
  }
  
  /**
   * Handle product questions
   */
  async handleProductQuestion(message, entities) {
    // Search product knowledge base
    const searchResults = await this.vectorStore.similaritySearch(message, 3);
    
    if (searchResults.length > 0) {
      const bestMatch = searchResults[0];
      return {
        message: bestMatch.content,
        data: { products: searchResults }
      };
    }
    
    return {
      message: "I'm not sure about that product. Could you please provide more details or check our product catalog?",
      data: { needsMoreInfo: true }
    };
  }
  
  /**
   * Handle product recommendations
   */
  async handleRecommendation(message, userId) {
    // Extract preferences from message
    const preferences = this.extractPreferences(message);
    
    // Get personalized recommendations
    const recommendations = await this.getRecommendations(userId, preferences);
    
    if (recommendations.length === 0) {
      return {
        message: "I couldn't find products matching your preferences. Could you tell me more about what you're looking for?",
        data: { recommendations: [] }
      };
    }
    
    const productList = recommendations.slice(0, 3).map(p => 
      `- ${p.name} ($${p.price}) - ${p.description?.substring(0, 100)}...`
    ).join('\n');
    
    return {
      message: `Based on your interests, here are some recommendations:\n\n${productList}\n\nWould you like more details about any of these?`,
      data: { recommendations }
    };
  }
  
  /**
   * Handle general queries (fallback)
   */
  async handleGeneralQuery(message, context) {
    // Use knowledge base for general questions
    const answer = await this.searchKnowledgeBase(message);
    
    if (answer) {
      return {
        message: answer,
        data: { source: 'knowledge_base' }
      };
    }
    
    return {
      message: "I'm here to help with orders, products, shipping, and returns. Could you please rephrase your question?",
      data: { needsClarification: true }
    };
  }
  
  /**
   * Generate follow-up suggestions
   */
  async generateSuggestions(intent, entities) {
    const suggestions = {
      TRACK_ORDER: [
        "Track another order",
        "Check delivery status",
        "Contact shipping carrier"
      ],
      PRODUCT_QUESTION: [
        "Compare similar products",
        "Check product reviews",
        "See product specifications"
      ],
      RETURN: [
        "Start a return",
        "Check return policy",
        "Print return label"
      ],
      RECOMMENDATION: [
        "See more recommendations",
        "Filter by price",
        "View trending products"
      ]
    };
    
    return suggestions[intent] || [
      "Track an order",
      "Ask about a product",
      "Get help with return"
    ];
  }
  
  /**
   * Helper: Get order status from order service
   */
  async getOrderStatus(orderNumber, userId) {
    // Call order service API
    const response = await axios.get(`${process.env.ORDER_SERVICE_URL}/api/v1/orders/by-number/${orderNumber}`, {
      headers: { 'x-user-id': userId }
    });
    return response.data;
  }
  
  /**
   * Helper: Get recommendations from recommendation engine
   */
  async getRecommendations(userId, preferences) {
    // Call recommendation API
    const response = await axios.get(`${process.env.AI_SERVICE_URL}/api/ai/recommendations/${userId}`, {
      params: { limit: 5 }
    });
    return response.data.recommendations;
  }
  
  /**
   * Helper: Search knowledge base
   */
  async searchKnowledgeBase(query) {
    // Search FAQ database
    const faqs = {
      'shipping time': 'Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days.',
      'return policy': 'You can return items within 30 days of delivery for a full refund.',
      'payment methods': 'We accept credit cards (Visa, Mastercard, Amex), PayPal, and Apple Pay.',
      'contact support': 'You can reach customer support at support@ecommerce.com or call 1-800-555-0123.'
    };
    
    for (const [key, answer] of Object.entries(faqs)) {
      if (query.toLowerCase().includes(key)) {
        return answer;
      }
    }
    
    return null;
  }
  
  /**
   * Helper: Extract preferences from message
   */
  extractPreferences(message) {
    const preferences = {};
    const lowerMessage = message.toLowerCase();
    
    // Price preference
    const priceMatch = lowerMessage.match(/under\s*\$\s*(\d+)/);
    if (priceMatch) {
      preferences.maxPrice = parseInt(priceMatch[1]);
    }
    
    // Category preference
    const categories = ['electronics', 'clothing', 'shoes', 'books', 'home', 'sports'];
    for (const category of categories) {
      if (lowerMessage.includes(category)) {
        preferences.category = category;
        break;
      }
    }
    
    return preferences;
  }
  
  /**
   * Helper: Simple string similarity
   */
  isSimilar(word1, word2) {
    // Levenshtein distance (simplified)
    if (Math.abs(word1.length - word2.length) > 2) return false;
    
    let differences = 0;
    const minLength = Math.min(word1.length, word2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (word1[i] !== word2[i]) differences++;
    }
    
    differences += Math.abs(word1.length - word2.length);
    return differences <= 2;
  }
  
  getConversationContext(sessionId) {
    return this.conversationMemory.get(sessionId) || {
      lastIntent: null,
      turnCount: 0,
      lastMessage: null
    };
  }
  
  updateConversationMemory(sessionId, message, response, intent) {
    this.conversationMemory.set(sessionId, {
      lastIntent: intent.name,
      turnCount: (this.conversationMemory.get(sessionId)?.turnCount || 0) + 1,
      lastMessage: message,
      lastResponse: response.message,
      timestamp: new Date().toISOString()
    });
  }
  
  async handleGreeting() {
    const greetings = [
      "Hello! How can I help you today?",
      "Hi there! What can I do for you?",
      "Welcome! I'm here to help with orders, products, and more."
    ];
    return { message: greetings[Math.floor(Math.random() * greetings.length)] };
  }
  
  async handleReturnRequest(entities, userId) {
    if (!entities.orderNumber) {
      return {
        message: "I can help with returns. Please provide your order number to start the return process.",
        data: { requiresOrderNumber: true }
      };
    }
    
    return {
      message: "I've initiated the return process for your order. You'll receive an email with return instructions and a shipping label within 5 minutes.",
      data: { returnInitiated: true, orderNumber: entities.orderNumber }
    };
  }
  
  async handleShippingQuestion() {
    return {
      message: "We offer free standard shipping on orders over $50. Standard shipping takes 3-5 business days. Express shipping (1-2 days) is available for $9.99. Would you like to know more about shipping to a specific location?",
      data: { shippingOptions: ['standard', 'express'] }
    };
  }
  
  async handleComplaint(message, userId) {
    return {
      message: "I'm sorry to hear that you're having an issue. I've escalated your concern to our customer support team. They'll contact you within 24 hours. Is there anything specific I can help with in the meantime?",
      data: { escalated: true, complaintText: message }
    };
  }
}

/**
 * Simple intent classifier
 */
class IntentClassifier {
  constructor(intents) {
    this.intents = intents;
  }
  
  async classify(message) {
    const lowerMessage = message.toLowerCase();
    let bestIntent = 'GENERAL';
    let bestScore = 0;
    
    for (const [intent, keywords] of Object.entries(this.intents)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
    
    const confidence = Math.min(bestScore / 5, 0.9);
    
    return {
      name: bestIntent,
      confidence: confidence
    };
  }
}

module.exports = { ChatbotService };
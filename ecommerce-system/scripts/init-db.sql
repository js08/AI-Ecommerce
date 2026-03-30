-- Additional tables for AI/ML features

-- User interactions for recommendations
CREATE TABLE user_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    interaction_type VARCHAR(50), -- view, click, add_to_cart, purchase
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product embeddings (for similarity search)
CREATE TABLE product_embeddings (
    product_id INTEGER PRIMARY KEY,
    embedding VECTOR(512), -- Vector extension required
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot interactions
CREATE TABLE chatbot_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    session_id VARCHAR(100),
    user_message TEXT,
    bot_response TEXT,
    intent VARCHAR(50),
    confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price optimization history
CREATE TABLE price_optimization_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    reason TEXT,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud detection alerts
CREATE TABLE fraud_alerts (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    user_id INTEGER,
    fraud_score DECIMAL(3,2),
    risk_factors JSONB,
    action_taken VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment analysis results
CREATE TABLE sentiment_analysis (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50), -- product, review, comment
    entity_id INTEGER,
    sentiment_label VARCHAR(20),
    sentiment_score DECIMAL(3,2),
    aspects JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_product ON user_interactions(product_id);
CREATE INDEX idx_chatbot_session ON chatbot_interactions(session_id);
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts(user_id);
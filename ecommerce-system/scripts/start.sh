# ============================================
# RUN ALL SERVICES WITH AI
# ============================================

# Step 1: Start all databases and message queue
docker-compose up -d postgres-main redis kafka elasticsearch

# Step 2: Build and start AI service
cd services/ai-service
npm install
npm run train  # Train ML models (first time only)
npm start

# Step 3: Start other services
cd ../..
docker-compose up -d api-gateway user-service product-service cart-service

# Step 4: Test AI features

# Get product recommendations
curl -X GET http://localhost:3000/api/ai/recommendations/123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Chat with AI assistant
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Where is my order ORD-ABC123?",
    "sessionId": "session_123"
  }'

# Check fraud score for transaction
curl -X POST http://localhost:3000/api/ai/fraud-check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_123",
    "amount": 9999.99,
    "userId": 123,
    "location": "New York",
    "deviceId": "device_456"
  }'

# Analyze sentiment of product review
curl -X POST http://localhost:3000/api/ai/sentiment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This product is amazing! Best purchase ever!",
    "context": "product_review"
  }'

# Visual search (upload image)
curl -X POST http://localhost:3000/api/ai/visual-search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@product.jpg"

# Get optimal price
curl -X GET "http://localhost:3000/api/ai/optimal-price/123?segment=premium" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get demand forecast
curl -X GET "http://localhost:3000/api/ai/forecast/123?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Personalized search
curl -X POST http://localhost:3000/api/ai/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "wireless headphones",
    "userId": 123,
    "filters": {"priceRange": {"min": 50, "max": 200}}
  }'
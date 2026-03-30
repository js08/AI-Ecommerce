/**
 * initDb.js - Database initialization script for AI service
 * Run with: node scripts/initDb.js or npm run init-db
 */

// Import required modules
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Create logger
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] WARN: ${msg}`),
  success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  step: (msg) => console.log(`\n▶ ${msg}`)
};

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecommerce_main',
  user: process.env.DB_USER || 'ecommerce_user',
  password: process.env.DB_PASSWORD || 'ecommerce_password_123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};

// Create connection pool
let pool = null;

// Test database connection
async function testConnection() {
  logger.info('Testing database connection...');
  
  try {
    pool = new Pool(dbConfig);
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    logger.success(`Connected to database at ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    logger.error(`Connection failed: ${error.message}`);
    logger.error('Make sure PostgreSQL is running and credentials are correct');
    return false;
  }
}

// Enable PostgreSQL extensions
async function enableExtensions() {
  logger.step('Enabling PostgreSQL extensions');
  
  const extensions = [
    { name: 'vector', required: true },
    { name: 'uuid-ossp', required: true },
    { name: 'pgcrypto', required: false }
  ];
  
  for (const ext of extensions) {
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "${ext.name}"`);
      logger.success(`  ✓ Enabled: ${ext.name}`);
    } catch (error) {
      if (ext.required) {
        logger.error(`  ✗ Failed to enable ${ext.name}: ${error.message}`);
        throw error;
      } else {
        logger.warn(`  ⚠ Could not enable ${ext.name}: ${error.message}`);
      }
    }
  }
}

// Create all database tables
async function createTables() {
  logger.step('Creating database tables');
  
  const tables = [
    {
      name: 'user_interactions',
      sql: `
        CREATE TABLE IF NOT EXISTS user_interactions (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          interaction_type VARCHAR(50) NOT NULL,
          weight DECIMAL(5,4) DEFAULT 1.0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          session_id VARCHAR(100),
          ip_address INET,
          user_agent TEXT
        )
      `
    },
    {
      name: 'product_embeddings',
      sql: `
        CREATE TABLE IF NOT EXISTS product_embeddings (
          product_id INTEGER PRIMARY KEY,
          embedding vector(512) NOT NULL,
          embedding_version VARCHAR(20) DEFAULT 'v1',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'fraud_alerts',
      sql: `
        CREATE TABLE IF NOT EXISTS fraud_alerts (
          id BIGSERIAL PRIMARY KEY,
          transaction_id VARCHAR(100) NOT NULL,
          user_id INTEGER NOT NULL,
          fraud_score DECIMAL(5,4) NOT NULL,
          risk_factors JSONB NOT NULL,
          action_taken VARCHAR(50),
          reviewed_by VARCHAR(100),
          reviewed_at TIMESTAMP WITH TIME ZONE,
          confirmed_fraud BOOLEAN,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'price_optimization_log',
      sql: `
        CREATE TABLE IF NOT EXISTS price_optimization_log (
          id BIGSERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          old_price DECIMAL(10,2) NOT NULL,
          new_price DECIMAL(10,2) NOT NULL,
          reason TEXT,
          elasticity DECIMAL(5,4),
          competitor_avg DECIMAL(10,2),
          inventory_level INTEGER,
          confidence DECIMAL(5,4),
          applied BOOLEAN DEFAULT FALSE,
          applied_at TIMESTAMP WITH TIME ZONE,
          revenue_impact DECIMAL(10,2),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'sentiment_analysis',
      sql: `
        CREATE TABLE IF NOT EXISTS sentiment_analysis (
          id BIGSERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INTEGER NOT NULL,
          sentiment_label VARCHAR(20) NOT NULL,
          sentiment_score DECIMAL(5,4) NOT NULL,
          aspects JSONB DEFAULT '{}',
          emotions JSONB DEFAULT '{}',
          key_phrases TEXT[],
          confidence DECIMAL(5,4),
          source VARCHAR(50) DEFAULT 'review',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(entity_type, entity_id, source)
        )
      `
    },
    {
      name: 'chatbot_interactions',
      sql: `
        CREATE TABLE IF NOT EXISTS chatbot_interactions (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER,
          session_id VARCHAR(100) NOT NULL,
          user_message TEXT NOT NULL,
          bot_response TEXT NOT NULL,
          intent VARCHAR(50),
          intent_confidence DECIMAL(5,4),
          entities JSONB DEFAULT '{}',
          response_time_ms INTEGER,
          user_satisfaction INTEGER,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'model_training_data',
      sql: `
        CREATE TABLE IF NOT EXISTS model_training_data (
          id BIGSERIAL PRIMARY KEY,
          model_name VARCHAR(100) NOT NULL,
          features JSONB NOT NULL,
          labels JSONB NOT NULL,
          weight DECIMAL(5,4) DEFAULT 1.0,
          split VARCHAR(10) DEFAULT 'train',
          version VARCHAR(20) DEFAULT 'v1',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          source VARCHAR(100)
        )
      `
    },
    {
      name: 'model_metrics',
      sql: `
        CREATE TABLE IF NOT EXISTS model_metrics (
          id BIGSERIAL PRIMARY KEY,
          model_name VARCHAR(100) NOT NULL,
          version VARCHAR(20) NOT NULL,
          metric_name VARCHAR(50) NOT NULL,
          metric_value DECIMAL(10,6) NOT NULL,
          dataset VARCHAR(20) NOT NULL,
          sample_count INTEGER,
          evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'
        )
      `
    },
    {
      name: 'demand_forecasts',
      sql: `
        CREATE TABLE IF NOT EXISTS demand_forecasts (
          id BIGSERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          forecast_date DATE NOT NULL,
          predicted_units INTEGER NOT NULL,
          lower_bound INTEGER,
          upper_bound INTEGER,
          actual_units INTEGER,
          accuracy DECIMAL(5,4),
          model_version VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, forecast_date)
        )
      `
    },
    {
      name: 'forecast_models',
      sql: `
        CREATE TABLE IF NOT EXISTS forecast_models (
          id BIGSERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          model_params JSONB NOT NULL,
          version VARCHAR(20) NOT NULL,
          trained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, version)
        )
      `
    }
  ];
  
  for (const table of tables) {
    try {
      await pool.query(table.sql);
      logger.success(`  ✓ Created table: ${table.name}`);
    } catch (error) {
      logger.error(`  ✗ Failed to create table ${table.name}: ${error.message}`);
      throw error;
    }
  }
}

// Create indexes
async function createIndexes() {
  logger.step('Creating database indexes');
  
  const indexes = [
    {
      name: 'idx_user_interactions_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id)`
    },
    {
      name: 'idx_user_interactions_product',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_interactions_product ON user_interactions(product_id)`
    },
    {
      name: 'idx_fraud_alerts_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id, created_at)`
    },
    {
      name: 'idx_fraud_alerts_score',
      sql: `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_score ON fraud_alerts(fraud_score)`
    },
    {
      name: 'idx_price_opt_product',
      sql: `CREATE INDEX IF NOT EXISTS idx_price_opt_product ON price_optimization_log(product_id, created_at)`
    },
    {
      name: 'idx_sentiment_entity',
      sql: `CREATE INDEX IF NOT EXISTS idx_sentiment_entity ON sentiment_analysis(entity_type, entity_id)`
    },
    {
      name: 'idx_chatbot_session',
      sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_session ON chatbot_interactions(session_id, created_at)`
    },
    {
      name: 'idx_forecast_product',
      sql: `CREATE INDEX IF NOT EXISTS idx_forecast_product ON demand_forecasts(product_id, forecast_date)`
    },
    {
      name: 'idx_forecast_models_product',
      sql: `CREATE INDEX IF NOT EXISTS idx_forecast_models_product ON forecast_models(product_id)`
    }
  ];
  
  for (const idx of indexes) {
    try {
      await pool.query(idx.sql);
      logger.success(`  ✓ Created index: ${idx.name}`);
    } catch (error) {
      logger.warn(`  ⚠ Could not create index ${idx.name}: ${error.message}`);
    }
  }
}

// Create functions and triggers
async function createFunctions() {
  logger.step('Creating database functions');
  
  // Function to update updated_at timestamp
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  logger.success('  ✓ Created function: update_updated_at_column()');
  
  // Function to calculate product popularity
  await pool.query(`
    CREATE OR REPLACE FUNCTION calculate_product_popularity(p_product_id INTEGER)
    RETURNS DECIMAL AS $$
    DECLARE
      view_count INTEGER;
      purchase_count INTEGER;
      cart_count INTEGER;
      popularity DECIMAL;
    BEGIN
      SELECT COUNT(*) INTO view_count
      FROM user_interactions
      WHERE product_id = p_product_id AND interaction_type = 'view'
      AND created_at > NOW() - INTERVAL '30 days';
      
      SELECT COUNT(*) INTO cart_count
      FROM user_interactions
      WHERE product_id = p_product_id AND interaction_type = 'add_to_cart'
      AND created_at > NOW() - INTERVAL '30 days';
      
      SELECT COUNT(*) INTO purchase_count
      FROM user_interactions
      WHERE product_id = p_product_id AND interaction_type = 'purchase'
      AND created_at > NOW() - INTERVAL '30 days';
      
      popularity := (view_count * 1.0 + cart_count * 3.0 + purchase_count * 5.0);
      popularity := LEAST(popularity / 10, 100);
      
      RETURN popularity;
    END;
    $$ LANGUAGE plpgsql
  `);
  logger.success('  ✓ Created function: calculate_product_popularity()');
  
  // Add trigger for product_embeddings
  await pool.query(`
    DROP TRIGGER IF EXISTS update_product_embeddings_timestamp ON product_embeddings;
    CREATE TRIGGER update_product_embeddings_timestamp
      BEFORE UPDATE ON product_embeddings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `);
  logger.success('  ✓ Created trigger: update_product_embeddings_timestamp');
}

// Create views
async function createViews() {
  logger.step('Creating analytics views');
  
  // Product performance view
  await pool.query(`
    CREATE OR REPLACE VIEW product_performance AS
    SELECT 
      p.product_id,
      COUNT(DISTINCT CASE WHEN ui.interaction_type = 'view' THEN ui.user_id END) as views,
      COUNT(DISTINCT CASE WHEN ui.interaction_type = 'purchase' THEN ui.user_id END) as purchases,
      COALESCE(sa.sentiment_score, 0) as sentiment_score
    FROM product_embeddings p
    LEFT JOIN user_interactions ui ON p.product_id = ui.product_id
    LEFT JOIN sentiment_analysis sa ON sa.entity_id = p.product_id AND sa.entity_type = 'product'
    GROUP BY p.product_id, sa.sentiment_score
  `);
  logger.success('  ✓ Created view: product_performance');
  
  // Daily metrics view
  await pool.query(`
    CREATE OR REPLACE VIEW daily_metrics AS
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_interactions,
      COUNT(DISTINCT user_id) as unique_users
    FROM user_interactions
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);
  logger.success('  ✓ Created view: daily_metrics');
}

// Seed initial data
async function seedInitialData() {
  logger.step('Seeding initial data');
  
  const result = await pool.query('SELECT COUNT(*) FROM user_interactions');
  const count = parseInt(result.rows[0].count);
  
  if (count > 0) {
    logger.info(`  ⚠ Data already exists (${count} interactions), skipping seed`);
    return;
  }
  
  // Seed sample model metrics
  await pool.query(`
    INSERT INTO model_metrics (model_name, version, metric_name, metric_value, dataset, sample_count)
    VALUES 
      ('recommendation', 'v1.0', 'precision', 0.85, 'test', 1000),
      ('recommendation', 'v1.0', 'recall', 0.78, 'test', 1000),
      ('fraud', 'v1.0', 'accuracy', 0.96, 'test', 500),
      ('sentiment', 'v1.0', 'accuracy', 0.91, 'test', 200)
    ON CONFLICT DO NOTHING
  `);
  logger.success('  ✓ Seeded sample model metrics');
  
  // Seed sample forecast models
  await pool.query(`
    INSERT INTO forecast_models (product_id, model_params, version)
    VALUES 
      (1, '{"trend": {"slope": 0.5, "intercept": 10}}', 'v1.0'),
      (2, '{"trend": {"slope": 0.3, "intercept": 5}}', 'v1.0')
    ON CONFLICT (product_id, version) DO NOTHING
  `);
  logger.success('  ✓ Seeded sample forecast models');
}

// Verify database setup
async function verifySetup() {
  logger.step('Verifying database setup');
  
  const checks = [
    { name: 'vector extension', query: "SELECT 1 FROM pg_extension WHERE extname = 'vector'", required: true },
    { name: 'user_interactions table', query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'user_interactions'", required: true },
    { name: 'product_embeddings table', query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'product_embeddings'", required: true },
    { name: 'fraud_alerts table', query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_alerts'", required: true },
    { name: 'forecast_models table', query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'forecast_models'", required: true }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      if (result.rows.length > 0) {
        logger.success(`  ✓ ${check.name}: OK`);
      } else {
        if (check.required) {
          logger.error(`  ✗ ${check.name}: MISSING`);
          allPassed = false;
        }
      }
    } catch (error) {
      logger.error(`  ✗ ${check.name}: ERROR - ${error.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Main function
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AI Service Database Initialization');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Step 1: Connect
    const connected = await testConnection();
    if (!connected) throw new Error('Failed to connect');
    
    // Step 2: Enable extensions
    await enableExtensions();
    
    // Step 3: Create tables
    await createTables();
    
    // Step 4: Create indexes
    await createIndexes();
    
    // Step 5: Create functions
    await createFunctions();
    
    // Step 6: Create views
    await createViews();
    
    // Step 7: Seed data
    await seedInitialData();
    
    // Step 8: Verify
    const verified = await verifySetup();
    
    if (verified) {
      console.log('\n' + '='.repeat(60));
      logger.success('✅ Database initialization completed successfully!');
      console.log('='.repeat(60) + '\n');
    } else {
      throw new Error('Verification failed');
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    logger.error(`❌ Database initialization failed: ${error.message}`);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

// Run the script
main();
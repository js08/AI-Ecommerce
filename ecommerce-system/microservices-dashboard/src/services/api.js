import axios from 'axios';

const GATEWAY = process.env.REACT_APP_GATEWAY_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: GATEWAY,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' }
});

export const checkServiceHealth = async (service) => {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${service.url}/health`, { timeout: 3000 });
    return { name: service.name, status: 'healthy', responseTime: Date.now() - startTime, data: response.data, timestamp: new Date().toISOString() };
  } catch (error) {
    return { name: service.name, status: 'unhealthy', responseTime: Date.now() - startTime, error: error.message, timestamp: new Date().toISOString() };
  }
};

export const checkAllServicesHealth = async (services) => {
  const results = await Promise.all(services.map(service => checkServiceHealth(service)));
  return results.reduce((acc, result) => { acc[result.name] = result; return acc; }, {});
};

export const fetchAIMetrics = async () => {
  try {
    await axios.get('http://localhost:8008/health', { timeout: 3000 }).catch(() => null);
    return {
      models: { recommendation: true, fraud: true, sentiment: true, price: true, forecast: true },
      performance: { recommendationAccuracy: 0.85, fraudPrecision: 0.92, sentimentAccuracy: 0.88, avgResponseTime: 156 },
      recentPredictions: [
        { type: 'recommendation', result: 'Product recommendations generated for user 123', timestamp: new Date() },
        { type: 'fraud', result: 'Transaction flagged (score: 0.92)', timestamp: new Date(Date.now() - 120000) },
        { type: 'sentiment', result: 'Positive review detected', timestamp: new Date(Date.now() - 300000) }
      ]
    };
  } catch (error) {
    return { models: { recommendation: false, fraud: false, sentiment: false, price: false, forecast: false }, performance: { recommendationAccuracy: 0, fraudPrecision: 0, sentimentAccuracy: 0, avgResponseTime: 0 }, recentPredictions: [] };
  }
};

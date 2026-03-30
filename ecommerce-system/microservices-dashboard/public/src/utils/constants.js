export const SERVICES = [
  { name: 'API Gateway', url: 'http://localhost:3000', port: 3000, icon: '🚪' },
  { name: 'User Service', url: 'http://localhost:3001', port: 3001, icon: '👤' },
  { name: 'Product Service', url: 'http://localhost:8080', port: 8080, icon: '📦' },
  { name: 'Cart Service', url: 'http://localhost:8000', port: 8000, icon: '🛒' },
  { name: 'Order Service', url: 'http://localhost:8081', port: 8081, icon: '📋' },
  { name: 'Payment Service', url: 'http://localhost:3005', port: 3005, icon: '💳' },
  { name: 'Inventory Service', url: 'http://localhost:3006', port: 3006, icon: '📊' },
  { name: 'Notification Service', url: 'http://localhost:3007', port: 3007, icon: '🔔' },
  { name: 'AI Service', url: 'http://localhost:8008', port: 8008, icon: '🤖' }
];

export const REFRESH_INTERVAL = 30000;
export const STATUS_COLORS = { healthy: '#4caf50', unhealthy: '#f44336', loading: '#ff9800' };
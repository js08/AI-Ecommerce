import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Header from './components/Header';
import ServiceCard from './components/ServiceCard';
import MetricsChart from './components/MetricsChart';
import RecentActivity from './components/RecentActivity';
import AIDashboard from './components/AIDashboard';
import { api, checkAllServicesHealth, fetchAIMetrics } from './services/api';
import './App.css';

function App() {
  const [services, setServices] = useState([
    { name: 'API Gateway', url: 'http://localhost:3000', status: 'loading', port: 3000, icon: '🚪' },
    { name: 'User Service', url: 'http://localhost:3001', status: 'loading', port: 3001, icon: '👤' },
    { name: 'Product Service', url: 'http://localhost:8080', status: 'loading', port: 8080, icon: '📦' },
    { name: 'Cart Service', url: 'http://localhost:8000', status: 'loading', port: 8000, icon: '🛒' },
    { name: 'Order Service', url: 'http://localhost:8081', status: 'loading', port: 8081, icon: '📋' },
    { name: 'Payment Service', url: 'http://localhost:3005', status: 'loading', port: 3005, icon: '💳' },
    { name: 'Inventory Service', url: 'http://localhost:3006', status: 'loading', port: 3006, icon: '📊' },
    { name: 'Notification Service', url: 'http://localhost:3007', status: 'loading', port: 3007, icon: '🔔' },
    { name: 'AI Service', url: 'http://localhost:8008', status: 'loading', port: 8008, icon: '🤖' }
  ]);

  const [aiMetrics, setAiMetrics] = useState({
    models: { recommendation: false, fraud: false, sentiment: false, price: false, forecast: false },
    performance: { recommendationAccuracy: 0, fraudPrecision: 0, sentimentAccuracy: 0, avgResponseTime: 0 },
    recentPredictions: []
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const checkServices = async () => {
    try {
      const results = await checkAllServicesHealth(services);
      setServices(prevServices => 
        prevServices.map(service => ({
          ...service,
          status: results[service.name]?.status || 'unhealthy',
          responseTime: results[service.name]?.responseTime,
          lastCheck: new Date().toISOString()
        }))
      );
      return results;
    } catch (error) {
      console.error('Health check failed:', error);
      return {};
    }
  };

  const getAIMetrics = async () => {
    try {
      const metrics = await fetchAIMetrics();
      setAiMetrics(metrics);
    } catch (error) {
      console.error('Failed to fetch AI metrics:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const orders = await api.get('/api/v1/orders?limit=5').catch(() => ({ data: { orders: [] } }));
      const activities = [];
      if (orders.data?.orders) {
        orders.data.orders.forEach(order => {
          activities.push({
            id: `order-${order.id}`,
            type: 'order',
            message: `Order #${order.order_number} created - $${order.total_amount}`,
            timestamp: order.created_at,
            status: order.status
          });
        });
      }
      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      await Promise.all([checkServices(), getAIMetrics(), fetchRecentActivity()]);
      setLastUpdated(new Date());
      setIsLoading(false);
      toast.success('Dashboard updated successfully');
    };
    loadDashboard();
    
    const interval = setInterval(async () => {
      await checkServices();
      await getAIMetrics();
      setLastUpdated(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const totalCount = services.length;
  const healthPercentage = (healthyCount / totalCount) * 100;

  return (
    <div className="dashboard">
      <Toaster position="top-right" />
      <Header lastUpdated={lastUpdated} onRefresh={() => { checkServices(); getAIMetrics(); fetchRecentActivity(); setLastUpdated(new Date()); }} />
      
      <div className="status-banner">
        <div className="status-banner-content">
          <div className="status-icon">{healthPercentage === 100 ? '✅' : healthPercentage > 70 ? '⚠️' : '🔴'}</div>
          <div className="status-info">
            <h3>System Health: {healthyCount}/{totalCount} Services Operational</h3>
            <div className="health-bar"><div className="health-bar-fill" style={{ width: `${healthPercentage}%`, backgroundColor: healthPercentage === 100 ? '#4caf50' : healthPercentage > 70 ? '#ff9800' : '#f44336' }} /></div>
          </div>
        </div>
      </div>
      
      <div className="services-grid">
        {services.map(service => (<ServiceCard key={service.name} service={service} />))}
      </div>
      
      <AIDashboard metrics={aiMetrics} />
      
      <div className="dashboard-bottom">
        <div className="metrics-section"><h3>System Metrics</h3><MetricsChart services={services} /></div>
        <div className="activity-section"><h3>Recent Activity</h3><RecentActivity activities={recentActivities} /></div>
      </div>
      
      {isLoading && (<div className="loading-overlay"><div className="spinner"></div><p>Loading dashboard data...</p></div>)}
    </div>
  );
}

export default App;
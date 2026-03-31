import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MetricsChart = ({ services }) => {
  const data = [
    { time: '10:00', api: 45, user: 32, product: 28, cart: 35, order: 42, ai: 156 },
    { time: '10:05', api: 48, user: 35, product: 30, cart: 38, order: 45, ai: 162 },
    { time: '10:10', api: 42, user: 30, product: 26, cart: 32, order: 40, ai: 148 },
    { time: '10:15', api: 55, user: 42, product: 38, cart: 45, order: 52, ai: 178 },
    { time: '10:20', api: 52, user: 38, product: 34, cart: 41, order: 48, ai: 165 },
    { time: '10:25', api: 44, user: 31, product: 27, cart: 33, order: 41, ai: 152 },
    { time: '10:30', api: 46, user: 33, product: 29, cart: 36, order: 43, ai: 158 }
  ];

  const currentMetrics = services.reduce((acc, service) => {
    if (service.name === 'API Gateway') acc.api = service.responseTime || 0;
    if (service.name === 'User Service') acc.user = service.responseTime || 0;
    if (service.name === 'Product Service') acc.product = service.responseTime || 0;
    if (service.name === 'Cart Service') acc.cart = service.responseTime || 0;
    if (service.name === 'Order Service') acc.order = service.responseTime || 0;
    if (service.name === 'AI Service') acc.ai = service.responseTime || 0;
    return acc;
  }, {});

  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="api" stroke="#667eea" name="API Gateway" strokeWidth={2} />
          <Line type="monotone" dataKey="user" stroke="#48bb78" name="User Service" strokeWidth={2} />
          <Line type="monotone" dataKey="product" stroke="#ed8936" name="Product Service" strokeWidth={2} />
          <Line type="monotone" dataKey="cart" stroke="#9f7aea" name="Cart Service" strokeWidth={2} />
          <Line type="monotone" dataKey="order" stroke="#f687b3" name="Order Service" strokeWidth={2} />
          <Line type="monotone" dataKey="ai" stroke="#e53e3e" name="AI Service" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Current Response Times:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
          {Object.entries(currentMetrics).map(([key, value]) => (<div key={key} style={{ fontSize: '12px' }}><strong>{key.toUpperCase()}:</strong> {value || 'N/A'}ms</div>))}
        </div>
      </div>
    </div>
  );
};

export default MetricsChart;
import React, { useState } from 'react';
import { api } from '../services/api';

const ServiceCard = ({ service }) => {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchServiceDetails = async () => {
    if (details) { setExpanded(!expanded); return; }
    setLoading(true);
    try {
      const response = await api.get(`${service.url}/health`).catch(() => null);
      setDetails(response?.data || {});
      setExpanded(true);
    } catch (error) { console.error('Failed to fetch details:', error); }
    finally { setLoading(false); }
  };

  const statusClass = service.status === 'healthy' ? 'status-healthy' : service.status === 'unhealthy' ? 'status-unhealthy' : 'status-loading';

  return (
    <div className={`service-card ${service.status}`}>
      <div className="service-header">
        <div className="service-icon">{service.icon}</div>
        <div className="service-info"><h3>{service.name}</h3><div className="service-port">Port: {service.port}</div></div>
      </div>
      <div className={`service-status ${statusClass}`}>{service.status === 'healthy' ? '🟢 Operational' : service.status === 'unhealthy' ? '🔴 Down' : '🟡 Loading...'}</div>
      <div className="service-details">
        <div className="detail-row"><span className="detail-label">URL:</span><span className="detail-value">{service.url}</span></div>
        {service.responseTime && (<div className="detail-row"><span className="detail-label">Response Time:</span><span className="detail-value response-time">{service.responseTime}ms</span></div>)}
        {service.lastCheck && (<div className="detail-row"><span className="detail-label">Last Check:</span><span className="detail-value">{new Date(service.lastCheck).toLocaleTimeString()}</span></div>)}
        <button className="refresh-btn" onClick={fetchServiceDetails} style={{ marginTop: '10px', width: '100%', background: '#f0f0f0', color: '#333' }} disabled={loading}>{loading ? 'Loading...' : expanded ? 'Hide Details' : 'View Details'}</button>
        {expanded && details && (<div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}><pre style={{ fontSize: '11px', overflow: 'auto' }}>{JSON.stringify(details, null, 2)}</pre></div>)}
      </div>
    </div>
  );
};

export default ServiceCard;
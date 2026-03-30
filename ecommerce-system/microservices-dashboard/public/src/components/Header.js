import React from 'react';
import { formatDistanceToNow } from 'date-fns';

const Header = ({ lastUpdated, onRefresh }) => {
  return (
    <div className="dashboard-header">
      <div className="header-title">
        <h1>🛍️ Microservices Dashboard</h1>
        <p>Monitor all e-commerce microservices and AI services</p>
      </div>
      <div className="header-stats">
        <div className="stat">
          <div className="stat-value">{formatDistanceToNow(lastUpdated, { addSuffix: true })}</div>
          <div className="stat-label">Last Updated</div>
        </div>
      </div>
      <button className="refresh-btn" onClick={onRefresh}>🔄 Refresh</button>
    </div>
  );
};

export default Header;
import React from 'react';

const AIDashboard = ({ metrics }) => {
  const models = [
    { name: 'Recommendation Engine', icon: '🎯', key: 'recommendation', accuracy: metrics.performance?.recommendationAccuracy },
    { name: 'Fraud Detection', icon: '🛡️', key: 'fraud', accuracy: metrics.performance?.fraudPrecision },
    { name: 'Sentiment Analysis', icon: '😊', key: 'sentiment', accuracy: metrics.performance?.sentimentAccuracy },
    { name: 'Price Optimizer', icon: '💰', key: 'price', accuracy: null },
    { name: 'Demand Forecast', icon: '📈', key: 'forecast', accuracy: null }
  ];

  return (
    <div className="ai-dashboard">
      <div className="ai-header"><h2>🤖 AI Service Dashboard</h2><p>Machine Learning models for intelligent e-commerce</p></div>
      <div className="ai-models-grid">
        {models.map(model => (
          <div key={model.key} className="ai-model-card">
            <div className="model-icon">{model.icon}</div>
            <div className="model-name">{model.name}</div>
            <div className={`model-status ${metrics.models?.[model.key] ? 'active' : 'inactive'}`}>{metrics.models?.[model.key] ? 'Active' : 'Loading...'}</div>
            {model.accuracy && <div style={{ fontSize: '12px', marginTop: '8px' }}>Accuracy: {(model.accuracy * 100).toFixed(1)}%</div>}
          </div>
        ))}
      </div>
      <div className="ai-metrics">
        <div className="metric"><div className="metric-value">{metrics.performance?.avgResponseTime || 0}ms</div><div className="metric-label">Avg Response Time</div></div>
        <div className="metric"><div className="metric-value">{metrics.performance?.recommendationAccuracy ? `${(metrics.performance.recommendationAccuracy * 100).toFixed(0)}%` : 'N/A'}</div><div className="metric-label">Recommendation Accuracy</div></div>
        <div className="metric"><div className="metric-value">{metrics.performance?.fraudPrecision ? `${(metrics.performance.fraudPrecision * 100).toFixed(0)}%` : 'N/A'}</div><div className="metric-label">Fraud Detection Precision</div></div>
        <div className="metric"><div className="metric-value">{metrics.performance?.sentimentAccuracy ? `${(metrics.performance.sentimentAccuracy * 100).toFixed(0)}%` : 'N/A'}</div><div className="metric-label">Sentiment Accuracy</div></div>
      </div>
      {metrics.recentPredictions && metrics.recentPredictions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Recent AI Predictions</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {metrics.recentPredictions.slice(0, 5).map((pred, idx) => (
              <div key={idx} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', marginBottom: '5px', borderRadius: '8px', fontSize: '12px' }}>
                <strong>{pred.type}:</strong> {pred.result}
                <span style={{ float: 'right', opacity: 0.6 }}>{new Date(pred.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIDashboard;
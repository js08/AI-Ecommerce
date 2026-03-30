import React from 'react';
import { formatDistanceToNow } from 'date-fns';

const RecentActivity = ({ activities }) => {
  const getActivityIcon = (type, status) => {
    if (type === 'order') return status === 'confirmed' ? '✅' : '📦';
    if (type === 'fraud') return '⚠️';
    if (type === 'recommendation') return '🎯';
    return '📝';
  };

  if (activities.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No recent activity</div>;
  }

  return (
    <div className="activity-list">
      {activities.map(activity => (
        <div key={activity.id} className="activity-item">
          <div className="activity-icon">{getActivityIcon(activity.type, activity.status)}</div>
          <div className="activity-content">
            <div className="activity-message">{activity.message}</div>
            <div className="activity-time">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</div>
          </div>
          {activity.status && <div className="activity-status">{activity.status}</div>}
        </div>
      ))}
    </div>
  );
};

export default RecentActivity;
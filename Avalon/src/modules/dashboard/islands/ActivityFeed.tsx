import { useState, useEffect } from 'preact/hooks';

interface Activity {
  id: number;
  user: string;
  action: string;
  time: string;
  icon: string;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, user: 'Alice', action: 'created a new post', time: '2 min ago', icon: '📝' },
    { id: 2, user: 'Bob', action: 'commented on your photo', time: '5 min ago', icon: '💬' },
    { id: 3, user: 'Charlie', action: 'liked your post', time: '10 min ago', icon: '❤️' },
  ]);

  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;

    const actions = [
      'created a new post',
      'commented on a photo',
      'liked a post',
      'shared a document',
      'joined the team',
      'updated their profile'
    ];
    
    const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const icons = ['📝', '💬', '❤️', '📄', '👋', '✏️'];

    const interval = setInterval(() => {
      const newActivity: Activity = {
        id: Date.now(),
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        time: 'just now',
        icon: icons[Math.floor(Math.random() * icons.length)]
      };

      setActivities(prev => [newActivity, ...prev.slice(0, 4)]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      backgroundColor: 'white',
      maxWidth: '350px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0 }}>📊 Activity Feed</h3>
        <button
          onClick={() => setIsLive(!isLive)}
          style={{
            padding: '4px 12px',
            backgroundColor: isLive ? '#4CAF50' : '#9e9e9e',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {isLive ? '● Live' : '○ Paused'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activities.map(activity => (
          <div 
            key={activity.id}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '8px',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '20px' }}>{activity.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px' }}>
                <strong>{activity.user}</strong> {activity.action}
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#999' }}>
                {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ 
        margin: '16px 0 0 0', 
        fontSize: '11px', 
        color: '#999',
        textAlign: 'center'
      }}>
        Module: <code>modules/dashboard</code>
      </p>
    </div>
  );
}

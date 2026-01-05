import { useState, useEffect } from 'preact/hooks';

interface StatsCardProps {
  title?: string;
  initialValue?: number;
}

export default function StatsCard({ title = 'Active Users', initialValue = 1234 }: StatsCardProps) {
  const [value, setValue] = useState(initialValue);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('up');
  const [percentage, setPercentage] = useState(12.5);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      const change = Math.floor(Math.random() * 20) - 10;
      setValue(prev => Math.max(0, prev + change));
      
      if (change > 0) setTrend('up');
      else if (change < 0) setTrend('down');
      else setTrend('stable');
      
      setPercentage(Math.abs(change / initialValue * 100));
    }, 3000);

    return () => clearInterval(interval);
  }, [initialValue]);

  const trendColors = {
    up: '#4CAF50',
    down: '#f44336',
    stable: '#9e9e9e'
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→'
  };

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      minWidth: '200px'
    }}>
      <p style={{ 
        margin: '0 0 8px 0', 
        color: '#666',
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </p>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ 
          fontSize: '32px', 
          fontWeight: 'bold',
          color: '#333'
        }}>
          {value.toLocaleString()}
        </span>
        
        <span style={{ 
          color: trendColors[trend],
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          {trendIcons[trend]} {percentage.toFixed(1)}%
        </span>
      </div>
      
      <p style={{ 
        margin: '12px 0 0 0', 
        fontSize: '11px', 
        color: '#999' 
      }}>
        Module: <code>modules/dashboard</code>
      </p>
    </div>
  );
}

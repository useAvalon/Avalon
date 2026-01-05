import { useState } from 'preact/hooks';

/**
 * Dashboard Counter - demonstrates name collision handling
 * This Counter is in modules/dashboard namespace, different from the default Counter
 */
export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      padding: '20px',
      border: '2px solid #9C27B0',
      borderRadius: '12px',
      backgroundColor: '#f3e5f5',
      textAlign: 'center',
      maxWidth: '250px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#7B1FA2' }}>
        📊 Dashboard Counter
      </h3>
      
      <div style={{ 
        fontSize: '48px', 
        fontWeight: 'bold',
        color: '#9C27B0',
        margin: '16px 0'
      }}>
        {count}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => setCount(c => c - 1)}
          style={{
            padding: '8px 20px',
            fontSize: '18px',
            backgroundColor: '#CE93D8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          −
        </button>
        <button
          onClick={() => setCount(0)}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: '8px 20px',
            fontSize: '18px',
            backgroundColor: '#CE93D8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
      </div>
      
      <p style={{ 
        margin: '16px 0 0 0', 
        fontSize: '11px', 
        color: '#7B1FA2' 
      }}>
        Namespace: <code>modules/dashboard</code>
      </p>
      <p style={{ 
        margin: '4px 0 0 0', 
        fontSize: '10px', 
        color: '#999' 
      }}>
        (Different from default Counter!)
      </p>
    </div>
  );
}

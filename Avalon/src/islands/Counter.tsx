import { useState } from 'preact/hooks';

/**
 * Default Counter - in the default /src/islands/ directory
 * This has highest priority when resolving "Counter" without namespace
 */
export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      padding: '20px',
      border: '2px solid #2196F3',
      borderRadius: '12px',
      backgroundColor: '#e3f2fd',
      textAlign: 'center',
      maxWidth: '250px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#1976D2' }}>
        🔢 Default Counter
      </h3>
      
      <div style={{ 
        fontSize: '48px', 
        fontWeight: 'bold',
        color: '#2196F3',
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
            backgroundColor: '#64B5F6',
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
            backgroundColor: '#2196F3',
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
            backgroundColor: '#64B5F6',
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
        color: '#1976D2' 
      }}>
        Namespace: <code>(default)</code>
      </p>
      <p style={{ 
        margin: '4px 0 0 0', 
        fontSize: '10px', 
        color: '#999' 
      }}>
        Highest priority for "Counter"
      </p>
    </div>
  );
}

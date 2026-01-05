import { useState } from 'preact/hooks';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (email && password) {
      setMessage(`Welcome back, ${email}!`);
    } else {
      setMessage('Please fill in all fields');
    }
    setIsLoading(false);
  };

  return (
    <div style={{
      padding: '24px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      maxWidth: '400px',
      backgroundColor: '#fafafa'
    }}>
      <h3 style={{ marginTop: 0, color: '#333' }}>🔐 Login Form</h3>
      <p style={{ fontSize: '12px', color: '#666' }}>
        Module: <code>modules/auth</code>
      </p>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder="user@example.com"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isLoading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      {message && (
        <p style={{
          marginTop: '16px',
          padding: '8px',
          backgroundColor: message.includes('Welcome') ? '#e8f5e9' : '#ffebee',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

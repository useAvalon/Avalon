/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function LoginForm() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (token.trim()) {
      document.cookie = `auth_token=${encodeURIComponent(token.trim())}; path=/; max-age=86400`;
      window.location.href = '/admin';
    } else {
      setError('Please enter a token');
    }
  };

  const useToken = (demoToken: string) => {
    setToken(demoToken);
    setError('');
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
            Authentication Token
          </label>
          <input
            type="text"
            id="token"
            value={token}
            onInput={(e) => setToken((e.target as HTMLInputElement).value)}
            placeholder="Enter your token..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all"
          />
        </div>
        
        <button
          type="submit"
          className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
        >
          Sign In
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <h3 className="text-xs uppercase text-gray-400 font-semibold tracking-wider mb-3">Demo Tokens (for testing)</h3>
        
        <button
          type="button"
          onClick={() => useToken('demo-admin-token')}
          className="w-full mb-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all"
        >
          <span className="mr-2">👑</span>
          Admin: <code className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-xs font-mono ml-1">demo-admin-token</code>
        </button>
        
        <button
          type="button"
          onClick={() => useToken('demo-user-token')}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all"
        >
          <span className="mr-2">👤</span>
          User: <code className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-lg text-xs font-mono ml-1">demo-user-token</code>
          <span className="text-gray-400 text-xs ml-2">(will show 403)</span>
        </button>
      </div>
    </div>
  );
}

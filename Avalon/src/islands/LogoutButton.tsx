/** @jsxImportSource preact */

interface LogoutButtonProps {
  variant?: 'default' | 'primary';
  redirectTo?: string;
}

export default function LogoutButton({ variant = 'default', redirectTo = '/admin/login' }: LogoutButtonProps) {
  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = redirectTo;
  };

  if (variant === 'primary') {
    return (
      <button 
        onClick={handleLogout} 
        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 text-sm cursor-pointer"
      >
        Try Different Account
      </button>
    );
  }

  return (
    <button 
      onClick={handleLogout} 
      className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-all text-sm cursor-pointer"
    >
      Logout
    </button>
  );
}

import { renderIsland } from '@avalon/avalon';

export default async function AdminLogin() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Admin Login - Avalon</title>
        <link rel="stylesheet" href="/src/styles/main.css" />
      </head>
      <body class="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4 font-sans antialiased">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ padding: '2rem' }}>
          <h1 class="text-2xl font-bold text-gray-900" style={{ marginBottom: '0.5rem' }}>🔐 Admin Login</h1>
          <p class="text-gray-500 text-sm" style={{ marginBottom: '1.5rem' }}>Enter your authentication token to access the admin area.</p>
          
          <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
            Please log in to access the admin area.
          </div>
          
          {await renderIsland({
            src: '/src/islands/LoginForm.tsx',
            condition: 'on:load',
            framework: 'preact',
          })}
          
          <a href="/" class="block text-center text-violet-600 hover:text-violet-800 text-sm font-medium" style={{ marginTop: '1.5rem' }}>
            ← Back to Home
          </a>
        </div>
      </body>
    </html>
  );
}

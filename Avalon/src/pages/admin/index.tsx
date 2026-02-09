import { renderIsland } from '@avalon/avalon';

export default async function AdminDashboard() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Admin Dashboard - Avalon</title>
        <link rel="stylesheet" href="/src/styles/main.css" />
      </head>
      <body class="min-h-screen bg-slate-900">
        {/* Header */}
        <header class="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-10">
          <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="text-2xl">🔐</span>
              <span class="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Admin Dashboard</span>
            </h1>
            <div class="flex items-center gap-4">
              <span class="bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-full text-sm font-medium border border-cyan-500/20">
                👑 admin@example.com
              </span>
              {await renderIsland({
                src: '/src/islands/LogoutButton.tsx',
                props: { variant: 'default', redirectTo: '/admin/login' },
                condition: 'on:load',
                framework: 'preact',
              })}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main class="max-w-6xl mx-auto px-6 py-10">
          {/* Welcome Section */}
          <div class="mb-10">
            <h2 class="text-4xl font-bold text-white mb-3">Welcome back, Admin!</h2>
            <p class="text-slate-400 text-lg">You've successfully authenticated with admin privileges.</p>
          </div>

          {/* Cards Grid */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition-colors">
              <div class="flex items-center gap-3 mb-4">
                <span class="text-2xl">🛡️</span>
                <h3 class="text-lg font-semibold text-white">Protected by Middleware</h3>
              </div>
              <p class="text-slate-400 text-sm leading-relaxed mb-3">
                This page is protected by route-scoped middleware at{' '}
                <code class="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-lg text-xs font-mono">
                  src/pages/admin/_middleware.ts
                </code>
              </p>
              <p class="text-slate-500 text-xs">
                The middleware checks for a valid token and admin role before allowing access.
              </p>
            </div>

            {/* Card 2 */}
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition-colors">
              <div class="flex items-center gap-3 mb-4">
                <span class="text-2xl">🔑</span>
                <h3 class="text-lg font-semibold text-white">Authentication Flow</h3>
              </div>
              <p class="text-slate-400 text-sm mb-4">The middleware checks for tokens in:</p>
              <ul class="space-y-2">
                <li class="flex items-center gap-2 text-slate-400 text-sm">
                  <span class="text-cyan-400">•</span>
                  <code class="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-lg text-xs font-mono">Authorization</code>
                  <span class="text-slate-500">header (for APIs)</span>
                </li>
                <li class="flex items-center gap-2 text-slate-400 text-sm">
                  <span class="text-cyan-400">•</span>
                  <code class="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-lg text-xs font-mono">auth_token</code>
                  <span class="text-slate-500">cookie (for browser)</span>
                </li>
              </ul>
            </div>

            {/* Card 3 */}
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition-colors">
              <div class="flex items-center gap-3 mb-4">
                <span class="text-2xl">🧪</span>
                <h3 class="text-lg font-semibold text-white">Test Tokens</h3>
              </div>
              <p class="text-slate-400 text-sm mb-4">Try these demo tokens:</p>
              <ul class="space-y-2">
                <li class="flex items-center gap-2 text-sm">
                  <code class="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg text-xs font-mono">demo-admin-token</code>
                  <span class="text-slate-500">→ Admin access</span>
                  <span class="text-emerald-400">✓</span>
                </li>
                <li class="flex items-center gap-2 text-sm">
                  <code class="bg-red-500/10 text-red-400 px-2 py-1 rounded-lg text-xs font-mono">demo-user-token</code>
                  <span class="text-slate-500">→ Forbidden page</span>
                  <span class="text-red-400">✗</span>
                </li>
              </ul>
            </div>

            {/* Card 4 */}
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition-colors">
              <div class="flex items-center gap-3 mb-4">
                <span class="text-2xl">📁</span>
                <h3 class="text-lg font-semibold text-white">Admin Pages</h3>
              </div>
              <p class="text-slate-400 text-sm mb-4">
                All pages under <code class="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-lg text-xs font-mono">/admin/*</code> are protected:
              </p>
              <ul class="space-y-2">
                <li class="text-sm">
                  <a href="/admin" class="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">/admin</a>
                  <span class="text-slate-500 ml-2">— Dashboard</span>
                </li>
                <li class="text-sm">
                  <a href="/admin/login" class="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">/admin/login</a>
                  <span class="text-slate-500 ml-2">— Login page</span>
                </li>
                <li class="text-sm">
                  <a href="/admin/forbidden" class="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">/admin/forbidden</a>
                  <span class="text-slate-500 ml-2">— 403 page</span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

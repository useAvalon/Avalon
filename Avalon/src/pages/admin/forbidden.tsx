import { renderIsland } from '@avalon/avalon';

export default async function AdminForbidden() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Access Denied - Avalon</title>
        <link rel="stylesheet" href="/src/styles/main.css" />
      </head>
      <body class="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-8 w-full max-w-md text-center">
          <div class="text-6xl mb-4">🚫</div>
          <h1 class="text-2xl font-bold text-red-600 mb-3">Access Denied</h1>
          <p class="text-gray-500 text-sm leading-relaxed mb-6">
            You're logged in, but you need admin privileges to access this page.
            Please contact an administrator or try a different account.
          </p>
          
          <div class="flex gap-3 justify-center flex-wrap">
            <a href="/" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
              ← Back to Home
            </a>
            {await renderIsland({
              src: '/src/islands/LogoutButton.tsx',
              props: { variant: 'primary', redirectTo: '/admin/login' },
              condition: 'on:load',
              framework: 'preact',
            })}
          </div>
        </div>
      </body>
    </html>
  );
}

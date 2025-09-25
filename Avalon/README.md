# 🏔️ Avalon Framework Demo

A comprehensive demonstration of the Avalon framework showcasing multi-framework SSR with islands architecture.

## 🚀 Quick Start

```bash
# Install dependencies
deno install

# Start development server
deno task dev

# Build for production
deno task build

# Start production server
deno task preview
```

## 📁 Project Structure

```
Avalon/
├── src/
│   ├── pages/              # App pages (file-system routing)
│   │   ├── index.tsx       # Home page
│   │   ├── frameworks.tsx  # Multi-framework demo
│   │   ├── islands.tsx     # Islands architecture demo
│   │   ├── layouts.tsx     # Layout system demo
│   │   ├── api-demo.tsx    # API routes demo
│   │   └── blog/           # Blog section with nested layout
│   │       ├── index.tsx
│   │       ├── getting-started.tsx
│   │       └── advanced-features.tsx
│   ├── layouts/            # Layout components
│   │   ├── _layout.tsx     # Root layout
│   │   └── blog/
│   │       └── _layout.tsx # Blog layout
│   ├── islands/            # Interactive components
│   │   ├── PreactCounter.tsx
│   │   ├── VueCounter.vue
│   │   ├── SvelteCounter.svelte
│   │   ├── SolidCounter.tsx
│   │   └── ApiTester.tsx
│   ├── api/                # API routes
│   │   ├── _middleware.ts  # API middleware
│   │   ├── hello.ts        # Simple API
│   │   ├── time.ts         # Time API
│   │   └── users/
│   │       └── [id].ts     # Dynamic route
│   └── middleware/         # Global middleware
│       └── _middleware.ts
├── public/                 # Static assets
├── deno.json              # Deno configuration
├── vite.config.ts         # Vite configuration
└── README.md
```

## 🎯 What's Demonstrated

### 🏝️ Islands Architecture

- **Selective Hydration**: Only interactive components load JavaScript
- **Framework Isolation**: Each island can use a different framework
- **Performance**: Minimal JavaScript for optimal loading

### 🎨 Multi-Framework Support

- **React/Preact**: JSX components with hooks
- **Vue**: Single File Components with Composition API
- **Svelte**: Reactive components with minimal overhead
- **Solid**: Fine-grained reactivity with signals

### 📁 File-System Routing

- **Automatic Routes**: URL structure matches file structure
- **Dynamic Routes**: Support for parameters like `[id]`
- **Nested Layouts**: Hierarchical layout composition

### 🛡️ Middleware System

- **Hierarchical**: Middleware applies based on file structure
- **Flexible**: Support for pages and API routes
- **Composable**: Chain multiple middleware functions

### ⚡ Performance Features

- **Code Splitting**: Each island gets its own bundle
- **Lazy Loading**: Islands load when entering viewport
- **SSR**: Server-side rendering for all content
- **Static Generation**: Pre-render static content

## 🌐 Available Routes

- `/` - Home page with feature overview
- `/frameworks` - Multi-framework counter demo
- `/islands` - Islands architecture explanation
- `/layouts` - Layout system demonstration
- `/api-demo` - API routes with live testing
- `/blog` - Blog section with nested layout
- `/blog/getting-started` - Getting started guide
- `/blog/advanced-features` - Advanced features guide

## 🔌 API Endpoints

- `GET /api/hello` - Simple greeting API
- `GET /api/time` - Current server time
- `GET /api/users/[id]` - User data by ID

## 🛠️ Development

The demo includes:

- Hot module replacement for all frameworks
- TypeScript support throughout
- Automatic island discovery and bundling
- Development middleware with logging
- Error boundaries for graceful failures

## 📦 Dependencies

- **Deno**: Runtime and package manager
- **Vite**: Build tool and dev server
- **Framework Plugins**: Vue, Svelte, Solid support
- **Avalon**: The framework itself (imported from parent directory)

## 🎨 Styling

The demo uses inline styles for simplicity, but Avalon supports:

- CSS Modules
- Styled Components
- Tailwind CSS
- Framework-specific styling solutions

## 🚀 Deployment

Build the project and deploy the `dist` folder to any static hosting service or run the production server on any Node.js/Deno compatible platform.

---

**Built with ❤️ using Avalon Framework**

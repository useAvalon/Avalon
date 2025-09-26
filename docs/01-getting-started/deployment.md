# Deployment Guide

Ready to share your Avalon application with the world? This guide covers deployment to popular platforms, from simple static hosting to full-featured cloud platforms.

## Build Your Application

Before deploying, you need to build your application for production:

```bash
# Build your application
deno task build

# This creates a 'dist' directory with:
# - Static HTML files
# - Optimized JavaScript bundles
# - CSS and other assets
```

Your build output will look like this:

```
dist/
├── _avalon/              # Framework assets
│   ├── islands/         # Island JavaScript bundles
│   ├── client.js        # Client-side runtime
│   └── manifest.json    # Build manifest
├── index.html           # Your pages as HTML files
├── about.html
├── api/                 # API routes (for server deployments)
└── assets/              # Static assets
```

## Deployment Options

### 🚀 Static Site Deployment (Recommended for most apps)

If your app doesn't use API routes or server-side features, deploy as a static site:

#### Vercel (Easiest)

1. **Install Vercel CLI**:

```bash
npm i -g vercel
```

2. **Deploy**:

```bash
# From your project directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? (your-app-name)
# - Directory? ./
# - Override settings? No
```

3. **Configure Build** (create `vercel.json`):

```json
{
	"buildCommand": "deno task build",
	"outputDirectory": "dist",
	"installCommand": "deno install"
}
```

#### Netlify

1. **Build and Deploy**:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

2. **Or use Git Integration**:
   - Connect your GitHub/GitLab repository
   - Set build command: `deno task build`
   - Set publish directory: `dist`

#### GitHub Pages

1. **Create `.github/workflows/deploy.yml`**:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v2.5.x

      - name: Build
        run: deno task build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages

### 🖥️ Server Deployment (For apps with API routes)

If your app uses API routes or server-side features, you need a server deployment:

#### Deno Deploy (Recommended for Deno)

1. **Create `main.ts`**:

```typescript
import { createServer } from '@avalon/avalon';

const server = createServer({
	srcDir: './src',
	port: parseInt(Deno.env.get('PORT') || '8000'),
	frameworks: ['preact', 'vue', 'svelte'],
});

await server.start();
```

2. **Deploy**:

```bash
# Install Deno Deploy CLI
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts

# Deploy
deployctl deploy --project=your-project-name main.ts
```

3. **Or use GitHub Integration**:
   - Connect your repository at [dash.deno.com](https://dash.deno.com)
   - Set entry point: `main.ts`
   - Auto-deploy on push

#### Railway

1. **Create `railway.toml`**:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "deno run --allow-all src/server.ts"

[[services]]
name = "web"
```

2. **Deploy**:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

#### Fly.io

1. **Create `fly.toml`**:

```toml
app = "your-app-name"
primary_region = "sjc"

[build]
  image = "denoland/deno:alpine"

[[services]]
  http_checks = []
  internal_port = 8000
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[env]
  PORT = "8000"
```

2. **Create `Dockerfile`**:

```dockerfile
FROM denoland/deno:alpine

WORKDIR /app

COPY . .

RUN deno cache src/server.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-all", "src/server.ts"]
```

3. **Deploy**:

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly deploy
```

#### DigitalOcean App Platform

1. **Create `.do/app.yaml`**:

```yaml
name: your-avalon-app
services:
  - name: web
    source_dir: /
    github:
      repo: your-username/your-repo
      branch: main
    run_command: deno run --allow-all src/server.ts
    environment_slug: deno
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 8000
    routes:
      - path: /
```

2. **Deploy via Dashboard**:
   - Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
   - Create App → GitHub → Select Repository
   - Configure build settings

### 🐳 Docker Deployment

For maximum flexibility, use Docker:

1. **Create `Dockerfile`**:

```dockerfile
FROM denoland/deno:alpine

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy source code
COPY . .

# Build the application
RUN deno task build

# Expose port
EXPOSE 8000

# Start the server
CMD ["deno", "run", "--allow-all", "src/server.ts"]
```

2. **Create `.dockerignore`**:

```
node_modules
dist
.git
.env
README.md
```

3. **Build and Run**:

```bash
# Build image
docker build -t my-avalon-app .

# Run container
docker run -p 8000:8000 my-avalon-app
```

4. **Deploy to any Docker platform**:
   - AWS ECS
   - Google Cloud Run
   - Azure Container Instances
   - Heroku Container Registry

## Environment Configuration

### Environment Variables

Create different configurations for different environments:

**Development (`.env.local`)**:

```bash
DENO_ENV=development
PORT=3000
API_URL=http://localhost:3000/api
DATABASE_URL=sqlite://./dev.db
```

**Production**:

```bash
DENO_ENV=production
PORT=8000
API_URL=https://your-app.com/api
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Configuration in Code

```typescript
// src/config.ts
const config = {
	development: {
		port: 3000,
		apiUrl: 'http://localhost:3000/api',
		debug: true,
	},
	production: {
		port: parseInt(Deno.env.get('PORT') || '8000'),
		apiUrl: Deno.env.get('API_URL') || 'https://your-app.com/api',
		debug: false,
	},
};

const env = Deno.env.get('DENO_ENV') || 'development';
export default config[env as keyof typeof config];
```

## Performance Optimization

### 1. Enable Compression

Most platforms enable gzip compression automatically, but you can configure it:

```typescript
// src/server.ts
import { createServer } from '@avalon/avalon';

const server = createServer({
	srcDir: './src',
	compression: true, // Enable gzip compression
	cache: {
		maxAge: 3600, // Cache static assets for 1 hour
		staleWhileRevalidate: 86400, // Serve stale content for 24 hours
	},
});
```

### 2. Optimize Images

```bash
# Install image optimization tools
npm install -g @squoosh/cli

# Optimize images before deployment
squoosh-cli --webp auto --resize '{width: 800}' src/assets/*.jpg
```

### 3. Bundle Analysis

```bash
# Analyze your bundle sizes
deno task build --analyze

# This will show you:
# - Island bundle sizes
# - Unused dependencies
# - Optimization opportunities
```

## Custom Domains

### Vercel

```bash
# Add custom domain
vercel domains add yourdomain.com
vercel alias your-deployment-url.vercel.app yourdomain.com
```

### Netlify

```bash
# Add custom domain
netlify sites:update --name=your-site-name --custom-domain=yourdomain.com
```

### Cloudflare (for any deployment)

1. Add your domain to Cloudflare
2. Update DNS to point to your deployment
3. Enable SSL/TLS encryption
4. Configure caching rules

## Monitoring and Analytics

### 1. Error Tracking

Add error tracking to your server:

```typescript
// src/middleware/error-tracking.ts
import { MiddlewareHandler } from '@avalon/avalon';

export const errorTracking: MiddlewareHandler = async (request, context, next) => {
	try {
		return await next();
	} catch (error) {
		// Log to your error tracking service
		console.error('Server error:', error);

		// Send to Sentry, LogRocket, etc.
		if (Deno.env.get('SENTRY_DSN')) {
			// await Sentry.captureException(error);
		}

		throw error;
	}
};
```

### 2. Performance Monitoring

```typescript
// src/middleware/performance.ts
export const performanceMonitoring: MiddlewareHandler = async (request, context, next) => {
	const start = Date.now();
	const response = await next();
	const duration = Date.now() - start;

	// Log slow requests
	if (duration > 1000) {
		console.warn(`Slow request: ${request.method} ${request.url} took ${duration}ms`);
	}

	response.headers.set('X-Response-Time', `${duration}ms`);
	return response;
};
```

### 3. Analytics

Add analytics to your pages:

```tsx
// src/components/Analytics.tsx
export default function Analytics() {
	return (
		<>
			{/* Google Analytics */}
			<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
			<script
				dangerouslySetInnerHTML={{
					__html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'GA_MEASUREMENT_ID');
        `,
				}}
			/>
		</>
	);
}
```

## Troubleshooting Deployment Issues

### Common Problems

**Build Fails**

```bash
# Check your build locally first
deno task build

# Common issues:
# - Missing dependencies in deno.json
# - TypeScript errors
# - Import path issues
```

**Islands Not Working**

```bash
# Check that islands are being built
ls dist/_avalon/islands/

# Should see .js files for each island
# If missing, check:
# - Islands are in src/islands/
# - Components are default exported
# - Framework is configured
```

**API Routes 404**

```bash
# For static deployments, API routes won't work
# You need a server deployment for API routes
# Or use serverless functions (Vercel Functions, Netlify Functions)
```

**Slow Loading**

```bash
# Check bundle sizes
deno task build --analyze

# Optimize:
# - Remove unused dependencies
# - Split large islands
# - Enable compression
# - Use CDN for static assets
```

### Debug Mode

Enable debug mode for more information:

```typescript
// src/server.ts
const server = createServer({
	srcDir: './src',
	debug: true, // Enable debug logging
	logLevel: 'verbose',
});
```

## Security Considerations

### 1. Environment Variables

Never commit sensitive data:

```bash
# .env (never commit this)
DATABASE_PASSWORD=secret123
API_KEY=abc123

# Use platform-specific secret management:
# - Vercel: Environment Variables in dashboard
# - Netlify: Site settings → Environment variables
# - Railway: Variables tab
# - Fly.io: fly secrets set KEY=value
```

### 2. Content Security Policy

```typescript
// src/middleware/security.ts
export const security: MiddlewareHandler = async (request, context, next) => {
	const response = await next();

	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
	);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');

	return response;
};
```

### 3. Rate Limiting

```typescript
// src/middleware/rate-limit.ts
const requests = new Map();

export const rateLimit: MiddlewareHandler = async (request, context, next) => {
	const ip = request.headers.get('x-forwarded-for') || 'unknown';
	const now = Date.now();
	const windowMs = 15 * 60 * 1000; // 15 minutes
	const maxRequests = 100;

	const userRequests = requests.get(ip) || [];
	const recentRequests = userRequests.filter((time: number) => now - time < windowMs);

	if (recentRequests.length >= maxRequests) {
		return new Response('Too Many Requests', { status: 429 });
	}

	recentRequests.push(now);
	requests.set(ip, recentRequests);

	return next();
};
```

## Next Steps

Congratulations! Your Avalon application is now live. Here are some next steps:

1. **Monitor Performance**: Set up analytics and error tracking
2. **Optimize**: Use the bundle analyzer to optimize your app
3. **Scale**: Consider CDN and caching strategies as you grow
4. **Learn More**: Explore the [Core Concepts](../02-core-concepts/README.md) to build more advanced features

## Platform-Specific Resources

- **Vercel**: [Vercel Documentation](https://vercel.com/docs)
- **Netlify**: [Netlify Documentation](https://docs.netlify.com/)
- **Deno Deploy**: [Deno Deploy Documentation](https://deno.com/deploy/docs)
- **Railway**: [Railway Documentation](https://docs.railway.app/)
- **Fly.io**: [Fly.io Documentation](https://fly.io/docs/)

## Need Help?

- 📖 [Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/avalon/avalon/issues)
- 💬 [Community Discord](https://discord.gg/avalon)
- 📧 [Email Support](mailto:support@avalon.dev)

# Installation

Get Avalon up and running on your system in just a few minutes.

## Prerequisites

Before installing Avalon, make sure you have one of the following:

- **Deno 2.5+** (Recommended) - [Install Deno](https://deno.land/manual/getting_started/installation)
- **Node.js 18+** - [Install Node.js](https://nodejs.org/)

## Quick Installation

### Using Deno (Recommended)

Deno provides the best experience with Avalon, offering built-in TypeScript support and modern JavaScript features.

```bash
# Check your Deno version
deno --version

# Create a new Avalon project
deno run -A npm:create-avalon@latest my-avalon-app

# Navigate to your project
cd my-avalon-app

# Install dependencies
deno install

# Start the development server
deno task dev
```

### Using Node.js

If you prefer Node.js, Avalon works seamlessly with npm, yarn, or pnpm.

```bash
# Using npm
npx create-avalon@latest my-avalon-app
cd my-avalon-app
npm install
npm run dev

# Using yarn
yarn create avalon my-avalon-app
cd my-avalon-app
yarn install
yarn dev

# Using pnpm
pnpm create avalon my-avalon-app
cd my-avalon-app
pnpm install
pnpm dev
```

## Manual Installation

If you prefer to set up Avalon manually or add it to an existing project:

### 1. Initialize Your Project

```bash
# Create project directory
mkdir my-avalon-app
cd my-avalon-app

# Initialize with Deno
echo '{}' > deno.json

# Or initialize with Node.js
npm init -y
```

### 2. Install Avalon

```bash
# With Deno
deno add npm:@avalon/avalon

# With npm
npm install @avalon/avalon

# With yarn
yarn add @avalon/avalon

# With pnpm
pnpm add @avalon/avalon
```

### 3. Create Basic Configuration

Create a `deno.json` (for Deno) or `package.json` scripts (for Node.js):

**For Deno (`deno.json`):**

```json
{
	"tasks": {
		"dev": "deno run --allow-all --unstable-detect-cjs src/server.ts",
		"build": "deno run --allow-all build.ts",
		"preview": "DENO_ENV=production deno run --allow-all src/server.ts"
	},
	"nodeModulesDir": "auto",
	"imports": {
		"@avalon/avalon": "npm:@avalon/avalon",
		"preact": "npm:preact@10.26.9",
		"preact/hooks": "npm:preact@10.26.9/hooks"
	},
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "preact",
		"lib": ["dom", "dom.iterable", "deno.ns"]
	}
}
```

**For Node.js (`package.json` scripts):**

```json
{
	"scripts": {
		"dev": "node src/server.js",
		"build": "node build.js",
		"preview": "NODE_ENV=production node src/server.js"
	}
}
```

## Verification

After installation, verify everything is working:

```bash
# Start the development server
deno task dev  # or npm run dev

# You should see:
# 🏔️ Avalon server starting...
# 🚀 Server running at http://localhost:3000
```

Open your browser to `http://localhost:3000` and you should see the Avalon welcome page!

## Troubleshooting

### Common Issues

**Permission Denied (Deno)**

```bash
# Make sure you're using the --allow-all flag
deno run --allow-all src/server.ts
```

**Module Not Found**

```bash
# Clear cache and reinstall
deno cache --reload src/server.ts
# or
npm install --force
```

**Port Already in Use**

```bash
# Change the port in your server configuration
# or kill the process using the port
lsof -ti:3000 | xargs kill -9
```

**TypeScript Errors**

```bash
# Make sure your tsconfig.json or deno.json has proper JSX configuration
# Check that jsxImportSource is set correctly
```

### Getting Help

- 📖 [Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/avalon/avalon/issues)
- 💬 [Community Discord](https://discord.gg/avalon)
- 📧 [Email Support](mailto:support@avalon.dev)

## Next Steps

Now that Avalon is installed, let's [create your first application](./quick-start.md) in just 5 minutes!

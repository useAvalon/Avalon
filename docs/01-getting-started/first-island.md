# Your First Island: Adding Interactivity

Islands are the heart of Avalon's architecture. They're interactive components that run on the client while the rest of your page remains static. This tutorial will teach you how to create islands using different frameworks and understand when to use them.

## What Are Islands?

Think of islands as **interactive widgets** in a sea of static HTML:

- 🏝️ **Islands**: Interactive components (counters, forms, charts)
- 🌊 **Static HTML**: Everything else (text, images, navigation)

This approach gives you:

- ⚡ **Fast loading**: Minimal JavaScript
- 🎯 **Selective hydration**: Only interactive parts load JS
- 📱 **Better performance**: Especially on mobile devices
- 🔍 **SEO friendly**: Static content is immediately available

## Framework Options

Avalon supports multiple frameworks for building islands:

| Framework  | Best For                   | Bundle Size | Learning Curve           |
| ---------- | -------------------------- | ----------- | ------------------------ |
| **Preact** | React-like experience      | ~3KB        | Easy (if you know React) |
| **Vue**    | Template-based development | ~10KB       | Medium                   |
| **Svelte** | Minimal runtime overhead   | ~2KB        | Medium                   |
| **Solid**  | Fine-grained reactivity    | ~5KB        | Hard                     |

## Creating Your First Island

Let's create a simple counter island using different frameworks. Choose the one you're most comfortable with!

### Option 1: Preact Island (Recommended for beginners)

Create `src/islands/Counter.tsx`:

```tsx
import { useState } from 'preact/hooks';

export default function Counter() {
	const [count, setCount] = useState(0);

	return (
		<div className="counter-island">
			<h3>🏝️ Preact Counter Island</h3>
			<div className="counter-controls">
				<button onClick={() => setCount(count - 1)}>-</button>
				<span className="count">{count}</span>
				<button onClick={() => setCount(count + 1)}>+</button>
			</div>
			<p>This component is interactive!</p>

			<style jsx>{`
				.counter-island {
					border: 2px solid #007acc;
					border-radius: 8px;
					padding: 1rem;
					background: white;
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
				}
				.counter-controls {
					display: flex;
					align-items: center;
					gap: 1rem;
					margin: 1rem 0;
				}
				button {
					padding: 0.5rem 1rem;
					font-size: 1.2rem;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					transition: background-color 0.2s;
				}
				button:first-child {
					background: #ff6b6b;
					color: white;
				}
				button:last-child {
					background: #51cf66;
					color: white;
				}
				button:hover {
					opacity: 0.8;
				}
				.count {
					font-size: 1.5rem;
					font-weight: bold;
					min-width: 3rem;
					text-align: center;
				}
			`}</style>
		</div>
	);
}
```

### Option 2: Vue Island

Create `src/islands/Counter.vue`:

```vue
<template>
	<div class="counter-island">
		<h3>🏝️ Vue Counter Island</h3>
		<div class="counter-controls">
			<button @click="decrement">-</button>
			<span class="count">{{ count }}</span>
			<button @click="increment">+</button>
		</div>
		<p>This component is interactive!</p>
	</div>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);

const increment = () => count.value++;
const decrement = () => count.value--;
</script>

<style scoped>
.counter-island {
	border: 2px solid #4fc08d;
	border-radius: 8px;
	padding: 1rem;
	background: white;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.counter-controls {
	display: flex;
	align-items: center;
	gap: 1rem;
	margin: 1rem 0;
}

button {
	padding: 0.5rem 1rem;
	font-size: 1.2rem;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background-color 0.2s;
}

button:first-child {
	background: #ff6b6b;
	color: white;
}

button:last-child {
	background: #51cf66;
	color: white;
}

button:hover {
	opacity: 0.8;
}

.count {
	font-size: 1.5rem;
	font-weight: bold;
	min-width: 3rem;
	text-align: center;
}
</style>
```

### Option 3: Svelte Island

Create `src/islands/Counter.svelte`:

```svelte
<script>
  let count = 0;

  function increment() {
    count += 1;
  }

  function decrement() {
    count -= 1;
  }
</script>

<div class="counter-island">
  <h3>🏝️ Svelte Counter Island</h3>
  <div class="counter-controls">
    <button on:click={decrement}>-</button>
    <span class="count">{count}</span>
    <button on:click={increment}>+</button>
  </div>
  <p>This component is interactive!</p>
</div>

<style>
  .counter-island {
    border: 2px solid #ff3e00;
    border-radius: 8px;
    padding: 1rem;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .counter-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
  }

  button {
    padding: 0.5rem 1rem;
    font-size: 1.2rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:first-child {
    background: #ff6b6b;
    color: white;
  }

  button:last-child {
    background: #51cf66;
    color: white;
  }

  button:hover {
    opacity: 0.8;
  }

  .count {
    font-size: 1.5rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
  }
</style>
```

### Option 4: Solid Island

Create `src/islands/Counter.solid.tsx`:

```tsx
import { createSignal } from 'solid-js';

export default function Counter() {
	const [count, setCount] = createSignal(0);

	return (
		<div class="counter-island">
			<h3>🏝️ Solid Counter Island</h3>
			<div class="counter-controls">
				<button onClick={() => setCount(count() - 1)}>-</button>
				<span class="count">{count()}</span>
				<button onClick={() => setCount(count() + 1)}>+</button>
			</div>
			<p>This component is interactive!</p>

			<style jsx>{`
				.counter-island {
					border: 2px solid #2c4f7c;
					border-radius: 8px;
					padding: 1rem;
					background: white;
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
				}
				.counter-controls {
					display: flex;
					align-items: center;
					gap: 1rem;
					margin: 1rem 0;
				}
				button {
					padding: 0.5rem 1rem;
					font-size: 1.2rem;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					transition: background-color 0.2s;
				}
				button:first-child {
					background: #ff6b6b;
					color: white;
				}
				button:last-child {
					background: #51cf66;
					color: white;
				}
				button:hover {
					opacity: 0.8;
				}
				.count {
					font-size: 1.5rem;
					font-weight: bold;
					min-width: 3rem;
					text-align: center;
				}
			`}</style>
		</div>
	);
}
```

## Using Your Island in a Page

Now let's use your island in a page. Create or update `src/pages/index.tsx`:

```tsx
import { PageProps } from '@avalon/avalon';

export default function HomePage({ url }: PageProps) {
	return (
		<div
			style={{
				fontFamily: 'system-ui, sans-serif',
				maxWidth: '800px',
				margin: '0 auto',
				padding: '2rem',
			}}>
			<h1>🏔️ Welcome to Avalon!</h1>

			<div
				style={{
					background: '#f8f9fa',
					padding: '1.5rem',
					borderRadius: '8px',
					margin: '2rem 0',
				}}>
				<h2>Static Content</h2>
				<p>This content is rendered on the server and sent as HTML.</p>
				<p>It loads instantly and is SEO-friendly!</p>
			</div>

			<div style={{ margin: '2rem 0' }}>
				<h2>Interactive Island</h2>
				<p>Below is an interactive component that loads JavaScript:</p>
				<Counter />
			</div>

			<div
				style={{
					background: '#e3f2fd',
					padding: '1.5rem',
					borderRadius: '8px',
					margin: '2rem 0',
				}}>
				<h2>🎯 Key Benefits</h2>
				<ul>
					<li>
						<strong>Fast Loading:</strong> Static content loads immediately
					</li>
					<li>
						<strong>Selective Hydration:</strong> Only the counter loads JavaScript
					</li>
					<li>
						<strong>SEO Friendly:</strong> Search engines see all the content
					</li>
					<li>
						<strong>Progressive Enhancement:</strong> Works even if JavaScript fails
					</li>
				</ul>
			</div>
		</div>
	);
}

// This will be automatically detected as an island reference
function Counter() {
	return <div id="counter-placeholder">Loading counter...</div>;
}
```

## Advanced Island Examples

### Todo List Island

Create `src/islands/TodoList.tsx`:

```tsx
import { useState } from 'preact/hooks';

interface Todo {
	id: number;
	text: string;
	completed: boolean;
}

export default function TodoList() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [newTodo, setNewTodo] = useState('');

	const addTodo = () => {
		if (newTodo.trim()) {
			setTodos([
				...todos,
				{
					id: Date.now(),
					text: newTodo.trim(),
					completed: false,
				},
			]);
			setNewTodo('');
		}
	};

	const toggleTodo = (id: number) => {
		setTodos(todos.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
	};

	const deleteTodo = (id: number) => {
		setTodos(todos.filter(todo => todo.id !== id));
	};

	return (
		<div className="todo-island">
			<h3>📝 Todo List Island</h3>

			<div className="add-todo">
				<input
					type="text"
					value={newTodo}
					onChange={e => setNewTodo(e.target.value)}
					onKeyPress={e => e.key === 'Enter' && addTodo()}
					placeholder="Add a new todo..."
				/>
				<button onClick={addTodo}>Add</button>
			</div>

			<ul className="todo-list">
				{todos.map(todo => (
					<li key={todo.id} className={todo.completed ? 'completed' : ''}>
						<input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
						<span>{todo.text}</span>
						<button onClick={() => deleteTodo(todo.id)}>Delete</button>
					</li>
				))}
			</ul>

			{todos.length === 0 && <p className="empty-state">No todos yet. Add one above!</p>}

			<style jsx>{`
				.todo-island {
					border: 2px solid #007acc;
					border-radius: 8px;
					padding: 1rem;
					background: white;
					max-width: 400px;
				}
				.add-todo {
					display: flex;
					gap: 0.5rem;
					margin-bottom: 1rem;
				}
				.add-todo input {
					flex: 1;
					padding: 0.5rem;
					border: 1px solid #ddd;
					border-radius: 4px;
				}
				.add-todo button {
					padding: 0.5rem 1rem;
					background: #007acc;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
				}
				.todo-list {
					list-style: none;
					padding: 0;
				}
				.todo-list li {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					padding: 0.5rem;
					border-bottom: 1px solid #eee;
				}
				.todo-list li.completed span {
					text-decoration: line-through;
					opacity: 0.6;
				}
				.todo-list button {
					margin-left: auto;
					padding: 0.25rem 0.5rem;
					background: #ff6b6b;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 0.8rem;
				}
				.empty-state {
					text-align: center;
					color: #666;
					font-style: italic;
				}
			`}</style>
		</div>
	);
}
```

### API-Connected Island

Create `src/islands/WeatherWidget.tsx`:

```tsx
import { useState, useEffect } from 'preact/hooks';

interface WeatherData {
	location: string;
	temperature: number;
	description: string;
	humidity: number;
}

export default function WeatherWidget() {
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchWeather();
	}, []);

	const fetchWeather = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch('/api/weather');
			if (!response.ok) {
				throw new Error('Failed to fetch weather');
			}

			const data = await response.json();
			setWeather(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="weather-widget loading">
				<h3>🌤️ Weather Widget</h3>
				<p>Loading weather data...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="weather-widget error">
				<h3>🌤️ Weather Widget</h3>
				<p>Error: {error}</p>
				<button onClick={fetchWeather}>Retry</button>
			</div>
		);
	}

	return (
		<div className="weather-widget">
			<h3>🌤️ Weather Widget</h3>
			{weather && (
				<div className="weather-info">
					<div className="location">{weather.location}</div>
					<div className="temperature">{weather.temperature}°C</div>
					<div className="description">{weather.description}</div>
					<div className="humidity">Humidity: {weather.humidity}%</div>
				</div>
			)}
			<button onClick={fetchWeather}>Refresh</button>

			<style jsx>{`
				.weather-widget {
					border: 2px solid #4fc08d;
					border-radius: 8px;
					padding: 1rem;
					background: linear-gradient(135deg, #74b9ff, #0984e3);
					color: white;
					max-width: 300px;
				}
				.weather-widget.loading,
				.weather-widget.error {
					background: #ddd;
					color: #333;
				}
				.weather-info {
					margin: 1rem 0;
				}
				.location {
					font-size: 1.2rem;
					font-weight: bold;
					margin-bottom: 0.5rem;
				}
				.temperature {
					font-size: 2rem;
					font-weight: bold;
					margin: 0.5rem 0;
				}
				.description {
					font-style: italic;
					margin-bottom: 0.5rem;
				}
				.humidity {
					font-size: 0.9rem;
					opacity: 0.8;
				}
				button {
					background: rgba(255, 255, 255, 0.2);
					color: white;
					border: 1px solid rgba(255, 255, 255, 0.3);
					padding: 0.5rem 1rem;
					border-radius: 4px;
					cursor: pointer;
					margin-top: 1rem;
				}
				button:hover {
					background: rgba(255, 255, 255, 0.3);
				}
			`}</style>
		</div>
	);
}
```

## Island Best Practices

### 1. Keep Islands Small and Focused

❌ **Don't**: Create large islands that do everything

```tsx
// Bad: One giant island
export default function MegaComponent() {
	return (
		<div>
			<Header />
			<Navigation />
			<MainContent />
			<Sidebar />
			<Footer />
		</div>
	);
}
```

✅ **Do**: Create focused, single-purpose islands

```tsx
// Good: Focused islands
export default function SearchBox() {
	/* ... */
}
export default function ShoppingCart() {
	/* ... */
}
export default function UserProfile() {
	/* ... */
}
```

### 2. Use Static Content When Possible

❌ **Don't**: Make everything an island

```tsx
// Bad: Static content as an island
export default function StaticArticle() {
	return (
		<article>
			<h1>My Blog Post</h1>
			<p>This is static content that doesn't need JavaScript.</p>
		</article>
	);
}
```

✅ **Do**: Keep static content in pages

```tsx
// Good: Static content in page component
export default function BlogPost() {
	return (
		<article>
			<h1>My Blog Post</h1>
			<p>This is static content.</p>
			<CommentForm /> {/* Only this needs to be an island */}
		</article>
	);
}
```

### 3. Handle Loading and Error States

✅ **Always handle these states in your islands:**

```tsx
export default function DataIsland() {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Loading state
	if (loading) return <div>Loading...</div>;

	// Error state
	if (error) return <div>Error: {error.message}</div>;

	// Success state
	return <div>{/* Your content */}</div>;
}
```

### 4. Optimize for Performance

```tsx
// Use lazy loading for heavy components
import { lazy, Suspense } from 'preact/compat';

const HeavyChart = lazy(() => import('./HeavyChart'));

export default function Dashboard() {
	return (
		<div>
			<h1>Dashboard</h1>
			<Suspense fallback={<div>Loading chart...</div>}>
				<HeavyChart />
			</Suspense>
		</div>
	);
}
```

## Testing Your Islands

### 1. Start the Development Server

```bash
deno task dev
```

### 2. Check the Browser Console

Open your browser's developer tools and look for:

- ✅ No JavaScript errors
- ✅ Island components loading correctly
- ✅ Event handlers working

### 3. Test Without JavaScript

Disable JavaScript in your browser to ensure:

- ✅ Static content still loads
- ✅ Page structure remains intact
- ✅ Forms still submit (if using proper form handling)

### 4. Check Network Tab

Look for:

- ✅ Separate JavaScript bundles for each island
- ✅ Islands only loading when needed
- ✅ Minimal bundle sizes

## Common Issues and Solutions

### Island Not Loading

**Problem**: Island appears as static HTML
**Solution**:

- Check that the file is in `src/islands/`
- Ensure the component is default exported
- Verify the framework is configured in your server

### JavaScript Errors

**Problem**: Console shows errors
**Solution**:

- Check for typos in component code
- Ensure all imports are correct
- Verify framework-specific syntax

### Large Bundle Sizes

**Problem**: Islands are too large
**Solution**:

- Split large islands into smaller components
- Use dynamic imports for heavy dependencies
- Remove unused imports

## Next Steps

Congratulations! You now know how to create interactive islands with Avalon. Next, let's learn how to [deploy your application](./deployment.md) and get it online for the world to see!

## Framework-Specific Resources

- **Preact**: [Preact Documentation](https://preactjs.com/)
- **Vue**: [Vue 3 Documentation](https://vuejs.org/)
- **Svelte**: [Svelte Documentation](https://svelte.dev/)
- **Solid**: [Solid Documentation](https://www.solidjs.com/)

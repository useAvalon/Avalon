# Integration Examples

This document provides practical examples of using and creating framework integrations in Avalon.

## Table of Contents

- [Using Official Integrations](#using-official-integrations)
- [Custom Integration Examples](#custom-integration-examples)
- [Advanced Patterns](#advanced-patterns)
- [Real-World Use Cases](#real-world-use-cases)

## Using Official Integrations

### Example 1: Simple Preact Counter

The most basic example of an interactive island:

```tsx
// islands/Counter.tsx
import { h } from "preact";
import { useState } from "preact/hooks";

export default function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
      <button onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}
```

```tsx
// pages/index.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>Counter Example</h1>
      <Island 
        src="/islands/Counter.tsx"
        condition="on:client"
      />
    </div>
  );
}
```

### Example 2: Vue Component with Props and Scoped Styles

```vue
<!-- islands/UserCard.vue -->
<template>
  <div class="user-card">
    <img :src="avatar" :alt="name" class="avatar" />
    <h3>{{ name }}</h3>
    <p>{{ bio }}</p>
    <button @click="follow">
      {{ isFollowing ? 'Unfollow' : 'Follow' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  name: String,
  avatar: String,
  bio: String,
});

const isFollowing = ref(false);

function follow() {
  isFollowing.value = !isFollowing.value;
}
</script>

<style scoped>
.user-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 300px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

h3 {
  margin: 0.5rem 0;
  color: #333;
}

p {
  color: #666;
  font-size: 0.9rem;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}
</style>
```

```tsx
// pages/profile.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Profile() {
  return (
    <div>
      <h1>User Profile</h1>
      <Island 
        src="/islands/UserCard.vue"
        props={{
          name: "Jane Doe",
          avatar: "/images/avatar.jpg",
          bio: "Software developer and open source enthusiast",
        }}
        condition="on:visible"
      />
    </div>
  );
}
```

### Example 3: Solid Component with Fine-Grained Reactivity

```tsx
// islands/TodoList.solid.tsx
import { createSignal, For } from "solid-js";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function TodoList() {
  const [todos, setTodos] = createSignal<Todo[]>([]);
  const [input, setInput] = createSignal("");
  
  const addTodo = () => {
    const text = input().trim();
    if (!text) return;
    
    setTodos([
      ...todos(),
      { id: Date.now(), text, completed: false },
    ]);
    setInput("");
  };
  
  const toggleTodo = (id: number) => {
    setTodos(todos().map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };
  
  const deleteTodo = (id: number) => {
    setTodos(todos().filter(todo => todo.id !== id));
  };
  
  return (
    <div>
      <div>
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      
      <ul>
        <For each={todos()}>
          {(todo) => (
            <li style={{ "text-decoration": todo.completed ? "line-through" : "none" }}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
              <button onClick={() => deleteTodo(todo.id)}>Delete</button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
```

```tsx
// pages/todos.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Todos() {
  return (
    <div>
      <h1>Todo List</h1>
      <Island 
        src="/islands/TodoList.solid.tsx"
        condition="on:interaction"
      />
    </div>
  );
}
```

### Example 4: Svelte Component with Stores

```svelte
<!-- islands/ShoppingCart.svelte -->
<script>
  import { writable, derived } from 'svelte/store';
  
  const items = writable([]);
  
  const total = derived(items, $items =>
    $items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  
  function addItem(name, price) {
    items.update(current => {
      const existing = current.find(item => item.name === name);
      if (existing) {
        return current.map(item =>
          item.name === name
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { name, price, quantity: 1 }];
    });
  }
  
  function removeItem(name) {
    items.update(current => current.filter(item => item.name !== name));
  }
  
  function updateQuantity(name, quantity) {
    if (quantity <= 0) {
      removeItem(name);
      return;
    }
    items.update(current =>
      current.map(item =>
        item.name === name ? { ...item, quantity } : item
      )
    );
  }
</script>

<div class="cart">
  <h2>Shopping Cart</h2>
  
  <div class="products">
    <button on:click={() => addItem('Apple', 1.99)}>Add Apple ($1.99)</button>
    <button on:click={() => addItem('Banana', 0.99)}>Add Banana ($0.99)</button>
    <button on:click={() => addItem('Orange', 2.49)}>Add Orange ($2.49)</button>
  </div>
  
  {#if $items.length === 0}
    <p>Your cart is empty</p>
  {:else}
    <ul>
      {#each $items as item}
        <li>
          <span>{item.name}</span>
          <input
            type="number"
            value={item.quantity}
            on:input={(e) => updateQuantity(item.name, parseInt(e.target.value))}
            min="0"
          />
          <span>${(item.price * item.quantity).toFixed(2)}</span>
          <button on:click={() => removeItem(item.name)}>Remove</button>
        </li>
      {/each}
    </ul>
    
    <div class="total">
      <strong>Total: ${$total.toFixed(2)}</strong>
    </div>
  {/if}
</div>

<style>
  .cart {
    max-width: 500px;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .products {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .products button {
    padding: 0.5rem 1rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  ul {
    list-style: none;
    padding: 0;
  }
  
  li {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
  }
  
  input[type="number"] {
    width: 60px;
    padding: 0.25rem;
  }
  
  .total {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid #333;
    text-align: right;
  }
</style>
```

```tsx
// pages/shop.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Shop() {
  return (
    <div>
      <h1>Shop</h1>
      <Island 
        src="/islands/ShoppingCart.svelte"
        condition="on:visible"
      />
    </div>
  );
}
```

## Custom Integration Examples

### Example 5: Lit Element Integration

A complete custom integration for Lit web components:

```typescript
// src/integrations/lit/mod.ts
import type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../shared/types.ts";
import { render as renderLit } from "@lit-labs/ssr";
import { html } from "lit";

export const litIntegration: Integration = {
  name: "lit",
  version: "0.1.0",
  
  async render(params: RenderParams): Promise<RenderResult> {
    const { src, props } = params;
    
    // Load the Lit element
    const module = await import(src);
    const ElementClass = module.default || module;
    
    // Create element with props
    const element = new ElementClass();
    Object.assign(element, props);
    
    // Render to string
    const result = renderLit(element);
    let htmlString = "";
    
    for (const chunk of result) {
      htmlString += chunk;
    }
    
    return {
      html: htmlString,
      hydrationData: {
        src,
        props,
        framework: "lit",
      },
    };
  },
  
  getHydrationScript(): string {
    return `
      // Lit elements auto-hydrate via custom elements
      // No explicit hydration needed
      console.log('Lit elements ready');
    `;
  },
  
  config(): IntegrationConfig {
    return {
      name: "lit",
      fileExtensions: [".lit.ts", ".lit.js"],
      jsxImportSources: [],
      detectionPatterns: {
        imports: [/^lit$/, /^lit\//, /@lit\//],
        content: [/\bLitElement\b/, /\bcustomElement\b/, /\bhtml`/],
      },
    };
  },
};
```

```typescript
// islands/MyElement.lit.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("my-element")
export default class MyElement extends LitElement {
  @property({ type: String })
  name = "World";
  
  @property({ type: Number })
  count = 0;
  
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 1px solid #ccc;
    }
    
    button {
      padding: 0.5rem 1rem;
      margin: 0.5rem;
    }
  `;
  
  render() {
    return html`
      <h2>Hello, ${this.name}!</h2>
      <p>Count: ${this.count}</p>
      <button @click=${this._increment}>Increment</button>
      <button @click=${this._decrement}>Decrement</button>
    `;
  }
  
  private _increment() {
    this.count++;
  }
  
  private _decrement() {
    this.count--;
  }
}
```

### Example 6: Alpine.js Integration

A lightweight integration for Alpine.js:

```typescript
// src/integrations/alpine/mod.ts
import type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../shared/types.ts";

export const alpineIntegration: Integration = {
  name: "alpine",
  version: "0.1.0",
  
  async render(params: RenderParams): Promise<RenderResult> {
    const { src, props } = params;
    
    // Load the Alpine component template
    const content = await Deno.readTextFile(src);
    
    // Alpine components are just HTML templates
    // Replace placeholders with props
    let html = content;
    for (const [key, value] of Object.entries(props)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
    
    return {
      html,
      hydrationData: {
        src,
        props,
        framework: "alpine",
      },
    };
  },
  
  getHydrationScript(): string {
    return `
      // Alpine.js auto-initializes via x-data attributes
      import Alpine from 'alpinejs';
      window.Alpine = Alpine;
      Alpine.start();
    `;
  },
  
  config(): IntegrationConfig {
    return {
      name: "alpine",
      fileExtensions: [".alpine.html"],
      jsxImportSources: [],
      detectionPatterns: {
        imports: [/^alpinejs$/],
        content: [/x-data/, /x-bind/, /x-on/, /@click/, /:click/],
      },
    };
  },
};
```

```html
<!-- islands/Dropdown.alpine.html -->
<div x-data="{ open: false, selected: '{{defaultValue}}' }">
  <button @click="open = !open" type="button">
    <span x-text="selected || 'Select an option'"></span>
    <svg x-show="!open">▼</svg>
    <svg x-show="open">▲</svg>
  </button>
  
  <ul x-show="open" @click.away="open = false">
    <li @click="selected = 'Option 1'; open = false">Option 1</li>
    <li @click="selected = 'Option 2'; open = false">Option 2</li>
    <li @click="selected = 'Option 3'; open = false">Option 3</li>
  </ul>
</div>
```

## Advanced Patterns

### Example 7: Multiple Frameworks on One Page

```tsx
// pages/dashboard.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Dashboard() {
  return (
    <div class="dashboard">
      <header>
        <h1>Dashboard</h1>
        {/* Preact navigation */}
        <Island 
          src="/islands/Navigation.tsx"
          condition="on:client"
        />
      </header>
      
      <main>
        {/* Vue chart component */}
        <Island 
          src="/islands/Chart.vue"
          props={{ data: [1, 2, 3, 4, 5] }}
          condition="on:visible"
        />
        
        {/* Solid data table */}
        <Island 
          src="/islands/DataTable.solid.tsx"
          props={{ rows: 100 }}
          condition="on:interaction"
        />
        
        {/* Svelte form */}
        <Island 
          src="/islands/SettingsForm.svelte"
          condition="on:idle"
        />
      </main>
      
      <aside>
        {/* Lit sidebar widget */}
        <Island 
          src="/islands/Sidebar.lit.ts"
          condition="on:visible"
        />
      </aside>
    </div>
  );
}
```

### Example 8: Conditional Hydration Based on Device

```tsx
// pages/responsive.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Responsive() {
  return (
    <div>
      {/* Desktop-only interactive component */}
      <Island 
        src="/islands/DesktopFeature.tsx"
        condition="media:(min-width: 1024px)"
      />
      
      {/* Mobile-only interactive component */}
      <Island 
        src="/islands/MobileFeature.tsx"
        condition="media:(max-width: 767px)"
      />
      
      {/* Tablet range */}
      <Island 
        src="/islands/TabletFeature.tsx"
        condition="media:(min-width: 768px) and (max-width: 1023px)"
      />
    </div>
  );
}
```

### Example 9: Progressive Enhancement

```tsx
// pages/progressive.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Progressive() {
  return (
    <div>
      {/* Critical content: SSR only, no hydration */}
      <Island 
        src="/islands/CriticalContent.tsx"
        ssrOnly={true}
      />
      
      {/* Above the fold: Hydrate immediately */}
      <Island 
        src="/islands/Hero.tsx"
        condition="on:client"
      />
      
      {/* Below the fold: Hydrate when visible */}
      <Island 
        src="/islands/Features.tsx"
        condition="on:visible"
      />
      
      {/* Interactive widget: Hydrate on interaction */}
      <Island 
        src="/islands/Calculator.tsx"
        condition="on:interaction"
      />
      
      {/* Non-critical: Hydrate when idle */}
      <Island 
        src="/islands/Comments.tsx"
        condition="on:idle"
      />
    </div>
  );
}
```

### Example 10: Shared State Between Islands

```tsx
// lib/store.ts
import { createStore } from "solid-js/store";

export const [globalState, setGlobalState] = createStore({
  user: null,
  theme: "light",
  notifications: [],
});
```

```tsx
// islands/UserMenu.solid.tsx
import { globalState, setGlobalState } from "../lib/store.ts";

export default function UserMenu() {
  const logout = () => {
    setGlobalState("user", null);
  };
  
  return (
    <div>
      {globalState.user ? (
        <>
          <span>Welcome, {globalState.user.name}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <a href="/login">Login</a>
      )}
    </div>
  );
}
```

```tsx
// islands/ThemeToggle.solid.tsx
import { globalState, setGlobalState } from "../lib/store.ts";

export default function ThemeToggle() {
  const toggleTheme = () => {
    setGlobalState("theme", globalState.theme === "light" ? "dark" : "light");
  };
  
  return (
    <button onClick={toggleTheme}>
      {globalState.theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
```

## Real-World Use Cases

### Example 11: E-commerce Product Page

```tsx
// pages/product/[id].tsx
import { h } from "preact";
import Island from "../../islands/island.tsx";

export default function Product({ product }) {
  return (
    <div class="product-page">
      {/* Image gallery (Vue) */}
      <Island 
        src="/islands/ImageGallery.vue"
        props={{ images: product.images }}
        condition="on:visible"
      />
      
      {/* Add to cart (Preact) */}
      <Island 
        src="/islands/AddToCart.tsx"
        props={{ productId: product.id, price: product.price }}
        condition="on:interaction"
      />
      
      {/* Reviews (Solid) */}
      <Island 
        src="/islands/Reviews.solid.tsx"
        props={{ productId: product.id }}
        condition="on:visible"
      />
      
      {/* Related products (Svelte) */}
      <Island 
        src="/islands/RelatedProducts.svelte"
        props={{ category: product.category }}
        condition="on:idle"
      />
    </div>
  );
}
```

### Example 12: Blog with Comments

```tsx
// pages/blog/[slug].tsx
import { h } from "preact";
import Island from "../../islands/island.tsx";

export default function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      
      {/* Social share buttons (Preact, hydrate on interaction) */}
      <Island 
        src="/islands/ShareButtons.tsx"
        props={{ url: post.url, title: post.title }}
        condition="on:interaction"
      />
      
      {/* Comments section (Vue, hydrate when visible) */}
      <Island 
        src="/islands/Comments.vue"
        props={{ postId: post.id }}
        condition="on:visible"
      />
      
      {/* Newsletter signup (Svelte, hydrate when idle) */}
      <Island 
        src="/islands/Newsletter.svelte"
        condition="on:idle"
      />
    </article>
  );
}
```

### Example 13: Admin Dashboard

```tsx
// pages/admin/dashboard.tsx
import { h } from "preact";
import Island from "../../islands/island.tsx";

export default function AdminDashboard() {
  return (
    <div class="admin-dashboard">
      {/* Real-time stats (Solid, immediate hydration) */}
      <Island 
        src="/islands/admin/Stats.solid.tsx"
        condition="on:client"
      />
      
      {/* Data table (Vue, hydrate when visible) */}
      <Island 
        src="/islands/admin/DataTable.vue"
        props={{ endpoint: "/api/users" }}
        condition="on:visible"
      />
      
      {/* Chart (Preact, hydrate when visible) */}
      <Island 
        src="/islands/admin/Chart.tsx"
        props={{ type: "line", data: [] }}
        condition="on:visible"
      />
      
      {/* Settings form (Svelte, hydrate on interaction) */}
      <Island 
        src="/islands/admin/Settings.svelte"
        condition="on:interaction"
      />
    </div>
  );
}
```

## Summary

These examples demonstrate:

1. **Official integrations** - Using Preact, Vue, Solid, and Svelte
2. **Custom integrations** - Creating integrations for Lit and Alpine.js
3. **Advanced patterns** - Multiple frameworks, conditional hydration, progressive enhancement
4. **Real-world use cases** - E-commerce, blogs, admin dashboards

For more information, see:
- [Integration System Overview](./README.md)
- [Development Guide](./development-guide.md)
- [Migration Guide](./migration-guide.md)

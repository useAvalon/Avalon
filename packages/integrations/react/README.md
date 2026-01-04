# @avalon/integration-react

React integration for the Avalon framework, providing support for React components as islands with React Server Components (RSC) support.

## Status

🚧 **Under Development** - This integration is currently being implemented.

## Features (Planned)

- ✅ React 18+ support with concurrent features
- ✅ Server-side rendering with `renderToString`
- ✅ Client-side hydration with `hydrateRoot`
- ✅ React Server Components (RSC) support
- ✅ All React hooks (useState, useEffect, useContext, etc.)
- ✅ Error boundaries in islands
- ✅ Multiple hydration strategies (on:client, on:visible, on:idle, on:interaction)

## Installation

```bash
# This integration will be included with Avalon
# No separate installation required
```

## Usage

Documentation will be added as implementation progresses.

### Basic Example

```tsx
// Avalon/src/islands/Counter.tsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### React Server Components

```tsx
// Server Component (no "use client" directive)
async function ServerComponent() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// Client Component (with "use client" directive)
"use client";

import { useState } from "react";

export default function ClientComponent() {
  const [state, setState] = useState(0);
  return <button onClick={() => setState(state + 1)}>{state}</button>;
}
```

## API Reference

Documentation will be added as implementation progresses.

## License

MIT

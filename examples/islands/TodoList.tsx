// Advanced Preact island example with state management
import { useState } from 'preact/hooks';
import { render } from 'preact';
import type { JSX } from 'preact';

interface Todo {
	id: number;
	text: string;
	completed: boolean;
}

interface TodoListProps {
	initialTodos?: Todo[];
}

export default function TodoList({ initialTodos = [] }: TodoListProps): JSX.Element {
	const [todos, setTodos] = useState<Todo[]>(initialTodos);
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
		<div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
			<h3>Todo List Island</h3>

			<div style={{ marginBottom: '1rem' }}>
				<input
					type="text"
					value={newTodo}
					onInput={e => setNewTodo((e.target as HTMLInputElement).value)}
					onKeyPress={e => e.key === 'Enter' && addTodo()}
					placeholder="Add a new todo..."
					style={{ marginRight: '0.5rem', padding: '0.25rem' }}
				/>
				<button onClick={addTodo}>Add</button>
			</div>

			<div>
				{todos.length === 0 ? (
					<p style={{ color: '#666' }}>No todos yet. Add one above!</p>
				) : (
					todos.map(todo => (
						<div
							key={todo.id}
							style={{
								display: 'flex',
								alignItems: 'center',
								marginBottom: '0.5rem',
								textDecoration: todo.completed ? 'line-through' : 'none',
								opacity: todo.completed ? 0.6 : 1,
							}}>
							<input
								type="checkbox"
								checked={todo.completed}
								onChange={() => toggleTodo(todo.id)}
								style={{ marginRight: '0.5rem' }}
							/>
							<span style={{ flex: 1 }}>{todo.text}</span>
							<button onClick={() => deleteTodo(todo.id)} style={{ marginLeft: '0.5rem', color: 'red' }}>
								Delete
							</button>
						</div>
					))
				)}
			</div>

			<div style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
				{todos.length} total, {todos.filter(t => !t.completed).length} remaining
			</div>
		</div>
	);
}

// Hydration function for the island system
export function hydrate(container: HTMLElement, props: TodoListProps) {
	render(<TodoList {...props} />, container);
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}

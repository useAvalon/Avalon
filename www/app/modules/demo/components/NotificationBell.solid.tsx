import { createSignal, For, Show } from "solid-js";

interface NotificationBellProps {
	userId?: string;
}

export default function NotificationBell(props: NotificationBellProps) {
	const [notifications, setNotifications] = createSignal([
		{ id: 1, text: "New deployment succeeded" },
		{ id: 2, text: "PR #42 merged" },
		{ id: 3, text: "Build cache invalidated" },
	]);
	const [open, setOpen] = createSignal(false);

	function dismiss(id: number) {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	}

	return (
		<div class="notification-bell-solid">
			<div class="notification-bell-solid__header">
				<button
					class="notification-bell-solid__trigger"
					onClick={() => setOpen((o) => !o)}
					aria-label={`Notifications: ${notifications().length} unread`}
				>
					<svg
						aria-hidden="true"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
						<path d="M13.73 21a2 2 0 0 1-3.46 0" />
					</svg>
					<Show when={notifications().length > 0}>
						<span class="notification-bell-solid__badge">{notifications().length}</span>
					</Show>
				</button>
				<span class="notification-bell-solid__info">
					{props.userId ? `User: ${props.userId}` : "Personalized"}
				</span>
			</div>

			<Show when={open()}>
				<ul class="notification-bell-solid__list">
					<Show when={notifications().length === 0}>
						<li class="notification-bell-solid__empty">No notifications</li>
					</Show>
					<For each={notifications()}>
						{(n) => (
							<li class="notification-bell-solid__item">
								<span>{n.text}</span>
								<button
									class="notification-bell-solid__dismiss"
									onClick={() => dismiss(n.id)}
									aria-label={`Dismiss: ${n.text}`}
								>
									×
								</button>
							</li>
						)}
					</For>
				</ul>
			</Show>

			<style>{`
				.notification-bell-solid {
					font-family: system-ui, sans-serif;
					border-radius: 12px;
					background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
					border: 1px solid rgba(96, 165, 250, 0.2);
					padding: 1rem;
				}
				.notification-bell-solid__header {
					display: flex;
					align-items: center;
					gap: 0.75rem;
				}
				.notification-bell-solid__trigger {
					position: relative;
					background: rgba(96, 165, 250, 0.1);
					border: 1px solid rgba(96, 165, 250, 0.3);
					border-radius: 8px;
					padding: 0.5rem;
					color: #60a5fa;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.notification-bell-solid__trigger:hover {
					background: rgba(96, 165, 250, 0.2);
				}
				.notification-bell-solid__badge {
					position: absolute;
					top: -4px;
					right: -4px;
					background: #ef4444;
					color: white;
					font-size: 0.6rem;
					font-weight: 700;
					width: 16px;
					height: 16px;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.notification-bell-solid__info {
					font-size: 0.75rem;
					color: #6b7280;
				}
				.notification-bell-solid__list {
					list-style: none;
					margin: 0.75rem 0 0;
					padding: 0;
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
				}
				.notification-bell-solid__item {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 0.5rem 0.75rem;
					background: rgba(0, 0, 0, 0.3);
					border-radius: 6px;
					font-size: 0.8rem;
					color: #e0e0e0;
				}
				.notification-bell-solid__dismiss {
					background: none;
					border: none;
					color: #6b7280;
					font-size: 1.1rem;
					cursor: pointer;
					padding: 0 0.25rem;
					line-height: 1;
				}
				.notification-bell-solid__dismiss:hover {
					color: #ef4444;
				}
				.notification-bell-solid__empty {
					text-align: center;
					color: #6b7280;
					font-size: 0.8rem;
					padding: 0.5rem;
				}
			`}</style>
		</div>
	);
}

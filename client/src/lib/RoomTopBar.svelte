<script lang="ts">
	export let roomId: string;
	export let senderName: string;
	export let onToggleChat: (() => void) | null = null;
	export let unreadCount = 0;
</script>

<header class="room-top">
	<a class="wordmark" href="/">chattr</a>
	<div class="room-meta">
		<span class="live-pill">
			<span class="dot" />
			<span>on air</span>
		</span>
		<span class="meta-divider" />
		<span class="frequency">
			<span class="frequency-label">freq</span>
			<span class="frequency-value">{roomId}</span>
		</span>
	</div>
	<div class="room-user">
		<span>{senderName}</span>
		{#if onToggleChat}
			<button class="chat-btn" on:click={onToggleChat} aria-label="Toggle chat">
				<svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
				>
				{#if unreadCount > 0}
					<span class="badge">{unreadCount}</span>
				{/if}
			</button>
		{/if}
	</div>
</header>

<style>
	.room-top {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
	}

	.wordmark {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s;
	}

	.wordmark:hover {
		color: var(--accent);
	}

	.room-meta {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		justify-self: center;
		padding: 0.4rem 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
	}

	.live-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--accent);
	}

	.live-pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent-glow);
		animation: -global-pulse 1.6s infinite;
	}

	.meta-divider {
		width: 1px;
		height: 14px;
		background: var(--border-strong);
	}

	.frequency {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.frequency-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-faint);
	}

	.frequency-value {
		color: var(--text);
		font-weight: 500;
	}

	.room-user {
		justify-self: end;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.chat-btn {
		position: relative;
		width: 36px;
		height: 36px;
		display: none;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 50%;
		transition: background 0.15s;
	}

	.chat-btn:hover {
		background: var(--surface-3);
	}

	.badge {
		position: absolute;
		top: -2px;
		right: -2px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.6rem;
		font-weight: 600;
		background: var(--accent);
		color: var(--bg);
		border-radius: 999px;
	}

	@media (max-width: 900px) {
		.chat-btn {
			display: inline-flex;
		}
	}

	@media (max-width: 640px) {
		.room-top {
			grid-template-columns: auto 1fr auto;
			gap: 0.5rem;
		}

		.room-meta {
			padding: 0.3rem 0.55rem;
			gap: 0.5rem;
		}

		.frequency-label {
			display: none;
		}

		.room-user > span {
			display: none;
		}
	}
</style>

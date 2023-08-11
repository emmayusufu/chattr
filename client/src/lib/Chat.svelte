<script lang="ts">
	export let messages: { sender: string; message: string }[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;
	export let open = true;
	export let onClose: (() => void) | null = null;
</script>

<aside class="sidebar" class:is-open={open}>
	<header class="sidebar-head">
		<span class="sidebar-title">channel chat</span>
		<div class="sidebar-meta">
			<span class="sidebar-count">{messages.length}</span>
			{#if onClose}
				<button class="sidebar-close" on:click={onClose} aria-label="Close chat">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			{/if}
		</div>
	</header>
	<div class="messages">
		{#if messages.length === 0}
			<p class="empty">Quiet on the wire.</p>
		{/if}
		{#each messages as message}
			<div class="msg" class:is-self={message.sender === senderName}>
				<span class="msg-sender">{message.sender}</span>
				<span class="msg-body">{message.message}</span>
			</div>
		{/each}
	</div>
	<form class="composer" on:submit|preventDefault={onSend}>
		<input type="text" bind:value={chatMessage} placeholder="Say something —" />
		<button type="submit" disabled={!chatMessage.trim()}>send</button>
	</form>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		min-height: 0;
		overflow: hidden;
	}

	.sidebar-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.sidebar-title {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.sidebar-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sidebar-count {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--accent);
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--accent-soft);
		border-radius: 999px;
		background: var(--accent-soft);
	}

	.sidebar-close {
		display: none;
		background: transparent;
		border: none;
		color: var(--text-muted);
		padding: 0.2rem;
	}

	.sidebar-close:hover {
		color: var(--text);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.empty {
		font-size: 0.9rem;
		font-weight: 450;
		color: var(--text-faint);
		text-align: center;
		margin: 2rem 0;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.55rem 0.75rem;
		background: var(--surface-2);
		border-left: 2px solid var(--border);
		border-radius: 0 2px 2px 0;
		max-width: 92%;
	}

	.msg.is-self {
		align-self: flex-end;
		background: var(--accent-soft);
		border-left-color: var(--accent);
	}

	.msg-sender {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--accent);
	}

	.msg-body {
		font-size: 0.9rem;
		color: var(--text);
		word-break: break-word;
	}

	.composer {
		display: flex;
		border-top: 1px solid var(--border);
		background: var(--bg);
	}

	.composer input {
		flex: 1;
		padding: 0.85rem 1rem;
		border: none;
		font-size: 0.9rem;
		color: var(--text);
		outline: none;
	}

	.composer input::placeholder {
		color: var(--text-faint);
	}

	.composer button {
		padding: 0 1.2rem;
		background: transparent;
		border: none;
		border-left: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		transition: background 0.2s, color 0.2s;
	}

	.composer button:hover:not(:disabled) {
		background: var(--accent);
		color: var(--bg);
	}

	.composer button:disabled {
		color: var(--text-faint);
		cursor: not-allowed;
	}

	@media (max-width: 900px) {
		.sidebar {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(360px, 90vw);
			z-index: 20;
			border-radius: 0;
			border-left: 1px solid var(--border-strong);
			transform: translateX(100%);
			transition: transform 0.25s ease;
		}

		.sidebar.is-open {
			transform: translateX(0);
		}

		.sidebar-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>

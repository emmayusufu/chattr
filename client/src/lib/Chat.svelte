<script lang="ts">
	export let messages: { sender: string; message: string }[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;
	export let encrypted = false;
</script>

<div class="chat-pane">
	{#if encrypted}
		<div class="encrypted-banner">end-to-end encrypted</div>
	{/if}
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
</div>

<style>
	.chat-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.encrypted-banner {
		padding: 0.4rem 1rem;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.7rem;
		font-weight: 600;
		border-bottom: 1px solid var(--border);
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
</style>

<script lang="ts">
	import { afterUpdate, tick } from 'svelte';
	import { renderMarkdown } from './markdown';

	export let messages: { sender: string; message: string }[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;

	let messagesEl: HTMLDivElement;
	let textareaEl: HTMLTextAreaElement;

	afterUpdate(() => {
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (chatMessage.trim()) onSend();
		}
	}

	async function autoResize() {
		await tick();
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
	}

	$: if (!chatMessage && textareaEl) textareaEl.style.height = '';
</script>

<div class="chat-pane">
	<div class="messages" bind:this={messagesEl}>
		{#if messages.length === 0}
			<p class="empty">No messages yet</p>
		{/if}
		{#each messages as msg}
			<div class="msg" class:is-self={msg.sender === senderName}>
				<span class="msg-sender">{msg.sender}</span>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown sanitizes with DOMPurify -->
				<div class="msg-body">{@html renderMarkdown(msg.message)}</div>
			</div>
		{/each}
	</div>

	<form class="composer" on:submit|preventDefault={onSend}>
		<textarea
			bind:this={textareaEl}
			bind:value={chatMessage}
			placeholder="Message..."
			rows="1"
			on:input={autoResize}
			on:keydown={handleKeydown}
		/>
		<button type="submit" class="send-btn" disabled={!chatMessage.trim()} aria-label="Send">
			<svg
				viewBox="0 0 24 24"
				width="16"
				height="16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="22" y1="2" x2="11" y2="13" />
				<polygon points="22 2 15 22 11 13 2 9 22 2" />
			</svg>
		</button>
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

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.empty {
		font-size: 0.8rem;
		color: var(--text-faint);
		text-align: center;
		margin: auto 0;
	}

	.msg {
		padding: 0.4rem 0.6rem;
		background: rgba(244, 237, 228, 0.04);
		border-radius: 8px;
		max-width: 90%;
	}

	.msg.is-self {
		align-self: flex-end;
		background: var(--accent-soft);
	}

	.msg-sender {
		display: block;
		font-weight: 600;
		font-size: 0.7rem;
		color: var(--accent);
		margin-bottom: 0.1rem;
	}

	.msg-body {
		font-size: 0.82rem;
		color: var(--text);
		word-break: break-word;
		line-height: 1.45;
	}

	.msg-body :global(p) {
		margin: 0;
	}
	.msg-body :global(p + p),
	.msg-body :global(ul),
	.msg-body :global(ol),
	.msg-body :global(pre),
	.msg-body :global(blockquote) {
		margin-top: 0.3rem;
	}
	.msg-body :global(ul),
	.msg-body :global(ol) {
		margin-bottom: 0;
		padding-left: 1.1rem;
	}

	.msg-body :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8em;
		padding: 0.05rem 0.25rem;
		background: rgba(244, 237, 228, 0.06);
		border-radius: 3px;
	}

	.msg-body :global(pre) {
		margin-bottom: 0;
		padding: 0.45rem 0.6rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		overflow-x: auto;
	}

	.msg-body :global(pre code) {
		background: none;
		padding: 0;
		font-size: 0.8em;
		line-height: 1.4;
	}
	.msg-body :global(a) {
		color: var(--accent);
		text-decoration: underline;
	}
	.msg-body :global(blockquote) {
		margin: 0;
		padding-left: 0.5rem;
		border-left: 2px solid var(--border-strong);
		color: var(--text-muted);
	}

	.composer {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem;
		border-top: 1px solid rgba(244, 237, 228, 0.06);
	}

	.composer textarea {
		flex: 1;
		min-height: 36px;
		max-height: 120px;
		padding: 0.45rem 0.6rem;
		border: none;
		font-size: 0.82rem;
		font-family: inherit;
		color: var(--text);
		outline: none;
		background: rgba(244, 237, 228, 0.04);
		border-radius: 8px;
		resize: none;
		line-height: 1.4;
	}

	.composer textarea:focus {
		box-shadow: 0 0 0 2px var(--accent-soft);
	}

	.composer textarea::placeholder {
		color: var(--text-faint);
	}

	.send-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: opacity 0.15s;
		flex: 0 0 36px;
	}

	.send-btn:hover:not(:disabled) {
		opacity: 0.85;
	}
	.send-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.send-btn {
			width: 44px;
			height: 44px;
			flex: 0 0 44px;
		}
	}
</style>

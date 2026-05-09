<script lang="ts">
	import { tick } from 'svelte';
	import { renderMarkdown, COPY_ICON_SVG, CHECK_ICON_SVG } from './markdown.js';
	import type { ChatMessage } from './RoomClient';

	export let messages: ChatMessage[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;
	export let encrypted = false;

	let textareaEl: HTMLTextAreaElement;
	let messagesEl: HTMLDivElement;
	let stickToBottom = true;

	$: chatMessage, scheduleResize();
	$: messages, scrollIfNeeded(messages.length);

	async function scheduleResize() {
		await tick();
		autoResize();
	}

	function autoResize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const next = Math.min(textareaEl.scrollHeight, 160);
		textareaEl.style.height = next + 'px';
		textareaEl.style.overflowY = textareaEl.scrollHeight > 160 ? 'auto' : 'hidden';
	}

	async function scrollIfNeeded(_len: number) {
		await tick();
		if (!messagesEl) return;
		const lastIsSelf =
			messages.length > 0 && messages[messages.length - 1].sender === senderName;
		if (stickToBottom || lastIsSelf) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
			stickToBottom = true;
		}
	}

	function onScroll() {
		if (!messagesEl) return;
		const distanceFromBottom =
			messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
		stickToBottom = distanceFromBottom < 80;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (chatMessage.trim()) onSend();
		}
	}

	function formatTime(ts?: number): string {
		if (!ts) return '';
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	async function onMessagesClick(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		const btn = target?.closest('[data-copy-button]') as HTMLButtonElement | null;
		if (!btn) return;
		const code = btn.parentElement?.querySelector('code');
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code.textContent ?? '');
			btn.innerHTML = CHECK_ICON_SVG;
			btn.title = 'Copied';
			btn.setAttribute('aria-label', 'Copied');
			btn.classList.add('copied');
			setTimeout(() => {
				btn.innerHTML = COPY_ICON_SVG;
				btn.title = 'Copy';
				btn.setAttribute('aria-label', 'Copy code');
				btn.classList.remove('copied');
			}, 1500);
		} catch {
			btn.title = 'Copy failed';
			setTimeout(() => (btn.title = 'Copy'), 1500);
		}
	}
</script>

<div class="chat-pane">
	{#if encrypted}
		<div class="encrypted-banner">end-to-end encrypted</div>
	{/if}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
	<div
		class="messages"
		bind:this={messagesEl}
		on:scroll={onScroll}
		on:click={onMessagesClick}
		role="log"
	>
		{#if messages.length === 0}
			<p class="empty">Quiet on the wire.</p>
		{/if}
		{#each messages as message, i}
			{@const sameAsPrev = i > 0 && messages[i - 1].sender === message.sender}
			<div
				class="msg"
				class:is-self={message.sender === senderName}
				class:continuation={sameAsPrev}
			>
				{#if !sameAsPrev}
					<div class="msg-meta">
						<span class="msg-sender">{message.sender}</span>
						{#if message.timestamp}
							<span class="msg-time">{formatTime(message.timestamp)}</span>
						{/if}
					</div>
				{/if}
				<div class="msg-body" title={formatTime(message.timestamp)}>
					{@html renderMarkdown(message.message)}
				</div>
			</div>
		{/each}
	</div>
	<form class="composer" on:submit|preventDefault={onSend}>
		<textarea
			bind:this={textareaEl}
			bind:value={chatMessage}
			on:keydown={onKeydown}
			placeholder="Say something — Shift+Enter for newline"
			rows="1"
		/>
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
		border-radius: 4px;
		max-width: 92%;
		margin-top: 0.7rem;
	}

	.msg:first-of-type {
		margin-top: 0;
	}

	.msg.continuation {
		margin-top: 0.2rem;
	}

	.msg.is-self {
		align-self: flex-end;
	}

	.msg-meta {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.msg-sender {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--accent);
	}

	.msg-time {
		font-size: 0.7rem;
		color: var(--text-faint);
	}

	.msg-body {
		font-size: 0.9rem;
		color: var(--text);
		word-break: break-word;
	}

	.msg-body :global(p) {
		margin: 0;
	}

	.msg-body :global(p + p),
	.msg-body :global(ul),
	.msg-body :global(ol),
	.msg-body :global(blockquote),
	.msg-body :global(pre) {
		margin-top: 0.4rem;
	}

	.msg-body :global(ul),
	.msg-body :global(ol) {
		padding-left: 1.25rem;
	}

	.msg-body :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.82rem;
		background: var(--surface-3, rgba(0, 0, 0, 0.08));
		padding: 0.05rem 0.3rem;
		border-radius: 3px;
	}

	.msg-body :global(pre) {
		position: relative;
		margin: 0.4rem 0 0;
		padding: 0.6rem 0.75rem;
		font-size: 0.82rem;
		line-height: 1.45;
		background: var(--surface-3, rgba(0, 0, 0, 0.3));
		border-radius: 4px;
		overflow-x: auto;
	}

	.msg-body :global(pre code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		background: transparent;
		padding: 0;
	}

	.msg-body :global(pre .copy-btn) {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		color: var(--text-faint);
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s, background 0.15s;
	}

	.msg-body :global(pre:hover .copy-btn),
	.msg-body :global(pre .copy-btn:focus-visible) {
		opacity: 1;
	}

	.msg-body :global(pre .copy-btn:hover) {
		color: var(--text);
		background: rgba(0, 0, 0, 0.55);
	}

	.msg-body :global(pre .copy-btn.copied) {
		color: var(--accent);
		opacity: 1;
	}

	.msg-body :global(pre .copy-btn svg) {
		display: block;
	}

	.msg-body :global(blockquote) {
		margin-left: 0;
		padding-left: 0.7rem;
		border-left: 2px solid var(--border);
		color: var(--text-muted);
	}

	.msg-body :global(a) {
		color: var(--accent);
		text-decoration: underline;
	}

	.msg-body :global(h1),
	.msg-body :global(h2),
	.msg-body :global(h3),
	.msg-body :global(h4),
	.msg-body :global(h5),
	.msg-body :global(h6) {
		margin: 0.3rem 0 0.2rem;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.composer {
		display: flex;
		align-items: stretch;
		border-top: 1px solid var(--border);
		background: var(--bg);
	}

	.composer textarea {
		flex: 1;
		box-sizing: border-box;
		padding: 0.85rem 1rem;
		border: none;
		font-size: 0.9rem;
		font-family: inherit;
		color: var(--text);
		outline: none;
		background: transparent;
		resize: none;
		max-height: 10rem;
		line-height: 1.4;
		overflow-y: hidden;
	}

	.composer textarea::placeholder {
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

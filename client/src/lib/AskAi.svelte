<script lang="ts">
	import { onMount } from 'svelte';
	import { askGemini, captureFrame, findScreenShareVideo, getStoredApiKey, setStoredApiKey } from './ai.js';
	import type { RoomClient } from './RoomClient';

	export let room: RoomClient;
	export let onClose: () => void;

	let apiKey = '';
	let hasStoredKey = false;
	let editKey = false;
	let question = '';
	let status: 'idle' | 'working' | 'error' = 'idle';
	let statusText = '';
	let errorText = '';
	let textareaEl: HTMLTextAreaElement;

	onMount(() => {
		const stored = getStoredApiKey();
		if (stored) {
			apiKey = stored;
			hasStoredKey = true;
		}
		setTimeout(() => textareaEl?.focus(), 50);
	});

	async function ask() {
		const q = question.trim();
		if (!q) return;
		if (!apiKey.trim()) {
			errorText = 'Gemini API key required.';
			status = 'error';
			return;
		}

		setStoredApiKey(apiKey);
		hasStoredKey = true;
		editKey = false;
		status = 'working';
		errorText = '';

		try {
			const video = findScreenShareVideo();
			let imageBase64: string | null = null;
			if (video) {
				statusText = 'capturing screen share…';
				imageBase64 = await captureFrame(video);
			}

			statusText = 'asking Gemini…';
			const answer = await askGemini({
				apiKey,
				question: q,
				imageBase64,
				context: video
					? 'Two engineers are pair-debugging on a chattr call. One of them is sharing the screen shown in the attached image.'
					: 'Two engineers are pair-debugging on a chattr call. No screen share is active right now.'
			});

			await room.sendMessage(q);
			room.sendAiMessage(answer);

			status = 'idle';
			statusText = '';
			onClose();
		} catch (err) {
			status = 'error';
			errorText = err instanceof Error ? err.message : String(err);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			void ask();
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	class="backdrop"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	on:click|self={onClose}
	on:keydown={onKeydown}
>
	<div class="modal">
		<header>
			<h2>Ask AI</h2>
			<button class="close" on:click={onClose} aria-label="Close">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</header>

		<p class="lede">
			Gemini reads the active screen share (if any) and answers in chat as <b>AI</b>.
			Both sides of the call see the response.
		</p>

		{#if !hasStoredKey || editKey}
			<label class="field">
				<span>Gemini API key</span>
				<input
					type="password"
					bind:value={apiKey}
					placeholder="AIza…"
					autocomplete="off"
					spellcheck="false"
				/>
				<small>Stored in your browser only. Used directly from your machine to call Gemini.</small>
			</label>
		{:else}
			<div class="key-row">
				<span class="muted">key saved in this browser</span>
				<button class="link" on:click={() => (editKey = true)}>change</button>
			</div>
		{/if}

		<label class="field">
			<span>Question</span>
			<textarea
				bind:this={textareaEl}
				bind:value={question}
				placeholder="why does this command fail?"
				rows="3"
			></textarea>
		</label>

		{#if status === 'working'}
			<div class="status working">{statusText}</div>
		{:else if status === 'error'}
			<div class="status err">{errorText}</div>
		{/if}

		<div class="actions">
			<span class="hint muted">⌘+Enter to send</span>
			<div class="btns">
				<button class="cta-ghost" on:click={onClose}>Cancel</button>
				<button class="cta" on:click={ask} disabled={!question.trim() || status === 'working'}>
					{status === 'working' ? 'asking…' : 'Ask'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 40;
		padding: 1rem;
	}

	.modal {
		width: min(540px, 100%);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.25rem 1.4rem 1.4rem;
		color: var(--text);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }

	.close {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.2rem;
	}
	.close:hover { color: var(--text); }

	.lede { margin: 0 0 1rem; color: var(--text-muted); }
	.muted { color: var(--text-muted); font-size: 0.8rem; }

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.85rem;
	}

	.field > span {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field small {
		color: var(--text-faint);
		font-size: 0.72rem;
	}

	.field input,
	.field textarea {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.5rem 0.65rem;
		color: var(--text);
		font-size: 0.9rem;
		font-family: inherit;
		outline: none;
		resize: none;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: var(--accent);
	}

	.key-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.85rem;
	}

	.link {
		background: transparent;
		border: none;
		color: var(--accent);
		padding: 0;
		cursor: pointer;
		font-size: 0.8rem;
		text-decoration: underline;
	}

	.status {
		padding: 0.45rem 0.6rem;
		border-radius: 4px;
		font-size: 0.8rem;
		margin-bottom: 0.85rem;
	}

	.status.working {
		background: var(--surface-2);
		color: var(--accent);
	}

	.status.err {
		background: rgba(209, 100, 100, 0.12);
		color: var(--danger, #d16464);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hint { font-size: 0.75rem; }

	.btns { display: flex; gap: 0.5rem; }

	.cta {
		padding: 0.55rem 1rem;
		background: var(--accent);
		color: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 3px;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.cta:disabled { opacity: 0.5; cursor: not-allowed; }

	.cta-ghost {
		padding: 0.55rem 1rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-strong);
		border-radius: 3px;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.cta-ghost:hover { color: var(--text); border-color: var(--text-muted); }
</style>

<script lang="ts">
	import { afterUpdate } from 'svelte';
	import type { TranscriptSegment } from './transcription';

	export let transcript: TranscriptSegment[];
	export let isTranscribing: boolean;
	export let isHost: boolean;
	export let onToggle: () => void;

	let scrollEl: HTMLDivElement;

	afterUpdate(() => {
		if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
	});

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function exportMinutes() {
		if (transcript.length === 0) return;
		const lines = transcript.map(
			(s) => `[${formatTime(s.timestamp)}] ${s.speaker}: ${s.text}`
		);
		const text = `Meeting Minutes\n${new Date().toLocaleDateString()}\n${'—'.repeat(40)}\n\n${lines.join('\n')}`;
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `minutes-${new Date().toISOString().slice(0, 10)}.txt`;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 500);
	}
</script>

<div class="minutes-pane">
	{#if isHost}
		<div class="minutes-header">
			<button class="rec-toggle" class:active={isTranscribing} on:click={onToggle}>
				<span class="rec-dot" />
				{isTranscribing ? 'Stop' : 'Start'}
			</button>
			{#if transcript.length > 0}
				<button class="export-btn" on:click={exportMinutes}>Export</button>
			{/if}
		</div>
	{/if}

	<div class="transcript" bind:this={scrollEl}>
		{#if transcript.length === 0}
			<p class="empty">
				{#if isHost}
					{isTranscribing ? 'Listening...' : 'Start transcription to capture meeting minutes.'}
				{:else}
					{isTranscribing ? 'Listening...' : 'The host can start transcription.'}
				{/if}
			</p>
		{/if}
		{#each transcript as seg}
			<div class="seg">
				<span class="seg-meta">
					<span class="seg-speaker">{seg.speaker}</span>
					<span class="seg-time">{formatTime(seg.timestamp)}</span>
				</span>
				<span class="seg-text">{seg.text}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.minutes-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.minutes-header {
		display: flex;
		gap: 0.3rem;
		padding: 0.5rem;
	}

	.rec-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		justify-content: center;
		padding: 0.4rem 0.75rem;
		background: rgba(244, 237, 228, 0.04);
		border: none;
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.rec-toggle:hover {
		background: rgba(244, 237, 228, 0.08);
		color: var(--text);
	}

	.rec-toggle.active {
		color: var(--danger);
	}

	.rec-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-faint);
		transition: background 0.15s, box-shadow 0.15s;
	}

	.rec-toggle.active .rec-dot {
		background: var(--danger);
		box-shadow: 0 0 8px rgba(209, 100, 100, 0.6);
		animation: -global-pulse 1.4s infinite;
	}

	.export-btn {
		padding: 0.4rem 0.75rem;
		background: rgba(244, 237, 228, 0.04);
		border: none;
		border-radius: 8px;
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.export-btn:hover {
		background: var(--accent-soft);
	}

	.transcript {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.empty {
		font-size: 0.8rem;
		color: var(--text-faint);
		text-align: center;
		margin: auto 0;
	}

	.seg {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.35rem 0.5rem;
		background: rgba(244, 237, 228, 0.03);
		border-radius: 6px;
	}

	.seg-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.seg-speaker {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent);
	}

	.seg-time {
		font-size: 0.6rem;
		color: var(--text-faint);
	}

	.seg-text {
		font-size: 0.8rem;
		color: var(--text);
		line-height: 1.4;
	}
</style>

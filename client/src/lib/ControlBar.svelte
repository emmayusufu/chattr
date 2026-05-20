<script lang="ts">
	export let isMuted: boolean;
	export let isCamOff: boolean;
	export let isSharing: boolean;
	export let isRecording: boolean;
	export let onToggleMute: () => void;
	export let onToggleCam: () => void;
	export let onToggleScreen: () => void;
	export let onToggleRecord: () => void;
	export let onAskAi: () => void;
	export let onLeave: () => void;
</script>

<div class="controls">
	<button
		class="ctl"
		class:ctl-off={isMuted}
		on:click={onToggleMute}
		title={isMuted ? 'Unmute' : 'Mute'}
		aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
	>
		{#if isMuted}
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><line x1="2" y1="2" x2="22" y2="22" /><path
					d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"
				/><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path
					d="M9 9v3a3 3 0 0 0 5.12 2.12"
				/><line x1="12" y1="19" x2="12" y2="22" /></svg
			>
		{:else}
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path
					d="M19 10v2a7 7 0 0 1-14 0v-2"
				/><line x1="12" y1="19" x2="12" y2="22" /></svg
			>
		{/if}
	</button>

	<button
		class="ctl"
		class:ctl-off={isCamOff}
		on:click={onToggleCam}
		title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
		aria-label={isCamOff ? 'Turn camera on' : 'Turn camera off'}
	>
		{#if isCamOff}
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path
					d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"
				/><line x1="1" y1="1" x2="23" y2="23" /></svg
			>
		{:else}
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><polygon points="23 7 16 12 23 17 23 7" /><rect
					x="1"
					y="5"
					width="15"
					height="14"
					rx="2"
					ry="2"
				/></svg
			>
		{/if}
	</button>

	<button
		class="ctl"
		class:ctl-on={isSharing}
		on:click={onToggleScreen}
		title={isSharing ? 'Stop sharing' : 'Share screen'}
		aria-label={isSharing ? 'Stop sharing screen' : 'Share screen'}
	>
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
				x1="8"
				y1="21"
				x2="16"
				y2="21"
			/><line x1="12" y1="17" x2="12" y2="21" /></svg
		>
	</button>

	<button
		class="ctl"
		class:ctl-rec={isRecording}
		on:click={onToggleRecord}
		title={isRecording ? 'Stop recording' : 'Record call'}
		aria-label={isRecording ? 'Stop recording' : 'Record call'}
	>
		{#if isRecording}
			<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
				<rect x="6" y="6" width="12" height="12" rx="2" />
			</svg>
		{:else}
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg
			>
		{/if}
	</button>

	<button class="ctl" on:click={onAskAi} title="Ask AI" aria-label="Ask AI">
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" /><path
				d="M20 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
			/></svg
		>
	</button>

	<span class="ctl-divider" aria-hidden="true" />

	<button class="ctl ctl-end" on:click={onLeave} title="Leave call" aria-label="Leave call">
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path
				d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"
			/><line x1="23" y1="1" x2="1" y2="23" /></svg
		>
	</button>
</div>

<style>
	.controls {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5);
		z-index: 10;
	}

	.ctl {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 50%;
		transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
	}

	.ctl:hover {
		background: var(--surface-3);
		border-color: var(--border-strong);
	}

	.ctl:active {
		transform: scale(0.94);
	}

	.ctl-off {
		background: var(--danger);
		color: var(--bg);
		border-color: var(--danger);
	}

	.ctl-off:hover {
		background: var(--danger);
		border-color: var(--danger);
		opacity: 0.9;
	}

	.ctl-on {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
	}

	.ctl-on:hover {
		background: var(--accent);
		border-color: var(--accent);
		opacity: 0.9;
	}

	.ctl-rec {
		background: var(--danger);
		color: var(--bg);
		border-color: var(--danger);
		animation: ctl-rec-pulse 1.6s infinite;
	}

	.ctl-rec:hover {
		background: var(--danger);
		opacity: 0.9;
	}

	@keyframes ctl-rec-pulse {
		0% { box-shadow: 0 0 0 0 rgba(209, 100, 100, 0.55); }
		70% { box-shadow: 0 0 0 12px transparent; }
		100% { box-shadow: 0 0 0 0 transparent; }
	}

	.ctl-divider {
		width: 1px;
		height: 24px;
		background: var(--border-strong);
		margin: 0 0.25rem;
	}

	.ctl-end {
		background: var(--danger);
		color: var(--bg);
		border-color: var(--danger);
		width: 56px;
	}

	.ctl-end:hover {
		background: var(--danger);
		border-color: var(--danger);
		opacity: 0.9;
	}

	@media (max-width: 640px) {
		.controls {
			bottom: 0.75rem;
			padding: 0.4rem;
			gap: 0.35rem;
		}

		.ctl {
			width: 40px;
			height: 40px;
		}

		.ctl-end {
			width: 48px;
		}
	}
</style>

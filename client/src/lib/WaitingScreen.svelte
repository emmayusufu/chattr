<script lang="ts">
	import VideoPlayer from '../components/VideoPlayer.svelte';
	import type { RoomClient } from './RoomClient';

	export let room: RoomClient;
	export let roomId: string;
	export let onLeave: () => void;

	const { localStream, isMuted, isCamOff } = room;
</script>

<div class="waiting-page">
	<div class="waiting-card">
		<div class="preview-pane" class:cam-off={$isCamOff}>
			{#if $localStream && !$isCamOff}
				<VideoPlayer mediaStream={$localStream} muted={true} mirror={true} />
			{:else}
				<div class="cam-off-cover">
					<svg
						viewBox="0 0 24 24"
						width="36"
						height="36"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path
							d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"
						/><line x1="1" y1="1" x2="23" y2="23" /></svg
					>
					<span>camera is off</span>
				</div>
			{/if}

			<div class="preview-controls">
				<button
					class="ctl"
					class:ctl-off={$isMuted}
					on:click={() => room.toggleMute()}
					title={$isMuted ? 'Unmute' : 'Mute'}
					aria-label={$isMuted ? 'Unmute microphone' : 'Mute microphone'}
				>
					{#if $isMuted}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><line x1="2" y1="2" x2="22" y2="22" /><path
								d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"
							/><path d="M5 10v2a7 7 0 0 0 12 5" /><path
								d="M15 9.34V5a3 3 0 0 0-5.68-1.33"
							/><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><line
								x1="12"
								y1="19"
								x2="12"
								y2="22"
							/></svg
						>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
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
					class:ctl-off={$isCamOff}
					on:click={() => room.toggleCam()}
					title={$isCamOff ? 'Turn camera on' : 'Turn camera off'}
					aria-label={$isCamOff ? 'Turn camera on' : 'Turn camera off'}
				>
					{#if $isCamOff}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
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
							width="18"
							height="18"
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
			</div>
		</div>

		<div class="info-pane">
			<div class="status-line">
				<span class="pulse" aria-hidden="true" />
				<span class="status-text">waiting for the host</span>
			</div>
			<h1 class="title">Almost in.</h1>
			<p class="lede">
				The host will let you in shortly. Use this moment to check your camera and mic.
			</p>
			<div class="room-badge" title="Room code">
				<span class="room-badge-label">room</span>
				<span class="room-badge-code">{roomId}</span>
			</div>
			<div class="actions">
				<button class="cta-ghost" on:click={onLeave}>Leave</button>
			</div>
		</div>
	</div>
</div>

<style>
	.waiting-page {
		min-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.waiting-card {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		gap: 1.75rem;
		width: min(960px, 100%);
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.preview-pane {
		position: relative;
		aspect-ratio: 16 / 10;
		background: var(--bg-deep);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		overflow: hidden;
	}

	.preview-pane :global(div),
	.preview-pane :global(video) {
		width: 100%;
		height: 100%;
	}

	.preview-pane :global(video) {
		display: block;
		object-fit: cover;
		border: none;
		border-radius: 0;
	}

	.cam-off-cover {
		display: flex !important;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 500;
	}

	.preview-controls {
		position: absolute;
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.4rem;
		padding: 0.35rem;
		background: rgba(10, 8, 7, 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: 999px;
		width: auto !important;
		height: auto !important;
	}

	.ctl {
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 50%;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
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

	.info-pane {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1rem;
		padding: 0.5rem 0.5rem 0.5rem 0;
	}

	.status-line {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.pulse {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 0 var(--accent-glow);
		animation: waiting-pulse 1.8s infinite;
	}

	@keyframes waiting-pulse {
		0% {
			box-shadow: 0 0 0 0 var(--accent-glow);
		}
		70% {
			box-shadow: 0 0 0 14px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	.title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.lede {
		margin: 0;
		font-size: 0.95rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.room-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		align-self: flex-start;
		padding: 0.35rem 0.7rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
	}

	.room-badge-label {
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.7rem;
	}

	.room-badge-code {
		color: var(--text);
	}

	.actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.25rem;
	}

	.cta-ghost {
		padding: 0.65rem 1.15rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-strong);
		border-radius: 2px;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.cta-ghost:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	@media (max-width: 760px) {
		.waiting-card {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.info-pane {
			padding: 0;
		}

		.title {
			font-size: 1.3rem;
		}
	}
</style>

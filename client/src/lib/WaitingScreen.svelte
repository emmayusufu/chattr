<script lang="ts">
	import StatusCard from './StatusCard.svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';

	export let localStream: MediaStream | null;
	export let onLeave: () => void;
</script>

<div class="screen-center">
	<div class="lobby-preview">
		{#if localStream}
			<div class="preview-tile">
				<VideoPlayer mediaStream={localStream} muted={true} mirror={true} />
			</div>
		{/if}
		<StatusCard eyebrow="in the lobby" title="Waiting for the host">
			<p>
				You'll be let in once the host approves. Hang tight, your camera and mic are already on.
			</p>
			<div class="card-actions">
				<button class="cta-ghost" on:click={onLeave}>Leave</button>
			</div>
		</StatusCard>
	</div>
</div>

<style>
	.screen-center {
		min-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lobby-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.preview-tile {
		width: min(420px, 80vw);
		aspect-ratio: 16 / 10;
		background: var(--bg-deep);
		border: 1px solid var(--accent-soft);
		border-radius: 4px;
		overflow: hidden;
	}

	.preview-tile :global(div),
	.preview-tile :global(video) {
		width: 100%;
		height: 100%;
	}

	.preview-tile :global(video) {
		display: block;
		object-fit: cover;
		border: none;
		border-radius: 0;
	}

	.card-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.cta-ghost {
		padding: 0.75rem 1.25rem;
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
</style>

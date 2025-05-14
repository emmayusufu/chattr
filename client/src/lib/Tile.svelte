<script lang="ts">
	import { onDestroy } from 'svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';

	export let stream: MediaStream | null = null;
	export let name = 'guest';
	export let muted = false;
	export let mirror = false;
	export let isLocal = false;
	export let isCamOff = false;
	export let isScreen = false;
	export let tag: string | null = null;

	let tileEl: HTMLDivElement;
	let videoAR: number | null = null;
	let rafId: number | null = null;

	function pollVideoSize() {
		if (!isScreen || !tileEl) return;
		const video = tileEl.querySelector('video');
		if (video && video.videoWidth > 0 && video.videoHeight > 0) {
			const ar = video.videoWidth / video.videoHeight;
			if (ar !== videoAR) videoAR = ar;
		}
		rafId = requestAnimationFrame(pollVideoSize);
	}

	$: if (isScreen && stream && tileEl) {
		pollVideoSize();
	}

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
	});
</script>

<div
	class="tile"
	class:is-local={isLocal}
	class:is-cam-off={isCamOff}
	class:is-screen={isScreen}
	bind:this={tileEl}
	style:aspect-ratio={isScreen && videoAR ? `${videoAR}` : undefined}
>
	{#if stream}
		<VideoPlayer mediaStream={stream} {muted} {mirror} />
	{/if}
	{#if isCamOff}
		<div class="cam-off-cover">
			<span>{name}</span>
		</div>
	{/if}
	<span class="tile-label">
		<span class="tile-name">{name}</span>
		{#if tag}<span class="tile-tag">{tag}</span>{/if}
	</span>
</div>

<style>
	.tile {
		position: relative;
		aspect-ratio: 16 / 10;
		background: var(--bg-deep);
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		transition: border-color 0.2s;
	}

	.tile.is-local {
		border-color: var(--accent-soft);
	}

	.tile :global(div),
	.tile :global(video) {
		width: 100%;
		height: 100%;
	}

	.tile :global(video) {
		display: block;
		object-fit: cover;
		border: none;
		border-radius: 0;
	}

	.tile.is-screen :global(video) {
		object-fit: contain;
	}

	.tile.is-screen {
		background: #000;
	}

	.cam-off-cover {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text);
	}

	.tile-label {
		position: absolute;
		left: 0.6rem;
		bottom: 0.6rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.55rem;
		background: rgba(10, 8, 7, 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: 2px;
		font-size: 0.75rem;
	}

	.tile-name {
		color: var(--text);
	}

	.tile-tag {
		color: var(--accent);
		font-size: 0.65rem;
	}
</style>

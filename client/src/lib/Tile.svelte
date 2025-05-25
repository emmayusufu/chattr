<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';

	export let stream: MediaStream | null = null;
	export let name = 'guest';
	export let muted = false;
	export let mirror = false;
	export let isLocal = false;
	export let isCamOff = false;
	export let isScreen = false;
	export let tag: string | null = null;

	$: initials = name
		.split(' ')
		.map((w) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

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
			<div class="avatar">{initials}</div>
			<span class="cam-off-name">{name}</span>
		</div>
	{/if}
	{#if !isCamOff}
		<span class="tile-label">
			{#if isScreen}
				{#if tag}<span class="tile-tag">{tag}</span>{/if}
			{:else}
				<span class="tile-name">{name}</span>
				{#if tag}<span class="tile-tag">{tag}</span>{/if}
			{/if}
		</span>
	{/if}
</div>

<style>
	.tile {
		position: relative;
		aspect-ratio: 16 / 10;
		background: var(--surface);
		border-radius: 12px;
		overflow: hidden;
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
		border-radius: 8px;
		background: #000;
	}

	.cam-off-cover {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		background: var(--surface);
	}

	.avatar {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--surface-3);
		color: var(--text);
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.cam-off-name {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.tile-label {
		position: absolute;
		left: 0.5rem;
		bottom: 0.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.5rem;
		background: rgba(10, 8, 7, 0.65);
		backdrop-filter: blur(8px);
		border-radius: 6px;
		font-size: 0.72rem;
	}

	.tile-name {
		color: var(--text);
		font-weight: 500;
	}

	.tile-tag {
		color: var(--accent);
		font-size: 0.65rem;
		font-weight: 600;
	}

	.tile.is-screen .tile-tag {
		color: var(--text);
		font-size: 0.72rem;
		font-weight: 500;
	}
</style>

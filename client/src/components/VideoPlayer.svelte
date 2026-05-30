<script lang="ts">
	import { onMount } from 'svelte';
	import { audioBlocked, audioUnlock } from '../lib/audio-unlock';

	export let mediaStream: MediaStream | null;
	export let muted = false;
	export let mirror = false;

	let videoElement: HTMLVideoElement | null = null;

	function tryPlay() {
		videoElement?.play().catch(() => {
			if (!muted) audioBlocked.set(true);
		});
	}

	$: if (videoElement && videoElement.srcObject !== mediaStream) {
		videoElement.srcObject = mediaStream;
		tryPlay();
	}

	// Retry when the user taps to unlock audio (inside the gesture).
	$: if ($audioUnlock >= 0 && videoElement) tryPlay();

	onMount(tryPlay);
</script>

<div>
	<video bind:this={videoElement} autoplay playsinline {muted} class:mirror />
</div>

<style>
	video {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	video.mirror {
		transform: scaleX(-1);
	}
</style>

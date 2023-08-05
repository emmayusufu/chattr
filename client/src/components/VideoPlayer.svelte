<!-- VideoPlayer.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	export let mediaStream: MediaStream | null;
	let videoElement: HTMLVideoElement | null = null;

	// To handle cleanup when the component is unmounted
	onMount(() => {
		// When the media stream is available, set it as the source for the video element
		if (videoElement && 'srcObject' in videoElement) {
			videoElement.srcObject = mediaStream;
		}
	});
</script>

<div>
	<video bind:this={videoElement} autoplay muted={false} />
</div>

<style>
	video {
		width: 100%;
		height: auto;
		object-fit: cover;
		border: 1px solid rgba(114, 114, 114, 0.544);
		border-radius: 6px;
		overflow: hidden;
	}
</style>

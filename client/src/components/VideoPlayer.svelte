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

	// To handle updates to the media stream prop
	// $: {
	// 	if (videoElement && 'srcObject' in videoElement) {
	// 		console.log('a new stream has been received');
	// 		videoElement.srcObject = mediaStream;
	// 	}
	// }
</script>

<div>
	<video bind:this={videoElement} autoplay muted={false} />
</div>

<style>
	/* Add your custom styles for the video component here */
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>

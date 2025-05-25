<script lang="ts">
	export let mediaStream: MediaStream | null;
	export let muted = false;
	export let mirror = false;

	let videoElement: HTMLVideoElement | null = null;

	$: if (videoElement) videoElement.srcObject = mediaStream;
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

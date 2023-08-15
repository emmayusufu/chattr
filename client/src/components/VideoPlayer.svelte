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
		height: auto;
		object-fit: cover;
		border: 1px solid rgba(114, 114, 114, 0.544);
		border-radius: 6px;
		overflow: hidden;
	}

	video.mirror {
		transform: scaleX(-1);
	}
</style>

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * Mobile browsers block autoplay of audio until a user gesture. When a remote
 * audio element's play() rejects, we flip `audioBlocked` so the UI can show a
 * "tap to enable audio" prompt; tapping bumps `audioUnlock`, which every
 * VideoPlayer watches to retry play() inside the gesture. As a backstop, the
 * next click/keypress anywhere also unlocks, so the prompt rarely needs a tap.
 */
export const audioBlocked = writable(false);
export const audioUnlock = writable(0);

export function requestAudioUnlock(): void {
	audioBlocked.set(false);
	audioUnlock.update((n) => n + 1);
}

if (browser) {
	let armed = false;
	audioBlocked.subscribe((blocked) => {
		if (!blocked || armed) return;
		armed = true;
		const unlock = () => {
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
			armed = false;
			requestAudioUnlock();
		};
		window.addEventListener('pointerdown', unlock);
		window.addEventListener('keydown', unlock);
	});
}

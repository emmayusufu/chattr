import { writable } from 'svelte/store';

/**
 * Mobile browsers block autoplay of audio until a user gesture. When a remote
 * audio element's play() rejects, we flip `audioBlocked` so the UI can show a
 * one-time "tap to enable audio" prompt; tapping bumps `audioUnlock`, which
 * every VideoPlayer watches to retry play() inside the gesture.
 */
export const audioBlocked = writable(false);
export const audioUnlock = writable(0);

export function requestAudioUnlock(): void {
	audioBlocked.set(false);
	audioUnlock.update((n) => n + 1);
}

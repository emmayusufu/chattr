import { browser } from '$app/environment';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

/**
 * Runs a raw mic track through RNNoise (WASM AudioWorklet) and exposes the
 * denoised track. Fails safe: any error returns the original track untouched,
 * so a broken worklet can never kill audio. Works in both browsers and the
 * Tauri WKWebView (AudioWorklet + WASM are supported there).
 */
export class Denoiser {
	private ctx: AudioContext | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private node: AudioWorkletNode | null = null;
	private dest: MediaStreamAudioDestinationNode | null = null;

	async process(track: MediaStreamTrack): Promise<MediaStreamTrack> {
		if (!browser) return track;
		this.cleanup();
		try {
			// Imported here, not at module top, so the worklet package's browser-only
			// globals (AudioWorkletNode) never evaluate during SSR.
			const { loadRnnoise, RnnoiseWorkletNode } = await import('@sapphi-red/web-noise-suppressor');
			this.ctx = new AudioContext();
			const wasmBinary = await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl });
			await this.ctx.audioWorklet.addModule(rnnoiseWorkletUrl);

			this.source = this.ctx.createMediaStreamSource(new MediaStream([track]));
			this.node = new RnnoiseWorkletNode(this.ctx, { wasmBinary, maxChannels: 1 });
			this.dest = this.ctx.createMediaStreamDestination();
			this.source.connect(this.node).connect(this.dest);

			const out = this.dest.stream.getAudioTracks()[0];
			return out ?? track;
		} catch (err) {
			console.warn('denoise unavailable, using raw audio:', err);
			this.cleanup();
			return track;
		}
	}

	cleanup(): void {
		try {
			this.source?.disconnect();
			this.node?.disconnect();
			this.dest?.disconnect();
		} catch {
			/* nodes may already be detached */
		}
		this.ctx?.close().catch(() => undefined);
		this.ctx = null;
		this.source = null;
		this.node = null;
		this.dest = null;
	}
}

import { writable, type Writable } from 'svelte/store';
import type { Socket } from 'socket.io-client';
import { createRecognition, type TranscriptSegment } from './transcription.js';

/**
 * start/stop is mirrored over the socket so every client transcribes its own
 * mic locally; the final segments merge into one shared transcript.
 */
export class TranscriptionController {
	readonly transcript: Writable<TranscriptSegment[]> = writable([]);
	readonly isTranscribing: Writable<boolean> = writable(false);

	private socket: Socket | null = null;
	private recognition: { start: () => void; stop: () => void } | null = null;

	constructor(private readonly roomId: string, private readonly name: string) {}

	attach(socket: Socket): void {
		this.socket = socket;

		socket.on('transcript-segment', (data: { segment: TranscriptSegment }) => {
			if (data?.segment?.speaker === this.name) return;
			if (data?.segment) this.transcript.update((t) => [...t, data.segment]);
		});
		socket.on('start-transcription', () => this.startRecognition());
		socket.on('stop-transcription', () => this.stopRecognition());
	}

	toggle(): void {
		if (!this.socket) return;
		if (this.recognition) {
			this.socket.emit('stop-transcription', { roomId: this.roomId });
			this.stopRecognition();
		} else {
			this.socket.emit('start-transcription', { roomId: this.roomId });
			this.startRecognition();
		}
	}

	stop(): void {
		this.stopRecognition();
	}

	private startRecognition(): void {
		if (this.recognition || !this.socket) return;
		const socket = this.socket;

		this.recognition = createRecognition(
			(text, isFinal) => {
				if (!isFinal) return;
				const segment: TranscriptSegment = { speaker: this.name, text, timestamp: Date.now() };
				this.transcript.update((t) => [...t, segment]);
				socket.emit('transcript-segment', { roomId: this.roomId, segment });
			},
			(error) => console.warn('speech recognition error:', error)
		);

		if (this.recognition) {
			this.recognition.start();
			this.isTranscribing.set(true);
		}
	}

	private stopRecognition(): void {
		this.recognition?.stop();
		this.recognition = null;
		this.isTranscribing.set(false);
	}
}

const PREFERRED_MIMES = [
	'video/webm;codecs=vp9,opus',
	'video/webm;codecs=vp8,opus',
	'video/webm;codecs=h264,opus',
	'video/webm'
];

function pickMime(): string {
	if (typeof MediaRecorder === 'undefined') return 'video/webm';
	for (const m of PREFERRED_MIMES) {
		if (MediaRecorder.isTypeSupported(m)) return m;
	}
	return 'video/webm';
}

function timestampedName(): string {
	const t = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
	return `chattr-${t}.webm`;
}

function downloadBlob(blob: Blob, name: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 1000);
}

export type RecorderStartOptions = {
	includeMic?: boolean;
	onEndedByUser?: () => void;
};

export class CallRecorder {
	private displayStream: MediaStream | null = null;
	private micStream: MediaStream | null = null;
	private audioCtx: AudioContext | null = null;
	private recorder: MediaRecorder | null = null;
	private chunks: Blob[] = [];

	get active(): boolean {
		return this.recorder !== null && this.recorder.state !== 'inactive';
	}

	async start({ includeMic = true, onEndedByUser }: RecorderStartOptions = {}): Promise<void> {
		if (this.active) return;

		const constraints = {
			video: { frameRate: 30 } as MediaTrackConstraints,
			audio: true,
			preferCurrentTab: true,
			selfBrowserSurface: 'include',
			surfaceSwitching: 'exclude'
		} as DisplayMediaStreamOptions;

		this.displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);

		let outputStream: MediaStream = this.displayStream;

		if (includeMic) {
			try {
				this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const ctx = new AudioContext();
				const dest = ctx.createMediaStreamDestination();
				if (this.displayStream.getAudioTracks().length > 0) {
					ctx.createMediaStreamSource(this.displayStream).connect(dest);
				}
				ctx.createMediaStreamSource(this.micStream).connect(dest);
				this.audioCtx = ctx;
				outputStream = new MediaStream([
					...this.displayStream.getVideoTracks(),
					...dest.stream.getAudioTracks()
				]);
			} catch (err) {
				console.warn('recorder: mic mix failed, continuing without mic', err);
			}
		}

		const mimeType = pickMime();
		this.recorder = new MediaRecorder(outputStream, { mimeType });
		this.chunks = [];

		this.recorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) this.chunks.push(e.data);
		};

		this.displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
			if (this.active) {
				this.stop()
					.then(() => onEndedByUser?.())
					.catch(() => onEndedByUser?.());
			}
		});

		this.recorder.start(1000);
	}

	async stop(filename?: string): Promise<Blob | null> {
		if (!this.recorder) return null;
		const r = this.recorder;
		const blob = await new Promise<Blob>((resolve) => {
			r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType }));
			if (r.state !== 'inactive') r.stop();
			else resolve(new Blob(this.chunks, { type: r.mimeType }));
		});
		this.cleanup();
		if (blob.size > 0) downloadBlob(blob, filename ?? timestampedName());
		return blob;
	}

	private cleanup(): void {
		this.displayStream?.getTracks().forEach((t) => t.stop());
		this.micStream?.getTracks().forEach((t) => t.stop());
		this.audioCtx?.close().catch(() => undefined);
		this.displayStream = null;
		this.micStream = null;
		this.audioCtx = null;
		this.recorder = null;
		this.chunks = [];
	}
}

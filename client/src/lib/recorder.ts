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

export type RecordVideoSource = {
	stream: MediaStream;
	isScreen?: boolean;
	label?: string;
};

export type RecorderStartOptions = {
	videoSources: RecordVideoSource[];
	audioStreams?: MediaStream[];
	includeMic?: boolean;
	width?: number;
	height?: number;
	fps?: number;
};

export class CallRecorder {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private rafId: number | null = null;
	private audioCtx: AudioContext | null = null;
	private destNode: MediaStreamAudioDestinationNode | null = null;
	private micStream: MediaStream | null = null;
	private recorder: MediaRecorder | null = null;
	private chunks: Blob[] = [];
	private sources: RecordVideoSource[] = [];
	private videoForStream = new WeakMap<MediaStream, HTMLVideoElement>();

	get active(): boolean {
		return this.recorder !== null && this.recorder.state !== 'inactive';
	}

	async start({
		videoSources,
		audioStreams = [],
		includeMic = true,
		width = 1280,
		height = 720,
		fps = 30
	}: RecorderStartOptions): Promise<void> {
		if (this.active) return;

		this.sources = videoSources;
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		const ctx = this.canvas.getContext('2d');
		if (!ctx) throw new Error('canvas-2d-unavailable');
		this.ctx = ctx;

		this.audioCtx = new AudioContext();
		this.destNode = this.audioCtx.createMediaStreamDestination();

		for (const s of audioStreams) {
			if (s.getAudioTracks().length === 0) continue;
			try {
				this.audioCtx.createMediaStreamSource(s).connect(this.destNode);
			} catch (err) {
				console.warn('recorder: could not mix audio stream', err);
			}
		}

		if (includeMic) {
			try {
				this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
				this.audioCtx.createMediaStreamSource(this.micStream).connect(this.destNode);
			} catch (err) {
				console.warn('recorder: mic capture failed', err);
			}
		}

		const drawFrame = () => {
			this.paint();
			this.rafId = requestAnimationFrame(drawFrame);
		};
		drawFrame();

		const videoTrack = this.canvas.captureStream(fps).getVideoTracks()[0];
		const combined = new MediaStream([videoTrack, ...this.destNode.stream.getAudioTracks()]);

		const mimeType = pickMime();
		this.recorder = new MediaRecorder(combined, { mimeType });
		this.chunks = [];
		this.recorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) this.chunks.push(e.data);
		};
		this.recorder.start(1000);
	}

	updateSources(videoSources: RecordVideoSource[]): void {
		this.sources = videoSources;
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

	private videoForStreamOf(stream: MediaStream): HTMLVideoElement {
		let v = this.videoForStream.get(stream);
		if (!v) {
			v = document.createElement('video');
			v.srcObject = stream;
			v.muted = true;
			v.playsInline = true;
			v.autoplay = true;
			v.play().catch(() => undefined);
			this.videoForStream.set(stream, v);
		}
		return v;
	}

	private paint(): void {
		const ctx = this.ctx;
		const canvas = this.canvas;
		if (!ctx || !canvas) return;

		const { width, height } = canvas;
		ctx.fillStyle = '#0a0807';
		ctx.fillRect(0, 0, width, height);

		const screens = this.sources.filter((s) => s.isScreen);
		const cameras = this.sources.filter((s) => !s.isScreen);

		const gap = 8;

		if (screens.length > 0) {
			const stripW = Math.max(220, Math.floor(width * 0.22));
			const screenAreaW = width - stripW - gap;
			const screenH = (height - gap * (screens.length - 1)) / screens.length;
			screens.forEach((s, i) => {
				const y = i * (screenH + gap);
				this.drawSource(s, 0, y, screenAreaW, screenH, 'contain');
			});

			if (cameras.length > 0) {
				const camH = Math.min(
					(height - gap * (cameras.length - 1)) / cameras.length,
					(stripW * 10) / 16
				);
				cameras.forEach((c, i) => {
					const y = i * (camH + gap);
					this.drawSource(c, screenAreaW + gap, y, stripW, camH, 'cover');
				});
			}
		} else if (cameras.length > 0) {
			const cols = Math.ceil(Math.sqrt(cameras.length));
			const rows = Math.ceil(cameras.length / cols);
			const w = Math.floor((width - gap * (cols - 1)) / cols);
			const h = Math.floor((height - gap * (rows - 1)) / rows);
			cameras.forEach((c, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				this.drawSource(c, col * (w + gap), row * (h + gap), w, h, 'cover');
			});
		}
	}

	private drawSource(
		src: RecordVideoSource,
		x: number,
		y: number,
		w: number,
		h: number,
		fit: 'cover' | 'contain'
	): void {
		const ctx = this.ctx!;
		ctx.save();
		ctx.fillStyle = '#050403';
		ctx.fillRect(x, y, w, h);

		const v = this.videoForStreamOf(src.stream);
		if (v.videoWidth > 0 && v.videoHeight > 0) {
			const vAR = v.videoWidth / v.videoHeight;
			const bAR = w / h;
			let dx = x;
			let dy = y;
			let dw = w;
			let dh = h;
			if (fit === 'contain') {
				if (vAR > bAR) {
					dh = w / vAR;
					dy = y + (h - dh) / 2;
				} else {
					dw = h * vAR;
					dx = x + (w - dw) / 2;
				}
				try {
					ctx.drawImage(v, dx, dy, dw, dh);
				} catch {
					/* video not ready */
				}
			} else {
				ctx.beginPath();
				ctx.rect(x, y, w, h);
				ctx.clip();
				if (vAR > bAR) {
					dw = h * vAR;
					dx = x - (dw - w) / 2;
				} else {
					dh = w / vAR;
					dy = y - (dh - h) / 2;
				}
				try {
					ctx.drawImage(v, dx, dy, dw, dh);
				} catch {
					/* video not ready */
				}
			}
		}

		if (src.label) {
			ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
			const padX = 10;
			const padY = 6;
			const metrics = ctx.measureText(src.label);
			const labelW = Math.min(metrics.width + padX * 2, w - 16);
			const labelH = 24;
			const lx = x + 8;
			const ly = y + h - labelH - 8;
			ctx.fillStyle = 'rgba(10, 8, 7, 0.75)';
			ctx.fillRect(lx, ly, labelW, labelH);
			ctx.fillStyle = '#f4ede4';
			ctx.fillText(src.label, lx + padX, ly + labelH - padY - 2);
		}
		ctx.restore();
	}

	private cleanup(): void {
		if (this.rafId !== null) cancelAnimationFrame(this.rafId);
		this.rafId = null;
		this.micStream?.getTracks().forEach((t) => t.stop());
		this.audioCtx?.close().catch(() => undefined);
		this.canvas = null;
		this.ctx = null;
		this.audioCtx = null;
		this.destNode = null;
		this.micStream = null;
		this.recorder = null;
		this.chunks = [];
		this.sources = [];
	}
}

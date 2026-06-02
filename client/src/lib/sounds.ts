import { browser } from '$app/environment';

let ctx: AudioContext | null = null;
let enabled = browser ? localStorage.getItem('chattr.sounds') !== 'off' : true;

export function soundsEnabled(): boolean {
	return enabled;
}

export function setSoundsEnabled(on: boolean): void {
	enabled = on;
	if (browser) localStorage.setItem('chattr.sounds', on ? 'on' : 'off');
}

function context(): AudioContext | null {
	if (!browser || !enabled) return null;
	if (!ctx) {
		try {
			ctx = new AudioContext();
		} catch {
			return null;
		}
	}
	// Started suspended until a user gesture; the join click is enough to resume.
	if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
	return ctx;
}

type Note = { freq: number; at: number; dur: number };

function chime(notes: Note[], peak = 0.08): void {
	const ac = context();
	if (!ac) return;
	const now = ac.currentTime;
	for (const n of notes) {
		const t = now + n.at;
		// Fundamental plus a quiet octave partial gives a soft, glassy timbre, and
		// the slow exponential tail keeps it gentle rather than a hard beep.
		for (const [mult, g] of [
			[1, peak],
			[2, peak * 0.22]
		] as const) {
			const osc = ac.createOscillator();
			const gain = ac.createGain();
			osc.type = 'sine';
			osc.frequency.value = n.freq * mult;
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.linearRampToValueAtTime(g, t + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
			osc.connect(gain).connect(ac.destination);
			osc.start(t);
			osc.stop(t + n.dur + 0.05);
		}
	}
}

// Someone is waiting to be let in (host only).
export const playWaiting = (): void =>
	chime([
		{ freq: 659.25, at: 0, dur: 0.5 },
		{ freq: 880, at: 0.16, dur: 0.6 }
	]);

export const playJoin = (): void =>
	chime([
		{ freq: 523.25, at: 0, dur: 0.45 },
		{ freq: 659.25, at: 0.1, dur: 0.45 },
		{ freq: 783.99, at: 0.2, dur: 0.5 }
	]);

export const playLeave = (): void =>
	chime([
		{ freq: 783.99, at: 0, dur: 0.45 },
		{ freq: 659.25, at: 0.1, dur: 0.45 },
		{ freq: 523.25, at: 0.2, dur: 0.5 }
	]);

export const playMessage = (): void => chime([{ freq: 880, at: 0, dur: 0.28 }], 0.05);

export const playHand = (): void =>
	chime(
		[
			{ freq: 880, at: 0, dur: 0.26 },
			{ freq: 1046.5, at: 0.12, dur: 0.3 }
		],
		0.06
	);

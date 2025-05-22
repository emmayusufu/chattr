export type TranscriptSegment = {
	speaker: string;
	text: string;
	timestamp: number;
};

type SpeechRecognitionEvent = Event & {
	results: SpeechRecognitionResultList;
	resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

const SpeechRecognition =
	typeof window !== 'undefined'
		? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
		: null;

export function isSupported(): boolean {
	return SpeechRecognition !== null;
}

export function createRecognition(
	onSegment: (text: string, isFinal: boolean) => void,
	onError?: (error: string) => void
): { start: () => void; stop: () => void } | null {
	if (!SpeechRecognition) return null;

	const recognition = new SpeechRecognition();
	recognition.continuous = true;
	recognition.interimResults = true;
	recognition.lang = 'en-US';

	let active = false;

	recognition.onresult = (e: SpeechRecognitionEvent) => {
		for (let i = e.resultIndex; i < e.results.length; i++) {
			const result = e.results[i];
			const text = result[0].transcript.trim();
			if (text) onSegment(text, result.isFinal);
		}
	};

	recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
		if (e.error === 'no-speech' || e.error === 'aborted') return;
		onError?.(e.error);
	};

	recognition.onend = () => {
		if (active) recognition.start();
	};

	return {
		start() {
			active = true;
			try {
				recognition.start();
			} catch {
				/* already started */
			}
		},
		stop() {
			active = false;
			try {
				recognition.stop();
			} catch {
				/* already stopped */
			}
		}
	};
}

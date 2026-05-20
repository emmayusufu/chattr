const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = (key: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

const STORAGE_KEY = 'chattr-gemini-key';

export function getStoredApiKey(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
	if (typeof localStorage === 'undefined') return;
	if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
	else localStorage.removeItem(STORAGE_KEY);
}

export function findScreenShareVideo(): HTMLVideoElement | null {
	const tiles = document.querySelectorAll<HTMLVideoElement>('.tile.is-screen video');
	for (const v of tiles) {
		if (v.videoWidth > 0 && v.videoHeight > 0) return v;
	}
	return null;
}

export async function captureFrame(video: HTMLVideoElement): Promise<string> {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas-context-unavailable');
	ctx.drawImage(video, 0, 0);
	const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
	if (!blob) throw new Error('canvas-to-blob-failed');
	return blobToBase64(blob);
}

async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const dataUrl = reader.result as string;
			const comma = dataUrl.indexOf(',');
			resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
		};
		reader.onerror = () => reject(new Error('filereader-failed'));
		reader.readAsDataURL(blob);
	});
}

export type AskParams = {
	apiKey: string;
	question: string;
	imageBase64?: string | null;
	mimeType?: string;
	context?: string;
};

async function postWithRetry(url: string, body: string, maxAttempts = 4): Promise<Response> {
	let lastRes: Response | null = null;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		});
		if (res.ok) return res;
		lastRes = res;
		if ((res.status === 503 || res.status === 429) && attempt < maxAttempts - 1) {
			const wait = 800 * 2 ** attempt + Math.random() * 400;
			await new Promise((r) => setTimeout(r, wait));
			continue;
		}
		return res;
	}
	return lastRes!;
}

export async function askGemini({
	apiKey,
	question,
	imageBase64,
	mimeType = 'image/jpeg',
	context
}: AskParams): Promise<string> {
	const prompt = context
		? `${context}\n\nQuestion: ${question}\n\nReply with a concise, actionable answer in 1-4 sentences. If you see an error message or stack trace in the image, quote the key line.`
		: `${question}\n\nReply with a concise, actionable answer in 1-4 sentences. If you see an error message or stack trace in the image, quote the key line.`;

	const parts: Array<Record<string, unknown>> = [{ text: prompt }];
	if (imageBase64) {
		parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
	}

	const res = await postWithRetry(
		GEMINI_URL(apiKey),
		JSON.stringify({
			contents: [{ role: 'user', parts }],
			generationConfig: { temperature: 0.4, maxOutputTokens: 600 }
		})
	);

	if (!res.ok) {
		const body = await res.text();
		if (res.status === 503) {
			throw new Error(
				'Gemini is overloaded right now. Try again in a moment, or switch to gemini-2.5-flash-lite.'
			);
		}
		throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
	}
	const data = await res.json();
	const text =
		data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
		'';
	if (!text) throw new Error('Gemini returned no text');
	return text.trim();
}

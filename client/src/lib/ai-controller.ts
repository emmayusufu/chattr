import { get, writable, type Writable } from 'svelte/store';
import {
	askGemini,
	captureFrame,
	findLargestVideo,
	getStoredApiKey,
	setStoredApiKey
} from './ai.js';
import type { ChatMessage } from './RoomClient.js';

export class AiController {
	readonly messages: Writable<ChatMessage[]> = writable([]);
	readonly pending: Writable<boolean> = writable(false);

	constructor(private readonly name: string) {}

	async ask(text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed) return;

		if (trimmed.startsWith('/ai-key')) {
			const key = trimmed.slice('/ai-key'.length).trim();
			setStoredApiKey(key);
			this.messages.update((list) => [
				...list,
				{ sender: 'AI', message: key ? 'Gemini key saved.' : 'Gemini key cleared.' }
			]);
			return;
		}

		const apiKey = getStoredApiKey();
		if (!apiKey) {
			this.messages.update((list) => [
				...list,
				{ sender: this.name, message: trimmed },
				{ sender: 'AI', message: 'No Gemini key. Send `/ai-key YOUR_KEY` to set one.' }
			]);
			return;
		}

		this.messages.update((list) => [...list, { sender: this.name, message: trimmed }]);
		this.pending.set(true);

		try {
			const context = get(this.messages)
				.slice(-8)
				.map((m) => `${m.sender}: ${m.message}`)
				.join('\n');

			let imageBase64: string | null = null;
			const video = findLargestVideo();
			if (video) {
				try {
					imageBase64 = await captureFrame(video);
				} catch {
					/* a frame grab failure shouldn't block the question */
				}
			}

			const answer = await askGemini({ apiKey, question: trimmed, imageBase64, context });
			this.messages.update((list) => [...list, { sender: 'AI', message: answer }]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.messages.update((list) => [...list, { sender: 'AI', message: `error: ${message}` }]);
		} finally {
			this.pending.set(false);
		}
	}
}

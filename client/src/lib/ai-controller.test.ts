import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('./ai.js', () => ({
	askGemini: vi.fn(),
	captureFrame: vi.fn(),
	findLargestVideo: vi.fn(() => null),
	getStoredApiKey: vi.fn(),
	setStoredApiKey: vi.fn()
}));

import { AiController } from './ai-controller';
import * as ai from './ai.js';

describe('AiController', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('saves a key via /ai-key without calling the model', async () => {
		const c = new AiController('Me');
		await c.ask('/ai-key SECRET');
		expect(ai.setStoredApiKey).toHaveBeenCalledWith('SECRET');
		expect(ai.askGemini).not.toHaveBeenCalled();
		expect(get(c.messages).at(-1)?.message).toMatch(/saved/i);
	});

	it('prompts for a key when none is stored', async () => {
		vi.mocked(ai.getStoredApiKey).mockReturnValue('');
		const c = new AiController('Me');
		await c.ask('what do you see');
		expect(ai.askGemini).not.toHaveBeenCalled();
		const msgs = get(c.messages);
		expect(msgs[0]).toEqual({ sender: 'Me', message: 'what do you see' });
		expect(msgs.at(-1)?.message).toMatch(/no gemini key/i);
	});

	it('asks the model and appends the answer, clearing pending', async () => {
		vi.mocked(ai.getStoredApiKey).mockReturnValue('key');
		vi.mocked(ai.askGemini).mockResolvedValue('the answer');
		const c = new AiController('Me');
		await c.ask('hi');
		expect(ai.askGemini).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: 'key', question: 'hi' })
		);
		expect(get(c.messages).at(-1)).toEqual({ sender: 'AI', message: 'the answer' });
		expect(get(c.pending)).toBe(false);
	});

	it('surfaces a model error as an AI message', async () => {
		vi.mocked(ai.getStoredApiKey).mockReturnValue('key');
		vi.mocked(ai.askGemini).mockRejectedValue(new Error('boom'));
		const c = new AiController('Me');
		await c.ask('hi');
		expect(get(c.messages).at(-1)?.message).toMatch(/error: boom/);
		expect(get(c.pending)).toBe(false);
	});
});

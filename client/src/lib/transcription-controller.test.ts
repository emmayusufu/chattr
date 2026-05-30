import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Socket } from 'socket.io-client';

vi.mock('./transcription.js', () => ({ createRecognition: vi.fn() }));

import { TranscriptionController } from './transcription-controller';
import { createRecognition } from './transcription.js';

type FakeSocket = {
	handlers: Record<string, (...args: never[]) => void>;
	on: ReturnType<typeof vi.fn>;
	emit: ReturnType<typeof vi.fn>;
};

function fakeSocket(): FakeSocket {
	const handlers: FakeSocket['handlers'] = {};
	return {
		handlers,
		on: vi.fn((event: string, handler: (...args: never[]) => void) => {
			handlers[event] = handler;
		}),
		emit: vi.fn()
	};
}

describe('TranscriptionController', () => {
	let socket: FakeSocket;
	let controller: TranscriptionController;
	const recognition = { start: vi.fn(), stop: vi.fn() };

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createRecognition).mockReturnValue(recognition);
		socket = fakeSocket();
		controller = new TranscriptionController('room', 'Me');
		controller.attach(socket as unknown as Socket);
	});

	it('toggles recognition on, broadcasting start', () => {
		controller.toggle();
		expect(socket.emit).toHaveBeenCalledWith('start-transcription', { roomId: 'room' });
		expect(recognition.start).toHaveBeenCalled();
		expect(get(controller.isTranscribing)).toBe(true);
	});

	it('toggles recognition off again, broadcasting stop', () => {
		controller.toggle();
		controller.toggle();
		expect(socket.emit).toHaveBeenCalledWith('stop-transcription', { roomId: 'room' });
		expect(recognition.stop).toHaveBeenCalled();
		expect(get(controller.isTranscribing)).toBe(false);
	});

	it('starts recognition when the host signals over the socket', () => {
		socket.handlers['start-transcription']();
		expect(recognition.start).toHaveBeenCalled();
	});

	it('merges remote segments but ignores its own', () => {
		socket.handlers['transcript-segment']({
			segment: { speaker: 'Bob', text: 'hi', timestamp: 1 }
		} as never);
		socket.handlers['transcript-segment']({
			segment: { speaker: 'Me', text: 'mine', timestamp: 2 }
		} as never);
		expect(get(controller.transcript)).toEqual([{ speaker: 'Bob', text: 'hi', timestamp: 1 }]);
	});

	it('broadcasts a final local result and skips interim ones', () => {
		let onResult: (text: string, isFinal: boolean) => void = () => undefined;
		vi.mocked(createRecognition).mockImplementation((cb) => {
			onResult = cb;
			return recognition;
		});
		controller.toggle();

		onResult('partial', false);
		expect(get(controller.transcript)).toEqual([]);

		onResult('final words', true);
		expect(get(controller.transcript).at(-1)).toMatchObject({ speaker: 'Me', text: 'final words' });
		expect(socket.emit).toHaveBeenCalledWith(
			'transcript-segment',
			expect.objectContaining({ roomId: 'room' })
		);
	});
});

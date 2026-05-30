import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Socket } from 'socket.io-client';
import { ChatController } from './chat-controller';

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

// No chatSecret, so the ratchet stays off and messages are plaintext, which
// keeps these tests independent of WebCrypto.
describe('ChatController (unencrypted)', () => {
	let socket: FakeSocket;
	let chat: ChatController;

	beforeEach(() => {
		socket = fakeSocket();
		chat = new ChatController('room', 'Me');
		chat.attach(socket as unknown as Socket);
	});

	it('emits a trimmed message and echoes it locally', async () => {
		await chat.send('  hello  ');
		expect(socket.emit).toHaveBeenCalledWith('send-chat-message', {
			roomId: 'room',
			message: 'hello',
			sender: 'Me'
		});
		expect(get(chat.messages)).toEqual([{ sender: 'Me', message: 'hello' }]);
	});

	it('ignores empty sends', async () => {
		await chat.send('   ');
		expect(socket.emit).not.toHaveBeenCalled();
		expect(get(chat.messages)).toEqual([]);
	});

	it('appends messages received from others', async () => {
		await socket.handlers['receive-chat-message']({ sender: 'Bob', message: 'hi' } as never);
		expect(get(chat.messages)).toEqual([{ sender: 'Bob', message: 'hi' }]);
	});

	it('drops the server echo of our own message', async () => {
		await socket.handlers['receive-chat-message']({ sender: 'Me', message: 'mine' } as never);
		expect(get(chat.messages)).toEqual([]);
	});

	it('replaces the log on history', async () => {
		await socket.handlers['receive-chat-history']([
			{ sender: 'A', message: '1' },
			{ sender: 'B', message: '2' }
		] as never);
		expect(get(chat.messages)).toHaveLength(2);
	});

	it('requestHistory asks the server', () => {
		chat.requestHistory();
		expect(socket.emit).toHaveBeenCalledWith('get-chat-history', 'room');
	});
});

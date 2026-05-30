import { writable, type Writable } from 'svelte/store';
import type { Socket } from 'socket.io-client';
import { ChatRatchet, deriveRootKey } from './chat-crypto.js';
import type { ChatMessage } from './RoomClient.js';

export class ChatController {
	readonly messages: Writable<ChatMessage[]> = writable([]);
	readonly encrypted: Writable<boolean> = writable(false);

	private socket: Socket | null = null;
	private ratchet: ChatRatchet | null = null;

	constructor(
		private readonly roomId: string,
		private readonly name: string,
		private readonly chatSecret?: string
	) {}

	async initCrypto(): Promise<void> {
		if (!this.chatSecret || !globalThis.crypto?.subtle) return;
		try {
			const rootKey = await deriveRootKey(this.chatSecret);
			this.ratchet = new ChatRatchet(rootKey, this.name);
			this.encrypted.set(true);
		} catch (err) {
			console.error('failed to derive chat key:', err);
		}
	}

	attach(socket: Socket): void {
		this.socket = socket;

		socket.on('receive-chat-message', async (msg: ChatMessage) => {
			if (msg.sender === this.name) return;
			let decoded = msg;
			if (this.ratchet) {
				try {
					decoded = { ...msg, message: await this.ratchet.decrypt(msg.message, msg.sender) };
				} catch {
					decoded = msg;
				}
			}
			this.messages.update((list) => [...list, decoded]);
		});

		socket.on('receive-chat-history', async (history: ChatMessage[]) => {
			if (!this.ratchet) {
				this.messages.set(history);
				return;
			}
			this.ratchet.resetReceivers();
			const decoded: ChatMessage[] = [];
			for (const msg of history) {
				try {
					decoded.push({ ...msg, message: await this.ratchet.decrypt(msg.message, msg.sender) });
				} catch {
					decoded.push(msg);
				}
			}
			this.messages.set(decoded);
		});
	}

	requestHistory(): void {
		this.socket?.emit('get-chat-history', this.roomId);
	}

	async send(text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed || !this.socket) return;

		let payload = trimmed;
		if (this.ratchet) {
			try {
				payload = await this.ratchet.encrypt(trimmed);
			} catch (err) {
				console.error('chat encrypt failed:', err);
				return;
			}
		}
		this.socket.emit('send-chat-message', {
			roomId: this.roomId,
			message: payload,
			sender: this.name
		});
		this.messages.update((list) => [...list, { sender: this.name, message: trimmed }]);
	}
}

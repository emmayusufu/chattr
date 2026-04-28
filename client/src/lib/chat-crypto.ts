const SALT = new TextEncoder().encode('chattr-room-salt-v1');
const ITERATIONS = 150_000;

const INFO = {
	sender: (id: string) => new TextEncoder().encode(`chattr|sender|${id}`),
	advance: new TextEncoder().encode('chattr|advance'),
	message: new TextEncoder().encode('chattr|message')
};

function bytesToBase64(bytes: Uint8Array): string {
	let s = '';
	for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
	return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
	const s = atob(b64);
	const bytes = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
	return bytes;
}

export async function deriveRootKey(secret: string): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
		baseKey,
		256
	);
	return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

async function importChainKey(bits: ArrayBuffer): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

async function initialChain(rootKey: CryptoKey, senderId: string): Promise<CryptoKey> {
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO.sender(senderId) },
		rootKey,
		256
	);
	return importChainKey(bits);
}

async function deriveMessage(chainKey: CryptoKey): Promise<{
	messageKey: CryptoKey;
	nextChain: CryptoKey;
}> {
	const messageKey = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO.message },
		chainKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	const nextBits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO.advance },
		chainKey,
		256
	);
	const nextChain = await importChainKey(nextBits);
	return { messageKey, nextChain };
}

export class ChatRatchet {
	private myChainKey: CryptoKey | null = null;
	private myCounter = 0;
	private myOutgoingBuffer = new Map<number, string>();
	private receiverChains = new Map<string, { chainKey: CryptoKey; expected: number }>();

	constructor(private rootKey: CryptoKey, private myUserId: string) {}

	async encrypt(plaintext: string): Promise<string> {
		if (!this.myChainKey) {
			this.myChainKey = await initialChain(this.rootKey, this.myUserId);
		}
		const { messageKey, nextChain } = await deriveMessage(this.myChainKey);
		this.myChainKey = nextChain;
		const counter = this.myCounter++;
		this.myOutgoingBuffer.set(counter, plaintext);

		const iv = crypto.getRandomValues(new Uint8Array(12));
		const cipher = new Uint8Array(
			await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv },
				messageKey,
				new TextEncoder().encode(plaintext)
			)
		);
		const out = new Uint8Array(4 + 12 + cipher.byteLength);
		new DataView(out.buffer).setUint32(0, counter, false);
		out.set(iv, 4);
		out.set(cipher, 16);
		return bytesToBase64(out);
	}

	async decrypt(payload: string, sender: string): Promise<string> {
		const blob = base64ToBytes(payload);
		if (blob.byteLength < 16) throw new Error('payload-too-short');
		const counter = new DataView(blob.buffer, blob.byteOffset, blob.byteLength).getUint32(0, false);
		const iv = blob.slice(4, 16);
		const cipher = blob.slice(16);

		if (sender === this.myUserId) {
			const buffered = this.myOutgoingBuffer.get(counter);
			if (buffered !== undefined) return buffered;
			throw new Error('own-message-not-buffered');
		}

		let state = this.receiverChains.get(sender);
		if (!state) {
			state = { chainKey: await initialChain(this.rootKey, sender), expected: 0 };
			this.receiverChains.set(sender, state);
		}
		if (counter < state.expected) {
			throw new Error('out-of-order-or-replay');
		}

		let chain = state.chainKey;
		let messageKey: CryptoKey | null = null;
		for (let i = state.expected; i <= counter; i++) {
			const stepped = await deriveMessage(chain);
			chain = stepped.nextChain;
			if (i === counter) messageKey = stepped.messageKey;
		}
		if (!messageKey) throw new Error('chain-error');

		state.chainKey = chain;
		state.expected = counter + 1;

		const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, messageKey, cipher);
		return new TextDecoder().decode(plain);
	}

	resetReceivers(): void {
		this.receiverChains.clear();
	}
}

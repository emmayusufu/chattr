const SALT = new TextEncoder().encode('chattr-scratchpad-salt-v1');
const ITERATIONS = 150_000;
const IV_BYTES = 12;

export async function deriveScratchpadKey(secret: string): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

export async function encryptUpdate(key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const cipher = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
	);
	const out = new Uint8Array(IV_BYTES + cipher.byteLength);
	out.set(iv, 0);
	out.set(cipher, IV_BYTES);
	return out;
}

export async function decryptUpdate(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
	if (blob.byteLength < IV_BYTES) throw new Error('payload-too-short');
	const iv = blob.slice(0, IV_BYTES);
	const cipher = blob.slice(IV_BYTES);
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
	return new Uint8Array(plain);
}

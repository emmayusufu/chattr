import type { Socket } from 'socket.io-client';

export function emitWithTimeout<T>(
	socket: Socket | null,
	event: string,
	payload: unknown,
	timeoutMs = 8000
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		if (!socket) {
			reject(new Error('socket not connected'));
			return;
		}
		const timer = setTimeout(() => {
			reject(new Error(`timeout waiting for ${event} response`));
		}, timeoutMs);
		socket.emit(event, payload, (response: T) => {
			clearTimeout(timer);
			resolve(response);
		});
	});
}

export async function withRetry<T>(
	op: () => Promise<T>,
	{ attempts = 3, baseDelayMs = 400 }: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await op();
		} catch (err) {
			lastErr = err;
			if (i < attempts - 1) {
				await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
			}
		}
	}
	throw lastErr;
}

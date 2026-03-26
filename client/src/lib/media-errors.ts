export function describeMediaError(err: unknown): string {
	const e = err as { name?: string; message?: string };
	if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
		return 'Camera and microphone access was blocked. Grant permission in your browser, then retry.';
	}
	if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
		return 'No camera or microphone found. Connect a device and retry.';
	}
	if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
		return 'Camera or microphone is in use by another app. Close it and retry.';
	}
	return `Could not access media: ${e?.message ?? 'unknown error'}`;
}

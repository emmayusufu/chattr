import { describe, it, expect } from 'vitest';
import { describeMediaError } from './media-errors';

describe('describeMediaError', () => {
	it('explains permission errors', () => {
		expect(describeMediaError({ name: 'NotAllowedError' })).toMatch(/blocked/i);
		expect(describeMediaError({ name: 'PermissionDeniedError' })).toMatch(/blocked/i);
	});

	it('explains missing devices', () => {
		expect(describeMediaError({ name: 'NotFoundError' })).toMatch(/no camera or microphone/i);
		expect(describeMediaError({ name: 'DevicesNotFoundError' })).toMatch(
			/no camera or microphone/i
		);
	});

	it('explains busy devices', () => {
		expect(describeMediaError({ name: 'NotReadableError' })).toMatch(/in use/i);
		expect(describeMediaError({ name: 'TrackStartError' })).toMatch(/in use/i);
	});

	it('falls back to a generic message with the underlying error message', () => {
		expect(describeMediaError({ message: 'something weird' })).toMatch(/something weird/);
		expect(describeMediaError({})).toMatch(/unknown error/i);
	});
});

import { test, expect } from '@playwright/test';
import { freshRoomId, joinFromLobby, expectInRoom } from './_helpers';

test('first joiner becomes host and lands in the room', async ({ page }) => {
	const roomId = freshRoomId('first');

	await joinFromLobby(page, roomId, 'Alice');
	await expectInRoom(page);

	await page.getByRole('button', { name: /^people/i }).click();
	await expect(page.getByText(/in the room/i)).toBeVisible();
	await expect(page.getByText(/you.+host/i)).toBeVisible();
});

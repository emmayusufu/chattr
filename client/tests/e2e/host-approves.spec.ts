import { test, expect } from '@playwright/test';
import { freshRoomId, joinFromLobby, expectInRoom, expectInWaitingRoom, newPage } from './_helpers';

test('host can admit a pending guest from the People panel', async ({ browser }) => {
	const roomId = freshRoomId('admit');

	const host = await newPage(browser);
	await joinFromLobby(host.page, roomId, 'Alice');
	await expectInRoom(host.page);

	const guest = await newPage(browser);
	await joinFromLobby(guest.page, roomId, 'Bob');
	await expectInWaitingRoom(guest.page);

	await host.page.getByRole('button', { name: /^people/i }).click();
	await expect(host.page.getByText('Bob')).toBeVisible();
	await host.page.getByRole('button', { name: /^allow$/i }).click();

	await expectInRoom(guest.page);

	await host.ctx.close();
	await guest.ctx.close();
});

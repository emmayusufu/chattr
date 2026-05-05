import { test } from '@playwright/test';
import { freshRoomId, joinFromLobby, expectInRoom, expectInWaitingRoom, newPage } from './_helpers';

test('second joiner is held in the waiting room until the host approves', async ({ browser }) => {
	const roomId = freshRoomId('wait');

	const host = await newPage(browser);
	await joinFromLobby(host.page, roomId, 'Alice');
	await expectInRoom(host.page);

	const guest = await newPage(browser);
	await joinFromLobby(guest.page, roomId, 'Bob');
	await expectInWaitingRoom(guest.page);

	await host.ctx.close();
	await guest.ctx.close();
});

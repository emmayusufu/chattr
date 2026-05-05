import { test, expect } from '@playwright/test';
import { freshRoomId } from './_helpers';

test('guest visiting a room URL lands in the lobby with a name input', async ({ page }) => {
	const roomId = freshRoomId('lobby');
	await page.goto(`/${roomId}`);

	await expect(page.getByLabel(/your name/i)).toBeVisible();
	await expect(page.getByRole('button', { name: /join now/i })).toBeDisabled();
	await expect(page.getByText(roomId)).toBeVisible();

	await page.getByLabel(/your name/i).fill('Alice');
	await expect(page.getByRole('button', { name: /join now/i })).toBeEnabled();
});

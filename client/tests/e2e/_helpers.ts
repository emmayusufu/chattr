import type { Page, BrowserContext, Browser } from '@playwright/test';
import { expect } from '@playwright/test';

export function freshRoomId(prefix: string): string {
	return `e2e-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function joinFromLobby(page: Page, roomId: string, name: string) {
	await page.goto(`/${roomId}`);
	const nameField = page.getByLabel(/your name/i);
	await expect(nameField).toBeVisible();
	await nameField.fill(name);
	await page.getByRole('button', { name: /join now/i }).click();
}

export async function expectInRoom(page: Page) {
	await expect(page.getByRole('button', { name: /leave/i })).toBeVisible({
		timeout: 20_000
	});
}

export async function expectInWaitingRoom(page: Page) {
	await expect(page.getByText(/waiting for the host/i)).toBeVisible({
		timeout: 20_000
	});
}

export async function newPage(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	return { ctx, page };
}

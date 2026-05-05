import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	timeout: 45_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:3030',
		trace: 'retain-on-failure',
		launchOptions: {
			args: [
				'--use-fake-ui-for-media-stream',
				'--use-fake-device-for-media-stream',
				'--autoplay-policy=no-user-gesture-required'
			]
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'npm run dev',
			cwd: '../server',
			port: 3000,
			reuseExistingServer: true,
			timeout: 60_000,
			env: {
				MEDIASOUP_ANNOUNCED_IP: '127.0.0.1',
				CLIENT_ORIGIN: 'http://localhost:3030',
				LOG_LEVEL: 'warn'
			}
		},
		{
			command: 'npm run dev',
			port: 3030,
			reuseExistingServer: true,
			timeout: 60_000
		}
	]
});

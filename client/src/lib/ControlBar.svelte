<script lang="ts">
	import { browser } from '$app/environment';

	export let isMuted: boolean;
	export let isCamOff: boolean;
	export let isSharing: boolean;
	export let isLowData = false;
	export let chatOpen = false;
	export let activeTab: string = 'chat';
	export let onToggleMute: () => void;
	export let onToggleCam: () => void;
	export let onToggleScreen: () => void;
	export let onToggleLowData: () => void = () => {};
	export let isHandRaised = false;
	export let onToggleHand: () => void;
	export let onOpenTab: (tab: string) => void;
	export let onLeave: () => void;

	const canShareScreen = browser && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
</script>

<div class="bar">
	<div class="center-group">
		<button
			class="ctl"
			class:ctl-off={isMuted}
			on:click={onToggleMute}
			title={isMuted ? 'Unmute' : 'Mute'}
			aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
		>
			{#if isMuted}
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="2" y1="2" x2="22" y2="22" /><path
						d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"
					/><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path
						d="M9 9v3a3 3 0 0 0 5.12 2.12"
					/><line x1="12" y1="19" x2="12" y2="22" /></svg
				>
			{:else}
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path
						d="M19 10v2a7 7 0 0 1-14 0v-2"
					/><line x1="12" y1="19" x2="12" y2="22" /></svg
				>
			{/if}
		</button>

		{#if !isLowData}
			<button
				class="ctl"
				class:ctl-off={isCamOff}
				on:click={onToggleCam}
				title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
				aria-label={isCamOff ? 'Turn camera on' : 'Turn camera off'}
			>
				{#if isCamOff}
					<svg
						viewBox="0 0 24 24"
						width="20"
						height="20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path
							d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"
						/><line x1="1" y1="1" x2="23" y2="23" /></svg
					>
				{:else}
					<svg
						viewBox="0 0 24 24"
						width="20"
						height="20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><polygon points="23 7 16 12 23 17 23 7" /><rect
							x="1"
							y="5"
							width="15"
							height="14"
							rx="2"
							ry="2"
						/></svg
					>
				{/if}
			</button>
		{/if}

		{#if canShareScreen && !isLowData}
			<button
				class="ctl"
				class:ctl-on={isSharing}
				on:click={onToggleScreen}
				title={isSharing ? 'Stop sharing' : 'Share screen'}
				aria-label={isSharing ? 'Stop sharing screen' : 'Share screen'}
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
						x1="8"
						y1="21"
						x2="16"
						y2="21"
					/><line x1="12" y1="17" x2="12" y2="21" /></svg
				>
			</button>
		{/if}

		<button
			class="ctl"
			class:ctl-on={isLowData}
			on:click={onToggleLowData}
			title={isLowData ? 'Low data on (audio only)' : 'Low data mode (audio only)'}
			aria-label={isLowData ? 'Turn off low data mode' : 'Turn on low data mode (audio only)'}
			aria-pressed={isLowData}
		>
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path
					d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.52-4.48 10-10 10Z"
				/><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg
			>
		</button>

		<button
			class="ctl"
			class:ctl-on={isHandRaised}
			on:click={onToggleHand}
			title={isHandRaised ? 'Lower hand' : 'Raise hand'}
			aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
			aria-pressed={isHandRaised}
		>
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" /><path
					d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"
				/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" /><path
					d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
				/></svg
			>
		</button>

		<button
			class="ctl"
			class:ctl-on={chatOpen && activeTab === 'chat'}
			on:click={() => onOpenTab('chat')}
			title="Chat"
			aria-label="Chat"
		>
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
			>
		</button>

		<button class="ctl ctl-end" on:click={onLeave} title="Leave call" aria-label="Leave call">
			<svg
				viewBox="0 0 24 24"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path
					d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"
				/><line x1="23" y1="1" x2="1" y2="23" /></svg
			>
		</button>
	</div>
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		padding: 0.6rem 1rem;
		padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
		background: transparent;
		flex: 0 0 auto;
	}

	.center-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 auto;
	}

	.ctl {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(20, 16, 12, 0.7);
		backdrop-filter: blur(12px);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 14px;
		transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
		cursor: pointer;
	}

	.ctl:hover {
		background: var(--surface-3);
		border-color: var(--border-strong);
	}

	.ctl:active {
		transform: scale(0.94);
	}

	.ctl-off {
		background: var(--danger);
		color: var(--bg);
		border-color: var(--danger);
		backdrop-filter: none;
	}

	.ctl-off:hover {
		background: var(--danger);
		border-color: var(--danger);
		opacity: 0.9;
	}

	.ctl-on {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
		backdrop-filter: none;
	}

	.ctl-on:hover {
		background: var(--accent);
		border-color: var(--accent);
		opacity: 0.9;
	}

	.ctl-end {
		background: var(--danger);
		color: var(--bg);
		border-color: var(--danger);
		width: 52px;
		border-radius: 14px;
		backdrop-filter: none;
	}

	.ctl-end:hover {
		background: var(--danger);
		border-color: var(--danger);
		opacity: 0.9;
	}

	@media (max-width: 640px) {
		.bar {
			padding: 0.5rem;
			padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
		}

		.ctl {
			width: 44px;
			height: 44px;
		}

		.ctl-end {
			width: 52px;
		}
	}
</style>

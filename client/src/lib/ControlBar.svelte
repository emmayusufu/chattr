<script lang="ts">
	export let isMuted: boolean;
	export let isCamOff: boolean;
	export let isSharing: boolean;
	export let chatOpen = false;
	export let activeTab: string = 'chat';
	export let pendingCount = 0;
	export let onToggleMute: () => void;
	export let onToggleCam: () => void;
	export let onToggleScreen: () => void;
	export let onOpenTab: (tab: string) => void;
	export let onLeave: () => void;
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
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" /><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
			{/if}
		</button>

		<button
			class="ctl"
			class:ctl-off={isCamOff}
			on:click={onToggleCam}
			title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
			aria-label={isCamOff ? 'Turn camera on' : 'Turn camera off'}
		>
			{#if isCamOff}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
			{/if}
		</button>

		<button
			class="ctl"
			class:ctl-on={isSharing}
			on:click={onToggleScreen}
			title={isSharing ? 'Stop sharing' : 'Share screen'}
			aria-label={isSharing ? 'Stop sharing screen' : 'Share screen'}
		>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
		</button>

		<button class="ctl ctl-end" on:click={onLeave} title="Leave call" aria-label="Leave call">
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
		</button>
	</div>

	<div class="right-group">
		<button
			class="side-btn"
			class:active={chatOpen && activeTab === 'chat'}
			on:click={() => onOpenTab('chat')}
			title="Chat"
			aria-label="Chat"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
		</button>
		<button
			class="side-btn"
			class:active={chatOpen && activeTab === 'people'}
			on:click={() => onOpenTab('people')}
			title="People"
			aria-label="People"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
			{#if pendingCount > 0}
				<span class="badge">{pendingCount}</span>
			{/if}
		</button>
		<button
			class="side-btn"
			class:active={chatOpen && activeTab === 'ai'}
			on:click={() => onOpenTab('ai')}
			title="AI"
			aria-label="AI"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" /><path d="M20 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" /></svg>
		</button>
		<button
			class="side-btn"
			class:active={chatOpen && activeTab === 'minutes'}
			on:click={() => onOpenTab('minutes')}
			title="Minutes"
			aria-label="Minutes"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
		</button>
	</div>
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		padding: 0.6rem 1rem;
		background: transparent;
		flex: 0 0 auto;
	}

	.center-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 auto;
	}

	.right-group {
		position: absolute;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
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

	.side-btn {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(20, 16, 12, 0.5);
		backdrop-filter: blur(8px);
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.side-btn:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.side-btn.active {
		background: var(--surface-2);
		color: var(--text);
		border-color: var(--border-strong);
	}

	.badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.6rem;
		font-weight: 700;
		background: var(--accent);
		color: var(--bg);
		border-radius: 999px;
	}

	@media (max-width: 640px) {
		.bar {
			padding: 0.5rem;
		}

		.ctl {
			width: 40px;
			height: 40px;
		}

		.ctl-end {
			width: 48px;
		}

		.side-btn {
			width: 36px;
			height: 36px;
		}

		.right-group {
			right: 0.5rem;
		}
	}
</style>

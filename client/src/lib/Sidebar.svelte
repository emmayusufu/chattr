<script lang="ts">
	import Chat from './Chat.svelte';
	import People from './People.svelte';
	import AiChat from './AiChat.svelte';
	import type { Participant, PendingJoiner, ChatMessage } from './RoomClient';

	export let messages: ChatMessage[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;
	export let encrypted = false;

	export let aiMessages: ChatMessage[] = [];
	export let aiPending = false;
	export let onSendAi: ((text: string) => void) | null = null;

	export let participants: Record<string, Participant>;
	export let pendingJoiners: PendingJoiner[];
	export let isHost: boolean;
	export let onApprove: (userId: string) => void;
	export let onDeny: (userId: string) => void;
	export let onApproveAll: () => void;
	export let onCreateInvite: () => void;

	export let open = true;
	export let onClose: (() => void) | null = null;

	let tab: 'chat' | 'people' | 'ai' = 'chat';

	$: pendingCount = pendingJoiners.length;
	$: peopleCount = Object.keys(participants).length + 1;
</script>

<aside class="sidebar" class:is-open={open}>
	<header class="tabs">
		<nav>
			<button class:active={tab === 'chat'} on:click={() => (tab = 'chat')}>
				Chat
				<span class="tab-count">{messages.length}</span>
			</button>
			<button class:active={tab === 'people'} on:click={() => (tab = 'people')}>
				People
				<span class="tab-count" class:has-alert={pendingCount > 0}>
					{peopleCount}{pendingCount > 0 ? ` · ${pendingCount}` : ''}
				</span>
			</button>
			<button class:active={tab === 'ai'} on:click={() => (tab = 'ai')}>
				AI
			</button>
		</nav>
		{#if onClose}
			<button class="close-btn" on:click={onClose} aria-label="Close panel">
				<svg
					viewBox="0 0 24 24"
					width="16"
					height="16"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
				>
			</button>
		{/if}
	</header>

	{#if tab === 'chat'}
		<Chat bind:chatMessage {messages} {senderName} {onSend} {encrypted} />
	{:else if tab === 'ai'}
		<AiChat {aiMessages} {aiPending} {senderName} onSendAi={onSendAi ?? (() => {})} />
	{:else}
		<People
			{senderName}
			{participants}
			{pendingJoiners}
			{isHost}
			{onApprove}
			{onDeny}
			{onApproveAll}
			{onCreateInvite}
		/>
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		min-height: 0;
		overflow: hidden;
	}

	.tabs {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--border);
		gap: 0.5rem;
	}

	nav {
		display: flex;
		gap: 0.25rem;
		flex: 1;
	}

	nav button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.45rem 0.6rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	nav button:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	nav button.active {
		background: var(--surface-2);
		color: var(--text);
	}

	.tab-count {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-faint);
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		background: rgba(244, 237, 228, 0.05);
	}

	nav button.active .tab-count {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.tab-count.has-alert {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.close-btn {
		display: none;
		background: transparent;
		border: none;
		color: var(--text-muted);
		padding: 0.4rem;
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text);
	}

	@media (max-width: 900px) {
		.sidebar {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(360px, 90vw);
			z-index: 20;
			border-radius: 0;
			border-left: 1px solid var(--border-strong);
			transform: translateX(100%);
			transition: transform 0.25s ease;
		}

		.sidebar.is-open {
			transform: translateX(0);
		}

		.close-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>

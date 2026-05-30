<script lang="ts">
	import Chat from './Chat.svelte';
	import People from './People.svelte';
	import AiChat from './AiChat.svelte';
	import Minutes from './Minutes.svelte';
	import type { Participant, PendingJoiner, ChatMessage } from './RoomClient';
	import type { TranscriptSegment } from './transcription';

	export let messages: ChatMessage[];
	export let chatMessage: string;
	export let senderName: string;
	export let onSend: () => void;

	export let aiMessages: ChatMessage[] = [];
	export let aiPending = false;
	export let onSendAi: ((text: string) => void) | null = null;

	export let transcript: TranscriptSegment[] = [];
	export let isTranscribing = false;
	export let isHost = false;
	export let onToggleTranscription: () => void = () => {};

	export let participants: Record<string, Participant>;
	export let pendingJoiners: PendingJoiner[];
	export let onApprove: (userId: string) => void;
	export let onDeny: (userId: string) => void;
	export let onApproveAll: () => void;
	export let onCreateInvite: () => void;

	export let onClose: (() => void) | null = null;
	export let tab: string = 'chat';
</script>

<aside class="sidebar">
	<header class="panel-header">
		<span class="panel-title">
			{tab === 'chat' ? 'Chat' : tab === 'ai' ? 'AI' : tab === 'people' ? 'People' : 'Minutes'}
			{#if tab === 'minutes' && isTranscribing}
				<span class="live-dot" />
			{/if}
		</span>
		{#if onClose}
			<button class="close-btn" on:click={onClose} aria-label="Close panel">
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
				>
			</button>
		{/if}
	</header>

	{#if tab === 'chat'}
		<Chat bind:chatMessage {messages} {senderName} {onSend} />
	{:else if tab === 'ai'}
		<AiChat {aiMessages} {aiPending} {senderName} onSendAi={onSendAi ?? (() => {})} />
	{:else if tab === 'people'}
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
	{:else}
		<Minutes {transcript} {isTranscribing} {isHost} onToggle={onToggleTranscription} />
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: rgba(20, 16, 12, 0.85);
		backdrop-filter: blur(24px);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 16px 48px -12px rgba(0, 0, 0, 0.6);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.5rem 0.55rem 0.75rem;
	}

	.panel-title {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
	}

	.close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		color: var(--text-faint);
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		flex: 0 0 auto;
	}

	.close-btn:hover {
		background: rgba(244, 237, 228, 0.08);
		color: var(--text);
	}

	.live-dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--danger);
		box-shadow: 0 0 6px rgba(209, 100, 100, 0.5);
		animation: -global-pulse 1.4s infinite;
	}
</style>

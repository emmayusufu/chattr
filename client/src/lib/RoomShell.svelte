<script lang="ts">
	import RoomTopBar from './RoomTopBar.svelte';
	import Tile from './Tile.svelte';
	import Sidebar from './Sidebar.svelte';
	import ControlBar from './ControlBar.svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';
	import type { RoomClient } from './RoomClient';

	export let room: RoomClient;
	export let roomId: string;
	export let senderName: string;
	export let onLeave: () => void;

	const {
		participants,
		messages,
		localStream,
		localScreenStream,
		reconnecting,
		reconnectFailed,
		isMuted,
		isCamOff,
		isSharing,
		isHost,
		pendingJoiners,
		chatEncrypted
	} = room;

	let chatMessage = '';
	let chatOpen = false;

	$: hasScreenShare =
		$localScreenStream !== null ||
		Object.values($participants).some((p) => p.screenStream !== null);

	let inviteToast = '';
	let inviteToastTimer: ReturnType<typeof setTimeout> | null = null;

	function showInviteToast(text: string) {
		inviteToast = text;
		if (inviteToastTimer) clearTimeout(inviteToastTimer);
		inviteToastTimer = setTimeout(() => (inviteToast = ''), 4000);
	}

	async function generateInvite() {
		const token = await room.createInvite();
		if (!token) {
			showInviteToast('Could not create invite. Try again.');
			return;
		}
		const params = new URLSearchParams();
		const hash = window.location.hash.replace(/^#/, '');
		const existing = hash.includes('=') ? new URLSearchParams(hash).get('k') : hash || null;
		if (existing) params.set('k', existing);
		params.set('i', token);
		const url = `${window.location.origin}/${roomId}#${params.toString()}`;
		try {
			await navigator.clipboard.writeText(url);
			showInviteToast('Invite link copied to clipboard');
		} catch {
			showInviteToast(url);
		}
	}

	function sendMessage() {
		room.sendMessage(chatMessage);
		chatMessage = '';
	}
</script>

<div class="room-shell">
	<RoomTopBar {roomId} {senderName} onToggleChat={() => (chatOpen = !chatOpen)} />

	<main class="room-main">
		<section class="stage" class:split={hasScreenShare}>
			{#if hasScreenShare}
				<div class="screens">
					{#if $localScreenStream}
						<Tile
							stream={$localScreenStream}
							name={senderName}
							muted={true}
							isLocal={true}
							isScreen={true}
							tag="your screen"
						/>
					{/if}
					{#each Object.entries($participants) as [pid, p] (pid)}
						{#if p.screenStream}
							<Tile
								stream={p.screenStream}
								name={p.name}
								isScreen={true}
								tag={`${p.name}'s screen`}
							/>
						{/if}
					{/each}
				</div>
				<div class="thumbnails">
					{#if $localStream}
						<Tile
							stream={$localStream}
							name={senderName}
							muted={true}
							mirror={true}
							isLocal={true}
							isCamOff={$isCamOff}
							tag="you"
						/>
					{/if}
					{#each Object.entries($participants) as [pid, p] (pid)}
						<Tile stream={p.videoStream} name={p.name} isCamOff={!p.videoStream} />
					{/each}
				</div>
			{:else}
				{#if $localStream}
					<Tile
						stream={$localStream}
						name={senderName}
						muted={true}
						mirror={true}
						isLocal={true}
						isCamOff={$isCamOff}
						tag="you"
					/>
				{/if}
				{#each Object.entries($participants) as [pid, p] (pid)}
					<Tile stream={p.videoStream} name={p.name} isCamOff={!p.videoStream} />
				{/each}
			{/if}
		</section>

		<Sidebar
			bind:chatMessage
			messages={$messages}
			{senderName}
			onSend={sendMessage}
			encrypted={$chatEncrypted}
			participants={$participants}
			pendingJoiners={$pendingJoiners}
			isHost={$isHost}
			onApprove={(uid) => room.approveJoiner(uid)}
			onDeny={(uid) => room.denyJoiner(uid)}
			onApproveAll={() => room.approveAll()}
			onCreateInvite={generateInvite}
			open={chatOpen}
			onClose={() => (chatOpen = false)}
		/>
	</main>

	<div class="audio-only">
		{#each Object.entries($participants) as [pid, p] (pid)}
			{#if p.audioStream}
				<VideoPlayer mediaStream={p.audioStream} />
			{/if}
		{/each}
	</div>

	<ControlBar
		isMuted={$isMuted}
		isCamOff={$isCamOff}
		isSharing={$isSharing}
		onToggleMute={() => room.toggleMute()}
		onToggleCam={() => room.toggleCam()}
		onToggleScreen={() => room.toggleScreen()}
		{onLeave}
	/>

	{#if inviteToast}
		<div class="invite-toast" role="status">{inviteToast}</div>
	{/if}

	{#if $reconnectFailed}
		<div class="reconnect-banner reconnect-failed" role="alert">
			<span>Connection lost. Please refresh.</span>
			<button class="banner-action" on:click={() => location.reload()}>Refresh</button>
		</div>
	{:else if $reconnecting}
		<div class="reconnect-banner" role="status" aria-live="polite">
			<span class="reconnect-dot" />
			<span>Reconnecting…</span>
		</div>
	{/if}
</div>

<style>
	.room-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem 5rem;
		gap: 1rem;
	}

	.room-main {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 1rem;
		min-height: 0;
	}

	.stage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.75rem;
		align-content: start;
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow-y: auto;
		min-height: 0;
	}

	.stage.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px;
		grid-template-rows: minmax(0, 1fr);
		gap: 0.75rem;
		align-content: stretch;
		overflow: hidden;
	}

	.stage.split .screens {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		min-height: 0;
	}

	.stage.split .screens :global(.tile) {
		flex: 1 1 0;
		min-height: 0;
		max-height: none;
		grid-column: auto;
		aspect-ratio: auto;
	}

	.stage.split .thumbnails {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.stage.split .thumbnails :global(.tile) {
		flex: 0 0 auto;
		aspect-ratio: 16 / 10;
		max-height: none;
	}

	@media (max-width: 760px) {
		.stage.split {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}
		.stage.split .thumbnails {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
			max-height: 130px;
		}
		.stage.split .thumbnails :global(.tile) {
			flex: 0 0 200px;
		}
	}

	.audio-only {
		display: none;
	}

	.invite-toast {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.55rem 1rem;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 999px;
		font-size: 0.85rem;
		color: var(--text);
		box-shadow: 0 8px 24px -8px var(--accent-glow);
		z-index: 35;
		animation: -global-fade-up 0.2s ease;
	}

	.reconnect-banner {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--accent);
		box-shadow: 0 8px 24px -8px var(--accent-glow);
		z-index: 30;
	}

	.reconnect-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent-glow);
		animation: -global-pulse 1.2s infinite;
	}

	.reconnect-failed {
		border-color: var(--danger);
		color: var(--danger);
		box-shadow: 0 8px 24px -8px rgba(209, 100, 100, 0.45);
	}

	.banner-action {
		margin-left: 0.5rem;
		padding: 0.25rem 0.6rem;
		background: var(--danger);
		color: var(--bg);
		border: 1px solid var(--danger);
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.banner-action:hover {
		opacity: 0.9;
	}

	@media (max-width: 900px) {
		.room-main {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.room-shell {
			padding: 0.75rem 0.75rem 5rem;
			gap: 0.75rem;
		}

		.stage {
			grid-template-columns: 1fr;
			padding: 0.5rem;
			gap: 0.5rem;
		}
	}
</style>

<script lang="ts">
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
		chatEncrypted,
		aiMessages,
		aiPending,
		transcript,
		isTranscribing
	} = room;

	let chatMessage = '';
	let chatOpen = false;
	let sidebarTab = 'chat';

	function openTab(tab: string) {
		if (chatOpen && sidebarTab === tab) {
			chatOpen = false;
		} else {
			sidebarTab = tab;
			chatOpen = true;
		}
	}

	$: hasScreenShare =
		$localScreenStream !== null ||
		Object.values($participants).some((p) => p.screenStream !== null);

	const MAX_VISIBLE_THUMBS = 5;

	type ThumbEntry = { id: string; stream: MediaStream | null; name: string; isLocal: boolean; isCamOff: boolean; mirror: boolean; tag: string | null };

	$: allThumbs = (() => {
		const list: ThumbEntry[] = [];
		if ($localStream) {
			list.push({ id: '_self', stream: $localStream, name: senderName, isLocal: true, isCamOff: $isCamOff, mirror: true, tag: 'you' });
		}
		for (const [pid, p] of Object.entries($participants)) {
			list.push({ id: pid, stream: p.videoStream, name: p.name, isLocal: false, isCamOff: !p.videoStream, mirror: false, tag: null });
		}
		return list;
	})();

	$: visibleThumbs = allThumbs.slice(0, MAX_VISIBLE_THUMBS);
	$: overflowCount = Math.max(0, allThumbs.length - MAX_VISIBLE_THUMBS);

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
	<main class="room-main" class:sidebar-open={chatOpen}>
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
				<div class="thumbs" class:horizontal={chatOpen}>
					{#each visibleThumbs as t (t.id)}
						<div class="thumb-card">
							<Tile
								stream={t.stream}
								name={t.name}
								muted={t.isLocal}
								mirror={t.mirror}
								isLocal={t.isLocal}
								isCamOff={t.isCamOff}
								tag={t.tag}
							/>
						</div>
					{/each}
					{#if overflowCount > 0}
						<div class="thumb-card thumb-overflow">
							<span>+{overflowCount}</span>
						</div>
					{/if}
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

		<div class="panel-col">
			<Sidebar
				bind:tab={sidebarTab}
				bind:chatMessage
				messages={$messages}
				{senderName}
				onSend={sendMessage}
				aiMessages={$aiMessages}
				aiPending={$aiPending}
				onSendAi={(text) => room.askAiPrivate(text)}
				transcript={$transcript}
				isTranscribing={$isTranscribing}
				onToggleTranscription={() => room.toggleTranscription()}
				participants={$participants}
				pendingJoiners={$pendingJoiners}
				isHost={$isHost}
				onApprove={(uid) => room.approveJoiner(uid)}
				onDeny={(uid) => room.denyJoiner(uid)}
				onApproveAll={() => room.approveAll()}
				onCreateInvite={generateInvite}
				onClose={() => (chatOpen = false)}
			/>
		</div>
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
		{chatOpen}
		activeTab={sidebarTab}
		pendingCount={$pendingJoiners.length}
		onToggleMute={() => room.toggleMute()}
		onToggleCam={() => room.toggleCam()}
		onToggleScreen={() => room.toggleScreen()}
		onOpenTab={openTab}
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
	:global(html:has(.room-shell)),
	:global(body:has(.room-shell)) {
		overflow: hidden !important;
		height: 100% !important;
		min-height: 0 !important;
		max-height: 100vh !important;
		max-height: 100dvh !important;
	}

	.room-shell {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-deep);
	}

	.room-main {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 0px;
		min-height: 0;
		overflow: hidden;
		transition: grid-template-columns 0.3s ease;
		padding: 0.5rem;
		gap: 0.5rem;
	}

	.room-main.sidebar-open {
		grid-template-columns: 1fr 340px;
	}

	.panel-col {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.stage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 0.5rem;
		padding: 0.75rem;
		overflow: hidden;
		min-height: 0;
		min-width: 0;
		place-content: center;
	}

	.stage.split {
		grid-template-columns: minmax(0, 1fr) 220px;
		grid-template-rows: minmax(0, 1fr);
		place-content: stretch;
		padding: 0.35rem;
		gap: 0.35rem;
	}

	.stage.split .screens {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
	}

	.stage.split .screens :global(.tile) {
		max-width: 100%;
		max-height: 100%;
		min-height: 0;
		border-radius: 8px;
	}

	.thumbs {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		overflow: hidden;
		justify-content: center;
	}

	.thumbs.horizontal {
		flex-direction: row;
		overflow-y: hidden;
		overflow-x: auto;
		order: -1;
		grid-column: 1 / -1;
		justify-content: center;
	}

	.stage.split:has(.thumbs.horizontal) {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
	}

	.thumb-card {
		flex: 1 1 0;
		min-height: 0;
		border-radius: 10px;
		overflow: hidden;
	}

	.thumbs:not(.horizontal) .thumb-card {
		max-height: 160px;
	}

	.thumbs.horizontal .thumb-card {
		width: 200px;
		height: 130px;
		flex: 0 0 auto;
	}

	.thumb-card :global(.tile) {
		aspect-ratio: auto !important;
		width: 100%;
		height: 100%;
		border-radius: 0;
	}

	.thumb-overflow {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 10px;
	}

	.thumbs:not(.horizontal) .thumb-overflow {
		max-height: 140px;
	}

	.thumbs.horizontal .thumb-overflow {
		width: 130px;
		height: 130px;
	}

	@media (max-width: 640px) {
		.stage.split {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.thumbs {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
		}

		.thumb-card {
			width: 100px;
			height: 62px;
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

	@media (max-width: 640px) {
		.stage {
			grid-template-columns: 1fr;
			padding: 0.25rem;
			gap: 0.25rem;
		}

		.room-main.sidebar-open {
			grid-template-columns: 1fr 280px;
		}
	}

	@media (max-width: 480px) {
		.room-main.sidebar-open {
			grid-template-columns: 0px 1fr;
		}
	}
</style>

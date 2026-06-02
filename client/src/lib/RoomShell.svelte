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
		isHandRaised,
		isCamOff,
		isSharing,
		isLowData,
		isHost,
		pendingJoiners,
		dominantSpeaker
	} = room;

	$: lowData = $isLowData;

	let speakingOrder: string[] = [];
	$: if ($dominantSpeaker) {
		speakingOrder = [$dominantSpeaker, ...speakingOrder.filter((id) => id !== $dominantSpeaker)];
	}

	function speakerRank(id: string): number {
		const i = speakingOrder.indexOf(id);
		return i === -1 ? Number.MAX_SAFE_INTEGER : i;
	}

	let chatMessage = '';
	let chatOpen = false;
	let sidebarTab = 'chat';
	let winW = 1280;

	function openTab(tab: string) {
		if (chatOpen && sidebarTab === tab) {
			chatOpen = false;
		} else {
			sidebarTab = tab;
			chatOpen = true;
		}
	}

	$: hasScreenShare =
		!lowData &&
		($localScreenStream !== null ||
			Object.values($participants).some((p) => p.screenStream !== null));

	const MAX_VISIBLE_THUMBS = 5;

	type ThumbEntry = {
		id: string;
		stream: MediaStream | null;
		name: string;
		isLocal: boolean;
		isCamOff: boolean;
		mirror: boolean;
		micOff: boolean;
		speaking: boolean;
		handRaised: boolean;
		tag: string | null;
	};

	$: allThumbs = (() => {
		const list: ThumbEntry[] = [];
		if ($localStream) {
			list.push({
				id: '_self',
				stream: lowData ? null : $localStream,
				name: senderName,
				isLocal: true,
				isCamOff: lowData || $isCamOff,
				mirror: true,
				micOff: $isMuted,
				speaking: $dominantSpeaker === room.participantId,
				handRaised: $isHandRaised,
				tag: 'you'
			});
		}
		const remotes = Object.entries($participants)
			.sort(([a], [b]) => speakerRank(a) - speakerRank(b))
			.map(([pid, p]) => ({
				id: pid,
				stream: lowData ? null : p.videoStream,
				name: p.name,
				isLocal: false,
				isCamOff: lowData || !p.videoStream,
				mirror: false,
				micOff: p.muted,
				speaking: $dominantSpeaker === pid,
				handRaised: p.handRaised,
				tag: null
			}));
		return [...list, ...remotes];
	})();

	$: visibleThumbs = allThumbs.slice(0, MAX_VISIBLE_THUMBS);
	$: overflowCount = Math.max(0, allThumbs.length - MAX_VISIBLE_THUMBS);

	$: isPhone = winW <= 640;
	$: presenting = hasScreenShare;
	$: mobileCarousel = isPhone;

	$: speakerTileId =
		$dominantSpeaker == null
			? null
			: $dominantSpeaker === room.participantId
			? '_self'
			: $dominantSpeaker;

	// Carousel (mobile): swipe between pages. People ride three to a page so faces
	// stay a sensible size and aren't cropped; a presentation takes its own full
	// page. It auto-scrolls to the speaker's page but backs off after you swipe.
	type CardEntry =
		| { key: string; kind: 'screen'; name: string; stream: MediaStream | null; tag: string }
		| { key: string; kind: 'tile'; thumb: ThumbEntry };

	const PEOPLE_PER_PAGE = 3;
	$: carouselPages = (() => {
		const pages: CardEntry[][] = [];
		if (presenting) {
			if ($localScreenStream) {
				pages.push([
					{
						key: 'screen-self',
						kind: 'screen',
						name: senderName,
						stream: $localScreenStream,
						tag: 'your screen'
					}
				]);
			}
			for (const [pid, p] of Object.entries($participants)) {
				if (p.screenStream) {
					pages.push([
						{
							key: 'scr-' + pid,
							kind: 'screen',
							name: p.name,
							stream: p.screenStream,
							tag: `${p.name}'s screen`
						}
					]);
				}
			}
		}
		for (let i = 0; i < allThumbs.length; i += PEOPLE_PER_PAGE) {
			pages.push(
				allThumbs
					.slice(i, i + PEOPLE_PER_PAGE)
					.map((t): CardEntry => ({ key: t.id, kind: 'tile', thumb: t }))
			);
		}
		return pages;
	})();

	let pagerEl: HTMLDivElement | null = null;
	let pageIndex = 0;
	let lastUserScroll = 0;

	function onPagerScroll() {
		if (pagerEl) pageIndex = Math.round(pagerEl.scrollLeft / Math.max(1, pagerEl.clientWidth));
	}
	function markUserScroll() {
		lastUserScroll = Date.now();
	}

	$: speakerPage = carouselPages.findIndex((pg) =>
		pg.some((c) => c.kind === 'tile' && c.thumb.id === speakerTileId)
	);
	$: if (
		mobileCarousel &&
		pagerEl &&
		speakerPage >= 0 &&
		speakerPage !== pageIndex &&
		Date.now() - lastUserScroll > 4000
	) {
		pagerEl.scrollTo({ left: speakerPage * pagerEl.clientWidth, behavior: 'smooth' });
	}

	// Desktop / tablet keep the even grid.
	$: maxGridTiles = winW <= 1024 ? 6 : 12;
	$: gridThumbs = allThumbs.slice(0, maxGridTiles);
	$: gridOverflow = Math.max(0, allThumbs.length - maxGridTiles);
	$: gridUnits = gridThumbs.length + (gridOverflow > 0 ? 1 : 0);
	$: gridCols = Math.max(1, Math.ceil(Math.sqrt(gridUnits)));
	$: gridRows = Math.max(1, Math.ceil(gridUnits / gridCols));

	$: renderedParticipantIds = (() => {
		const ids = new Set<string>();
		if (lowData) {
			return [];
		}
		if (mobileCarousel) {
			for (const pg of carouselPages)
				for (const c of pg) if (c.kind === 'tile' && !c.thumb.isLocal) ids.add(c.thumb.id);
			for (const [pid, p] of Object.entries($participants)) if (p.screenStream) ids.add(pid);
		} else if (hasScreenShare) {
			for (const t of visibleThumbs) if (t.id !== '_self') ids.add(t.id);
			for (const [pid, p] of Object.entries($participants)) if (p.screenStream) ids.add(pid);
		} else {
			for (const t of gridThumbs) if (!t.isLocal) ids.add(t.id);
		}
		return [...ids];
	})();
	$: room.setVisibleParticipants(renderedParticipantIds);

	$: participantLayers = (() => {
		const m: Record<string, number> = {};
		if (lowData) {
			return m;
		}
		if (mobileCarousel) {
			carouselPages.forEach((pg, i) => {
				const hi = pg.length === 1 ? 2 : 1;
				for (const c of pg)
					if (c.kind === 'tile' && !c.thumb.isLocal) m[c.thumb.id] = i === pageIndex ? hi : 0;
			});
		} else if (hasScreenShare) {
			for (const t of visibleThumbs) if (!t.isLocal) m[t.id] = 0;
		} else {
			const layer = gridCols <= 2 ? 2 : gridCols === 3 ? 1 : 0;
			for (const t of gridThumbs) if (!t.isLocal) m[t.id] = layer;
		}
		return m;
	})();
	$: room.setParticipantLayers(participantLayers);

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

<svelte:window bind:innerWidth={winW} />

<div class="room-shell">
	<button
		class="people-btn"
		class:active={chatOpen && sidebarTab === 'people'}
		on:click={() => openTab('people')}
		title="People"
		aria-label="People"
	>
		<svg
			viewBox="0 0 24 24"
			width="18"
			height="18"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path
				d="M23 21v-2a4 4 0 0 0-3-3.87"
			/><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg
		>
		<span class="people-count">{Object.keys($participants).length + 1}</span>
		{#if $pendingJoiners.length > 0}
			<span class="people-badge">{$pendingJoiners.length}</span>
		{/if}
	</button>

	<main class="room-main" class:sidebar-open={chatOpen}>
		<section
			class="stage"
			class:split={hasScreenShare && !mobileCarousel}
			class:carousel={mobileCarousel}
			style:--per-row={gridCols}
			style:--rows={gridRows}
		>
			{#if mobileCarousel}
				<div
					class="pager"
					bind:this={pagerEl}
					on:scroll={onPagerScroll}
					on:pointerdown={markUserScroll}
					on:wheel={markUserScroll}
				>
					{#each carouselPages as page (page[0].key)}
						<div class="page-col">
							{#each page as c (c.key)}
								{#if c.kind === 'screen'}
									<div class="card screen-card">
										<Tile stream={c.stream} name={c.name} isScreen={true} tag={c.tag} />
									</div>
								{:else}
									<div class="card">
										<Tile
											stream={c.thumb.stream}
											name={c.thumb.name}
											muted={c.thumb.isLocal}
											mirror={c.thumb.mirror}
											isLocal={c.thumb.isLocal}
											isCamOff={c.thumb.isCamOff}
											micOff={c.thumb.micOff}
											speaking={c.thumb.speaking}
											handRaised={c.thumb.handRaised}
											tag={c.thumb.tag}
										/>
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
				{#if carouselPages.length > 1}
					<div class="dots">
						{#each carouselPages as page, i (page[0].key)}
							<span class="dot" class:active={i === pageIndex} />
						{/each}
					</div>
				{/if}
			{:else if hasScreenShare}
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
								micOff={t.micOff}
								speaking={t.speaking}
								handRaised={t.handRaised}
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
				{#each gridThumbs as t (t.id)}
					<Tile
						stream={t.stream}
						name={t.name}
						muted={t.isLocal}
						mirror={t.mirror}
						isLocal={t.isLocal}
						isCamOff={t.isCamOff}
						micOff={t.micOff}
						speaking={t.speaking}
						handRaised={t.handRaised}
						tag={t.tag}
					/>
				{/each}
				{#if gridOverflow > 0}
					<div class="grid-overflow"><span>+{gridOverflow}</span></div>
				{/if}
			{/if}
		</section>

		<div class="panel-col">
			<Sidebar
				bind:tab={sidebarTab}
				bind:chatMessage
				messages={$messages}
				{senderName}
				onSend={sendMessage}
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
		isLowData={$isLowData}
		{chatOpen}
		activeTab={sidebarTab}
		onToggleMute={() => room.toggleMute()}
		onToggleCam={() => room.toggleCam()}
		onToggleScreen={() => room.toggleScreen()}
		onToggleLowData={() => room.setLowData(!$isLowData)}
		isHandRaised={$isHandRaised}
		onToggleHand={() => room.toggleHand()}
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
		gap: 0.5rem;
		padding: 0.75rem;
		overflow: hidden;
		min-height: 0;
		min-width: 0;
	}

	.stage:not(.split) {
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		align-items: center;
		justify-content: center;
	}

	.stage:not(.split) > :global(.tile) {
		flex: 0 1 auto;
		width: calc((100% - (var(--per-row, 1) - 1) * 0.5rem) / var(--per-row, 1));
		max-height: calc((100% - (var(--rows, 1) - 1) * 0.5rem) / var(--rows, 1));
		min-width: 0;
	}

	.stage.split {
		display: grid;
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

	.grid-overflow {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
		border-radius: 10px;
		flex: 0 1 auto;
		width: calc((100% - (var(--per-row, 1) - 1) * 0.5rem) / var(--per-row, 1));
		max-height: calc((100% - (var(--rows, 1) - 1) * 0.5rem) / var(--rows, 1));
		min-width: 0;
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

	.people-btn {
		position: fixed;
		top: max(0.75rem, env(safe-area-inset-top));
		right: max(0.75rem, env(safe-area-inset-right));
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 40px;
		padding: 0 0.7rem;
		background: rgba(20, 16, 12, 0.7);
		backdrop-filter: blur(12px);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
		z-index: 25;
	}

	.people-btn:hover {
		background: var(--surface-3);
		border-color: var(--border-strong);
	}

	.people-btn.active {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
		backdrop-filter: none;
	}

	.people-count {
		min-width: 1ch;
		text-align: center;
	}

	.people-badge {
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 700;
		background: var(--accent);
		color: var(--bg);
		border-radius: 999px;
	}

	.people-btn.active .people-badge {
		background: var(--bg);
		color: var(--accent);
	}

	.invite-toast {
		position: fixed;
		top: max(1rem, env(safe-area-inset-top));
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
		top: max(1rem, env(safe-area-inset-top));
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
			padding: 0.3rem;
			gap: 0.3rem;
		}

		.stage.carousel {
			display: block;
			padding: 0;
			position: relative;
			overflow: hidden;
		}

		.pager {
			height: 100%;
			display: flex;
			overflow-x: auto;
			overflow-y: hidden;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
		}

		.pager::-webkit-scrollbar {
			display: none;
		}

		.page-col {
			flex: 0 0 100%;
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
			padding: 0.3rem;
			scroll-snap-align: start;
			scroll-snap-stop: always;
		}

		.card {
			position: relative;
			flex: 1;
			min-height: 0;
			border-radius: 14px;
			overflow: hidden;
			background: var(--bg-deep);
		}

		.card :global(.tile) {
			width: 100%;
			height: 100%;
			aspect-ratio: auto !important;
			border-radius: 14px;
			background: var(--bg-deep);
		}

		/* Camera fills the card so the speaking ring hugs the video; a shared
		   screen keeps its letterboxed contain (Tile default) so nothing is cut. */
		.screen-card :global(video) {
			object-fit: contain !important;
		}

		.dots {
			position: absolute;
			bottom: 0.6rem;
			left: 50%;
			transform: translateX(-50%);
			display: flex;
			gap: 0.35rem;
			padding: 0.3rem 0.5rem;
			background: rgba(10, 8, 7, 0.45);
			backdrop-filter: blur(8px);
			border-radius: 999px;
			z-index: 5;
		}

		.dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: rgba(244, 237, 228, 0.35);
			transition: background 0.2s, width 0.2s;
		}

		.dot.active {
			width: 16px;
			border-radius: 3px;
			background: var(--accent);
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

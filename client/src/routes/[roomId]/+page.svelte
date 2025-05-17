<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { auth } from '../../firebase';

	import Lobby from '$lib/Lobby.svelte';
	import StatusCard from '$lib/StatusCard.svelte';
	import WaitingScreen from '$lib/WaitingScreen.svelte';
	import RoomShell from '$lib/RoomShell.svelte';
	import { RoomClient, type JoinStatus } from '$lib/RoomClient';

	import type { PageData } from './$types';

	export let data: PageData;

	let phase: 'loading' | 'lobby' | 'in-room' = 'loading';
	let room: RoomClient | null = null;

	let mediaError: Writable<string | null> = writable(null);
	let localStream: Writable<MediaStream | null> = writable(null);
	let joinStatus: Writable<JoinStatus> = writable('connecting');

	let roomId: string = data.roomId;
	let senderName = '';
	let nameInput = '';
	let isSignedIn = false;

	const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user?.displayName) {
				isSignedIn = true;
				if (phase === 'loading') {
					senderName = user.displayName;
					startRoom();
					phase = 'in-room';
				}
			} else {
				isSignedIn = false;
				if (phase === 'loading') phase = 'lobby';
			}
		});
		return unsubscribe;
	});

	onDestroy(() => {
		room?.leave();
	});

	async function signIn() {
		try {
			await signInWithPopup(auth, new GoogleAuthProvider());
		} catch (err) {
			console.error('Sign-in failed:', err);
		}
	}

	function joinFromLobby() {
		const trimmed = nameInput.trim();
		if (!trimmed) return;
		senderName = trimmed;
		startRoom();
		phase = 'in-room';
	}

	function parseFragment(): { chatSecret?: string; inviteToken?: string } {
		if (typeof window === 'undefined') return {};
		const hash = window.location.hash.replace(/^#/, '');
		if (!hash) return {};
		if (!hash.includes('=')) return { chatSecret: hash };
		const params = new URLSearchParams(hash);
		return {
			chatSecret: params.get('k') ?? undefined,
			inviteToken: params.get('i') ?? undefined
		};
	}

	function startRoom() {
		const { chatSecret, inviteToken } = parseFragment();
		room = new RoomClient({
			roomId,
			name: senderName,
			serverUrl: SERVER_URL,
			chatSecret,
			inviteToken
		});
		mediaError = room.mediaError;
		localStream = room.localStream;
		joinStatus = room.joinStatus;
		room.start();
	}

	function leave() {
		room?.leave();
		room = null;
		goto('/');
	}
</script>

<svelte:head>
	<title>chattr — {roomId}</title>
</svelte:head>

{#if phase === 'loading'}
	<div class="screen-center">
		<span class="tuning"
			>Tuning in<span class="dots"><span>.</span><span>.</span><span>.</span></span></span
		>
	</div>
{:else if phase === 'lobby'}
	<Lobby {roomId} bind:nameInput {isSignedIn} onJoin={joinFromLobby} onSignIn={signIn} />
{:else if $mediaError}
	<div class="screen-center">
		<StatusCard eyebrow="we hit a snag" title="Almost there" tone="danger">
			<p>{$mediaError}</p>
			<div class="card-actions">
				<button class="cta" on:click={() => room?.start()}>Try again</button>
				<button class="cta-ghost" on:click={() => goto('/')}>Cancel</button>
			</div>
		</StatusCard>
	</div>
{:else if $joinStatus === 'connecting'}
	<div class="screen-center">
		<span class="tuning"
			>Tuning in<span class="dots"><span>.</span><span>.</span><span>.</span></span></span
		>
	</div>
{:else if $joinStatus === 'pending' && room}
	<WaitingScreen {room} {roomId} onLeave={() => goto('/')} />
{:else if $joinStatus === 'denied'}
	<div class="screen-center">
		<StatusCard eyebrow="not admitted" title="The host didn't let you in" tone="danger">
			<p>You can ask the host directly, or try a different room.</p>
			<div class="card-actions">
				<button class="cta" on:click={() => goto('/')}>Back home</button>
			</div>
		</StatusCard>
	</div>
{:else if $joinStatus === 'host-left'}
	<div class="screen-center">
		<StatusCard eyebrow="meeting ended" title="The host left the room" tone="danger">
			<p>Once the host returns you can try joining again.</p>
			<div class="card-actions">
				<button class="cta" on:click={() => goto('/')}>Back home</button>
			</div>
		</StatusCard>
	</div>
{:else if room}
	<RoomShell {room} {roomId} {senderName} onLeave={leave} />
{/if}

<style>
	.screen-center {
		min-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tuning {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.dots span {
		animation: -global-blink 1.4s infinite;
		display: inline-block;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	.card-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.cta {
		padding: 0.75rem 1.25rem;
		background: var(--accent);
		color: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 2px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.cta:hover {
		opacity: 0.9;
	}

	.cta-ghost {
		padding: 0.75rem 1.25rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-strong);
		border-radius: 2px;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.cta-ghost:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}
</style>

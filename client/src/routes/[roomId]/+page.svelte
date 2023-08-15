<script lang="ts">
	import { onMount } from 'svelte';
	import { Socket, io } from 'socket.io-client';
	import * as mediasoupClient from 'mediasoup-client';
	import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';
	import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { auth } from '../../firebase';

	import Lobby from '$lib/Lobby.svelte';
	import RoomTopBar from '$lib/RoomTopBar.svelte';
	import Tile from '$lib/Tile.svelte';
	import Chat from '$lib/Chat.svelte';
	import ControlBar from '$lib/ControlBar.svelte';
	import VideoPlayer from '../../components/VideoPlayer.svelte';

	import type { PageData } from './$types';

	export let data: PageData;

	let phase: 'loading' | 'lobby' | 'in-room' = 'loading';

	let localStream: MediaStream | null = null;
	type Participant = {
		name: string;
		videoStream: MediaStream | null;
		audioStream: MediaStream | null;
	};
	let participants: Record<string, Participant> = {};
	let producerToUser: Record<string, string> = {};
	let producerKinds: Record<string, 'audio' | 'video'> = {};
	let socket: Socket;
	let device: mediasoupClient.Device;
	let recvTransports: Record<string, mediasoupClient.types.Transport> = {};
	let roomId: string = data.roomId;
	let chatMessage = '';
	let messages: {
		message: string;
		sender: string;
	}[] = [];

	let senderName = '';
	let nameInput = '';
	let isSignedIn = false;

	let cameraStream: MediaStream | null = null;
	let screenStream: MediaStream | null = null;
	let cameraVideoTrack: MediaStreamTrack | null = null;
	let cameraAudioTrack: MediaStreamTrack | null = null;
	let videoProducer: mediasoupClient.types.Producer | null = null;
	let audioProducer: mediasoupClient.types.Producer | null = null;
	let videoSendTransport: mediasoupClient.types.Transport | null = null;

	let isMuted = false;
	let isCamOff = false;
	let isSharing = false;
	let chatOpen = false;
	let mediaError: string | null = null;

	const consumedProducerIds = new Set<string>();
	const codecOptions = { videoGoogleStartBitrate: 1000 };
	const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
	const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user?.displayName) {
				isSignedIn = true;
				if (phase === 'loading') {
					senderName = user.displayName;
					phase = 'in-room';
					initMediasoup();
				}
			} else {
				isSignedIn = false;
				if (phase === 'loading') phase = 'lobby';
			}
		});
		return unsubscribe;
	});

	async function signIn() {
		try {
			await signInWithPopup(auth, new GoogleAuthProvider());
		} catch (err) {
			console.error('Sign-in failed:', err);
		}
	}

	async function joinRoom() {
		const trimmed = nameInput.trim();
		if (!trimmed) return;
		senderName = trimmed;
		phase = 'in-room';
		await initMediasoup();
	}

	async function initMediasoup() {
		mediaError = null;

		try {
			cameraStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});
		} catch (err) {
			mediaError = describeMediaError(err);
			return;
		}

		localStream = cameraStream;
		cameraVideoTrack = cameraStream.getVideoTracks()[0];
		cameraAudioTrack = cameraStream.getAudioTracks()[0];

		socket = io(SERVER_URL);

		const { routerRtpCapabilities, transportOptions, participants: existing } = await new Promise<{
			routerRtpCapabilities: RtpCapabilities;
			transportOptions: any;
			participants: { userId: string; name: string }[];
		}>((resolve) => {
			socket.emit('join-room', { roomId, name: senderName }, resolve);
		});

		const initial: Record<string, Participant> = {};
		for (const p of existing) {
			initial[p.userId] = { name: p.name, videoStream: null, audioStream: null };
		}
		participants = initial;

		device = new mediasoupClient.Device();
		await device.load({ routerRtpCapabilities });

		videoSendTransport = device.createSendTransport({ ...transportOptions, iceServers });
		setupSendTransport(videoSendTransport);

		const audioTransportOptions = await new Promise<any>((resolve) => {
			socket.emit('create-send-transport', { roomId }, (data: { transportOptions: any }) =>
				resolve(data.transportOptions)
			);
		});
		const audioSendTransport = device.createSendTransport({
			...audioTransportOptions,
			iceServers
		});
		setupSendTransport(audioSendTransport);

		videoProducer = await videoSendTransport.produce({
			track: cameraVideoTrack,
			codecOptions,
			stopTracks: false
		});
		audioProducer = await audioSendTransport.produce({
			track: cameraAudioTrack,
			stopTracks: false
		});

		socket.on(
			'user-joined',
			({ userId: uid, name }: { userId: string; name: string }) => {
				if (participants[uid]) return;
				participants = {
					...participants,
					[uid]: { name, videoStream: null, audioStream: null }
				};
			}
		);

		socket.on('user-left', ({ userId: uid }: { userId: string }) => {
			const { [uid]: _gone, ...rest } = participants;
			participants = rest;
		});

		socket.on(
			'new-producer',
			async ({
				producerId,
				name,
				userId: uid
			}: {
				producerId: string;
				name: string;
				userId: string;
			}) => {
				if (!participants[uid]) {
					participants = {
						...participants,
						[uid]: { name, videoStream: null, audioStream: null }
					};
				}
				producerToUser[producerId] = uid;
				await consume(producerId);
			}
		);

		socket.on('producer-closed', ({ producerId }: { producerId: string }) => {
			consumedProducerIds.delete(producerId);
			const uid = producerToUser[producerId];
			const kind = producerKinds[producerId];
			delete producerToUser[producerId];
			delete producerKinds[producerId];
			if (uid && participants[uid]) {
				const p = participants[uid];
				const next: Participant = { ...p };
				if (kind === 'video') next.videoStream = null;
				if (kind === 'audio') next.audioStream = null;
				participants = { ...participants, [uid]: next };
			}
		});

		socket.on('receive-chat-message', () => {
			socket.emit('get-chat-history', roomId);
		});

		socket.on('receive-chat-history', (history) => {
			messages = history;
		});

		socket.emit('get-chat-history', roomId);
	}

	function setupSendTransport(transport: mediasoupClient.types.Transport) {
		transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
			try {
				await new Promise((resolve) => {
					socket.emit(
						'connect-transport',
						{ roomId, transportId: transport.id, dtlsParameters },
						resolve
					);
				});
				callback();
			} catch (error) {
				errback(error as Error);
			}
		});

		transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
			try {
				const { id, otherProducers } = await new Promise<{
					id: string;
					otherProducers: { producerId: string; name: string; userId: string }[];
				}>((resolve) => {
					socket.emit(
						'produce',
						{ transportId: transport.id, kind, rtpParameters, roomId },
						resolve
					);
				});

				for (const { producerId, name, userId: uid } of otherProducers) {
					producerToUser[producerId] = uid;
					if (!participants[uid]) {
						participants = {
							...participants,
							[uid]: { name, videoStream: null, audioStream: null }
						};
					}
					await consume(producerId);
				}

				callback({ id });
			} catch (error) {
				errback(error as Error);
			}
		});
	}

	async function recreateVideoProducer(track: MediaStreamTrack | null) {
		if (videoProducer) {
			const oldId = videoProducer.id;
			videoProducer.close();
			socket?.emit('close-producer', { roomId, producerId: oldId });
			videoProducer = null;
		}
		if (videoSendTransport) {
			videoSendTransport.close();
			videoSendTransport = null;
		}
		if (!track) return;

		const transportOptions = await new Promise<any>((resolve) => {
			socket.emit('create-send-transport', { roomId }, (data: { transportOptions: any }) =>
				resolve(data.transportOptions)
			);
		});
		videoSendTransport = device.createSendTransport({ ...transportOptions, iceServers });
		setupSendTransport(videoSendTransport);
		videoProducer = await videoSendTransport.produce({
			track,
			codecOptions,
			stopTracks: false
		});
	}

	function requestKeyframe() {
		if (!videoProducer || !socket) return;
		const producerId = videoProducer.id;
		const send = () => socket.emit('request-keyframe', { roomId, producerId });
		send();
		setTimeout(send, 150);
		setTimeout(send, 500);
		setTimeout(send, 1200);
	}

	function describeMediaError(err: unknown): string {
		const e = err as { name?: string; message?: string };
		if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
			return 'Camera and microphone access was blocked. Grant permission in your browser, then retry.';
		}
		if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
			return 'No camera or microphone found. Connect a device and retry.';
		}
		if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
			return 'Camera or microphone is in use by another app. Close it and retry.';
		}
		return `Could not access media: ${e?.message ?? 'unknown error'}`;
	}

	async function consume(producerId: string) {
		if (consumedProducerIds.has(producerId)) return;
		consumedProducerIds.add(producerId);

		socket.emit(
			'create-receive-transport',
			{ roomId },
			async (data: { transportOptions: any }) => {
				const recvTransport = device.createRecvTransport({
					...data.transportOptions,
					iceServers
				});

				recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
					try {
						await new Promise((resolve) => {
							socket.emit(
								'connect-receive-transport',
								{ transportId: recvTransport.id, dtlsParameters, roomId },
								resolve
							);
						});
						callback();
					} catch (error) {
						errback(error as Error);
					}
				});

				recvTransports[recvTransport.id] = recvTransport;

				const consumerOptions = await new Promise<mediasoupClient.types.ConsumerOptions>(
					(resolve) => {
						socket.emit(
							'consume',
							{
								producerId,
								transportId: recvTransport.id,
								roomId,
								rtpCapabilities: device.rtpCapabilities
							},
							resolve
						);
					}
				);

				const consumer = await recvTransport.consume(consumerOptions);
				const stream = new MediaStream([consumer.track]);
				const uid = producerToUser[producerId];
				producerKinds[producerId] = consumer.kind as 'audio' | 'video';

				if (uid && participants[uid]) {
					const p = participants[uid];
					const next: Participant = { ...p };
					if (consumer.kind === 'video') next.videoStream = stream;
					if (consumer.kind === 'audio') next.audioStream = stream;
					participants = { ...participants, [uid]: next };
				}
			}
		);
	}

	function sendMessage() {
		if (chatMessage.trim() === '') return;
		socket.emit('send-chat-message', {
			roomId,
			message: chatMessage,
			sender: senderName
		});
		chatMessage = '';
	}

	async function toggleMute() {
		if (!audioProducer) return;

		if (isMuted) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const newTrack = stream.getAudioTracks()[0];
				cameraAudioTrack = newTrack;

				if (cameraStream) {
					cameraStream.getAudioTracks().forEach((t) => cameraStream!.removeTrack(t));
					cameraStream.addTrack(newTrack);
				}

				await audioProducer.replaceTrack({ track: newTrack });
				isMuted = false;
			} catch (err) {
				console.error('Failed to unmute:', err);
			}
		} else {
			cameraAudioTrack?.stop();
			cameraAudioTrack = null;

			if (cameraStream) {
				cameraStream.getAudioTracks().forEach((t) => cameraStream!.removeTrack(t));
			}

			await audioProducer.replaceTrack({ track: null });
			isMuted = true;
		}
	}

	async function toggleCam() {
		if (!socket || !device) return;

		if (isCamOff) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: true });
				const newTrack = stream.getVideoTracks()[0];
				cameraVideoTrack = newTrack;

				if (cameraStream) {
					cameraStream.getVideoTracks().forEach((t) => cameraStream!.removeTrack(t));
					cameraStream.addTrack(newTrack);
				}

				if (!isSharing) {
					await recreateVideoProducer(newTrack);
					localStream = new MediaStream(cameraStream!.getTracks());
				}

				isCamOff = false;
			} catch (err) {
				console.error('Failed to turn camera on:', err);
			}
		} else {
			cameraVideoTrack?.stop();
			cameraVideoTrack = null;

			if (cameraStream) {
				cameraStream.getVideoTracks().forEach((t) => cameraStream!.removeTrack(t));
			}

			if (!isSharing) {
				await recreateVideoProducer(null);
				localStream = cameraStream ? new MediaStream(cameraStream.getTracks()) : null;
			}

			isCamOff = true;
		}
	}

	async function toggleScreen() {
		if (!socket || !device || !cameraStream) return;
		if (isSharing) {
			stopShare();
			return;
		}
		try {
			screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
			const screenTrack = screenStream.getVideoTracks()[0];
			await recreateVideoProducer(screenTrack);
			localStream = screenStream;
			isSharing = true;
			screenTrack.onended = () => stopShare();
		} catch (err) {
			console.error('Screen share failed:', err);
		}
	}

	async function stopShare() {
		if (screenStream) {
			screenStream.getTracks().forEach((t) => t.stop());
			screenStream = null;
		}

		if (!isCamOff) {
			try {
				cameraVideoTrack?.stop();
				const stream = await navigator.mediaDevices.getUserMedia({ video: true });
				const newTrack = stream.getVideoTracks()[0];
				cameraVideoTrack = newTrack;

				if (cameraStream) {
					cameraStream.getVideoTracks().forEach((t) => cameraStream!.removeTrack(t));
					cameraStream.addTrack(newTrack);
				}

				await recreateVideoProducer(newTrack);
			} catch (err) {
				console.error('Failed to restore camera after share:', err);
				await recreateVideoProducer(null);
			}
		} else {
			await recreateVideoProducer(null);
		}

		isSharing = false;
		localStream = cameraStream ? new MediaStream(cameraStream.getTracks()) : null;
	}

	function leave() {
		cameraStream?.getTracks().forEach((t) => t.stop());
		screenStream?.getTracks().forEach((t) => t.stop());
		socket?.disconnect();
		goto('/');
	}

	function toggleChat() {
		chatOpen = !chatOpen;
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
	<Lobby {roomId} bind:nameInput {isSignedIn} onJoin={joinRoom} onSignIn={signIn} />
{:else if mediaError}
	<div class="screen-center">
		<div class="error-card">
			<span class="error-eyebrow">we hit a snag</span>
			<h2>Almost there</h2>
			<p>{mediaError}</p>
			<div class="error-actions">
				<button class="cta" on:click={initMediasoup}>Try again</button>
				<button class="cta-ghost" on:click={() => goto('/')}>Cancel</button>
			</div>
		</div>
	</div>
{:else}
	<div class="room-shell">
		<RoomTopBar {roomId} {senderName} onToggleChat={toggleChat} />

		<main class="room-main">
			<section class="stage">
				{#if localStream}
					<Tile
						stream={localStream}
						name={senderName}
						muted={true}
						mirror={!isSharing}
						isLocal={true}
						isCamOff={isCamOff && !isSharing}
						tag={isSharing ? 'sharing' : 'you'}
					/>
				{/if}
				{#each Object.entries(participants) as [pid, p] (pid)}
					<Tile stream={p.videoStream} name={p.name} isCamOff={!p.videoStream} />
				{/each}
			</section>

			<Chat
				bind:chatMessage
				{messages}
				{senderName}
				onSend={sendMessage}
				open={chatOpen}
				onClose={() => (chatOpen = false)}
			/>
		</main>

		<div class="audio-only">
			{#each Object.entries(participants) as [pid, p] (pid)}
				{#if p.audioStream}
					<VideoPlayer mediaStream={p.audioStream} />
				{/if}
			{/each}
		</div>

		<ControlBar
			{isMuted}
			{isCamOff}
			{isSharing}
			onToggleMute={toggleMute}
			onToggleCam={toggleCam}
			onToggleScreen={toggleScreen}
			onLeave={leave}
		/>
	</div>
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
		animation: blink 1.4s infinite;
		display: inline-block;
	}
	.dots span:nth-child(2) { animation-delay: 0.2s; }
	.dots span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes blink {
		0%, 60%, 100% { opacity: 0.2; }
		30% { opacity: 1; }
	}

	.error-card {
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 2rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-left: 3px solid var(--danger);
		border-radius: 4px;
		animation: fade-up 0.4s ease;
	}

	@keyframes fade-up {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.error-eyebrow {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--danger);
	}

	.error-card h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
	}

	.error-card p {
		font-size: 0.95rem;
		font-weight: 450;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.error-actions {
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
	}

	.audio-only {
		display: none;
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

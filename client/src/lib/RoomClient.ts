import { writable, type Writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';

import { emitWithTimeout, withRetry } from './socket-utils.js';
import { describeMediaError } from './media-errors.js';
import type { TranscriptSegment } from './transcription.js';
import { Denoiser } from './denoise.js';
import { ChatController } from './chat-controller.js';
import { AiController } from './ai-controller.js';
import { TranscriptionController } from './transcription-controller.js';

export type Participant = {
	name: string;
	videoStream: MediaStream | null;
	audioStream: MediaStream | null;
	screenStream: MediaStream | null;
	muted: boolean;
};

export type ChatMessage = { sender: string; message: string };
export type PendingJoiner = { userId: string; name: string };
export type JoinStatus = 'connecting' | 'pending' | 'admitted' | 'denied' | 'host-left';

type RemoteProducerInfo = { producerId: string; name: string; userId: string };

type AdmissionAck = {
	routerRtpCapabilities: RtpCapabilities;
	transportOptions: any;
	participants: { userId: string; name: string; muted?: boolean }[];
	isHost?: boolean;
};

const codecOptions = { videoGoogleStartBitrate: 1000 };
const audioCodecOptions = {
	opusStereo: false,
	opusDtx: true,
	opusFec: true,
	opusNack: true,
	opusMaxAverageBitrate: 20000
};
const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
if (import.meta.env.VITE_TURN_URL) {
	iceServers.push({
		urls: import.meta.env.VITE_TURN_URL,
		username: import.meta.env.VITE_TURN_USERNAME,
		credential: import.meta.env.VITE_TURN_CREDENTIAL
	});
}
const cameraEncodings = [
	{ rid: 'r0', maxBitrate: 150_000, scalabilityMode: 'S1T3' },
	{ rid: 'r1', maxBitrate: 500_000, scalabilityMode: 'S1T3' },
	{ rid: 'r2', maxBitrate: 1_500_000, scalabilityMode: 'S1T3' }
];

export type RoomClientOptions = {
	roomId: string;
	name: string;
	serverUrl: string;
	chatSecret?: string;
	inviteToken?: string;
};

export class RoomClient {
	readonly participants: Writable<Record<string, Participant>> = writable({});
	readonly localStream: Writable<MediaStream | null> = writable(null);
	readonly localScreenStream: Writable<MediaStream | null> = writable(null);
	readonly reconnecting: Writable<boolean> = writable(false);
	readonly reconnectFailed: Writable<boolean> = writable(false);
	readonly mediaError: Writable<string | null> = writable(null);
	readonly isMuted: Writable<boolean> = writable(false);
	readonly isCamOff: Writable<boolean> = writable(false);
	readonly isSharing: Writable<boolean> = writable(false);
	readonly isHost: Writable<boolean> = writable(false);
	readonly pendingJoiners: Writable<PendingJoiner[]> = writable([]);
	readonly joinStatus: Writable<JoinStatus> = writable('connecting');
	readonly dominantSpeaker: Writable<string | null> = writable(null);

	readonly messages: Writable<ChatMessage[]>;
	readonly chatEncrypted: Writable<boolean>;
	readonly aiMessages: Writable<ChatMessage[]>;
	readonly aiPending: Writable<boolean>;
	readonly transcript: Writable<TranscriptSegment[]>;
	readonly isTranscribing: Writable<boolean>;

	private readonly roomId: string;
	readonly name: string;
	private readonly serverUrl: string;
	private readonly inviteToken?: string;
	/**
	 * participantId is the public room key; sessionToken is the secret that lets
	 * a dropped socket resume in place on reconnect instead of rejoining fresh.
	 */
	private readonly participantId = crypto.randomUUID();
	private readonly sessionToken = crypto.randomUUID();

	private readonly chat: ChatController;
	private readonly ai: AiController;
	private readonly transcription: TranscriptionController;

	private socket: Socket | null = null;
	private device: mediasoupClient.Device | null = null;
	private hasJoined = false;

	private cameraStream: MediaStream | null = null;
	private screenStream: MediaStream | null = null;
	private cameraVideoTrack: MediaStreamTrack | null = null;
	private cameraAudioTrack: MediaStreamTrack | null = null;
	private videoSendTransport: mediasoupClient.types.Transport | null = null;
	private audioSendTransport: mediasoupClient.types.Transport | null = null;
	private videoProducer: mediasoupClient.types.Producer | null = null;
	private audioProducer: mediasoupClient.types.Producer | null = null;
	private screenSendTransport: mediasoupClient.types.Transport | null = null;
	private screenProducer: mediasoupClient.types.Producer | null = null;
	private recvTransport: mediasoupClient.types.Transport | null = null;
	private recvTransportPromise: Promise<mediasoupClient.types.Transport> | null = null;

	private producerToUser: Record<string, string> = {};
	private producerKinds: Record<string, 'audio' | 'video'> = {};
	private producerIsScreen: Record<string, boolean> = {};
	private consumedProducerIds = new Set<string>();
	private pausedVideoProducers = new Set<string>();
	private sentVideoLayers = new Map<string, number>();
	private denoiser: Denoiser | null = null;
	private denoiseEnabled = true;

	private async producedAudioTrack(rawTrack: MediaStreamTrack): Promise<MediaStreamTrack> {
		if (!this.denoiseEnabled) return rawTrack;
		if (!this.denoiser) this.denoiser = new Denoiser();
		return this.denoiser.process(rawTrack);
	}

	constructor({ roomId, name, serverUrl, chatSecret, inviteToken }: RoomClientOptions) {
		this.roomId = roomId;
		this.name = name;
		this.serverUrl = serverUrl;
		this.inviteToken = inviteToken;

		this.chat = new ChatController(roomId, name, chatSecret);
		this.ai = new AiController(name);
		this.transcription = new TranscriptionController(roomId, name);
		this.messages = this.chat.messages;
		this.chatEncrypted = this.chat.encrypted;
		this.aiMessages = this.ai.messages;
		this.aiPending = this.ai.pending;
		this.transcript = this.transcription.transcript;
		this.isTranscribing = this.transcription.isTranscribing;
	}

	async start(): Promise<void> {
		this.mediaError.set(null);

		await this.chat.initCrypto();

		try {
			this.cameraStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});
		} catch (err) {
			this.mediaError.set(describeMediaError(err));
			return;
		}

		this.localStream.set(this.cameraStream);
		this.cameraVideoTrack = this.cameraStream.getVideoTracks()[0];
		this.cameraAudioTrack = this.cameraStream.getAudioTracks()[0];

		this.socket = io(this.serverUrl, {
			reconnectionAttempts: 8,
			reconnectionDelay: 800,
			reconnectionDelayMax: 5000,
			timeout: 10_000
		});
		this.socket.on('reconnect_failed', () => {
			this.reconnecting.set(false);
			this.reconnectFailed.set(true);
		});

		const joinAck = await withRetry(() =>
			emitWithTimeout<{
				routerRtpCapabilities?: RtpCapabilities;
				transportOptions?: any;
				participants?: { userId: string; name: string }[];
				isHost?: boolean;
				status?: 'pending';
				error?: 'server-full' | 'room-full' | 'invalid-room-id';
			}>(this.socket, 'join-room', {
				roomId: this.roomId,
				name: this.name,
				invite: this.inviteToken,
				participantId: this.participantId,
				sessionToken: this.sessionToken
			})
		);

		if (joinAck.error) {
			this.mediaError.set(
				joinAck.error === 'room-full'
					? 'This room is full. Try again later or use a different room code.'
					: joinAck.error === 'invalid-room-id'
					? 'That room code looks malformed.'
					: 'The server is at capacity right now. Please try again in a moment.'
			);
			this.socket?.disconnect();
			this.socket = null;
			return;
		}

		this.attachWaitingHandlers();

		if (joinAck.status === 'pending') {
			this.joinStatus.set('pending');
			return;
		}

		this.isHost.set(joinAck.isHost === true);
		await this.completeAdmission(joinAck as AdmissionAck);
	}

	private async completeAdmission(ack: AdmissionAck): Promise<void> {
		const initial: Record<string, Participant> = {};
		for (const p of ack.participants ?? []) {
			initial[p.userId] = {
				name: p.name,
				videoStream: null,
				audioStream: null,
				screenStream: null,
				muted: !!p.muted
			};
		}
		this.participants.set(initial);

		try {
			this.device = new mediasoupClient.Device();
		} catch {
			this.device = new mediasoupClient.Device({ handlerName: 'Safari12' });
		}
		await this.device.load({ routerRtpCapabilities: ack.routerRtpCapabilities });

		this.videoSendTransport = this.device.createSendTransport({
			...ack.transportOptions,
			iceServers
		});
		this.setupSendTransport(this.videoSendTransport);

		const audioOpts = await withRetry(() =>
			emitWithTimeout<{ transportOptions: any }>(this.socket, 'create-send-transport', {
				roomId: this.roomId
			})
		);
		this.audioSendTransport = this.device.createSendTransport({
			...audioOpts.transportOptions,
			iceServers
		});
		this.setupSendTransport(this.audioSendTransport);

		// Consume independent of our own producing (so a muted, camera-off joiner
		// still sees everyone); attach handlers first so nothing is missed.
		this.attachRoomEventHandlers();
		await this.fetchAndConsumeProducers();

		if (this.cameraVideoTrack) {
			this.videoProducer = await withRetry(() =>
				this.videoSendTransport!.produce({
					track: this.cameraVideoTrack!,
					encodings: cameraEncodings,
					codecOptions,
					stopTracks: false
				})
			);
		}
		const audioTrack = this.cameraAudioTrack
			? await this.producedAudioTrack(this.cameraAudioTrack)
			: null;
		if (audioTrack) {
			this.audioProducer = await withRetry(() =>
				this.audioSendTransport!.produce({
					track: audioTrack,
					codecOptions: audioCodecOptions,
					stopTracks: false
				})
			);
		}

		this.chat.requestHistory();
		this.emitMuteState();
		this.hasJoined = true;
		this.joinStatus.set('admitted');
	}

	private async fetchAndConsumeProducers(): Promise<void> {
		let producers: RemoteProducerInfo[] = [];
		try {
			const res = await withRetry(() =>
				emitWithTimeout<{ producers?: RemoteProducerInfo[] }>(this.socket, 'get-producers', {
					roomId: this.roomId
				})
			);
			producers = res.producers ?? [];
		} catch (err) {
			// Don't hang the join if the snapshot fails. new-producer events and the
			// next reconnect's refetch fill in any peers we miss here.
			console.error('get-producers failed:', err);
			return;
		}
		for (const { producerId, name, userId } of producers) {
			this.producerToUser[producerId] = userId;
			this.upsertParticipant(userId, name);
			await this.consume(producerId);
		}
	}

	private emitMuteState(): void {
		this.socket?.emit('mute-state', { roomId: this.roomId, muted: this.snapshot(this.isMuted) });
	}

	/**
	 * last-N: pause server-side forwarding of camera video for participants that
	 * aren't currently rendered, resume those that are. Audio and screen shares
	 * are never paused. Only emits on a state change to avoid socket spam.
	 */
	setVisibleParticipants(visibleUserIds: string[]): void {
		if (!this.socket) return;
		const visible = new Set(visibleUserIds);
		for (const [producerId, owner] of Object.entries(this.producerToUser)) {
			if (this.producerKinds[producerId] !== 'video' || this.producerIsScreen[producerId]) continue;
			const shouldPause = !visible.has(owner);
			const isPaused = this.pausedVideoProducers.has(producerId);
			if (shouldPause && !isPaused) {
				this.socket.emit('pause-consumer', { roomId: this.roomId, producerId });
				this.pausedVideoProducers.add(producerId);
			} else if (!shouldPause && isPaused) {
				this.socket.emit('resume-consumer', { roomId: this.roomId, producerId });
				this.pausedVideoProducers.delete(producerId);
			}
		}
	}

	/**
	 * Ask the SFU to forward a smaller simulcast spatial layer for cameras shown
	 * in small tiles (thumbnails), and a higher one for large tiles. Keyed by the
	 * participant's userId → desired spatial layer (0 lowest .. 2 highest). Only
	 * emits on a change. Screens and audio are untouched.
	 */
	setParticipantLayers(layers: Record<string, number>): void {
		if (!this.socket) return;
		for (const [producerId, owner] of Object.entries(this.producerToUser)) {
			if (this.producerKinds[producerId] !== 'video' || this.producerIsScreen[producerId]) continue;
			const spatial = layers[owner];
			if (spatial === undefined) continue;
			if (this.sentVideoLayers.get(producerId) === spatial) continue;
			this.sentVideoLayers.set(producerId, spatial);
			this.socket.emit('set-preferred-layers', {
				roomId: this.roomId,
				producerId,
				spatialLayer: spatial,
				temporalLayer: 2
			});
		}
	}

	private attachWaitingHandlers(): void {
		if (!this.socket) return;

		this.socket.on('pending-join-request', (req: PendingJoiner) => {
			this.pendingJoiners.update((list) =>
				list.some((p) => p.userId === req.userId) ? list : [...list, req]
			);
		});

		this.socket.on('pending-canceled', ({ userId }: { userId: string }) => {
			this.pendingJoiners.update((list) => list.filter((p) => p.userId !== userId));
		});

		this.socket.on('join-approved', (ack: AdmissionAck) => {
			this.completeAdmission(ack);
		});

		this.socket.on('join-denied', () => {
			this.joinStatus.set('denied');
			this.socket?.disconnect();
		});

		this.socket.on('host-left', () => {
			this.joinStatus.set('host-left');
		});
	}

	async createInvite(): Promise<string | null> {
		if (!this.socket) return null;
		try {
			const resp = await emitWithTimeout<{ token?: string; error?: string }>(
				this.socket,
				'create-invite',
				{ roomId: this.roomId }
			);
			return resp.error ? null : resp.token ?? null;
		} catch {
			return null;
		}
	}

	approveJoiner(userId: string): void {
		this.socket?.emit('approve-join', { roomId: this.roomId, userId });
		this.pendingJoiners.update((list) => list.filter((p) => p.userId !== userId));
	}

	denyJoiner(userId: string): void {
		this.socket?.emit('deny-join', { roomId: this.roomId, userId });
		this.pendingJoiners.update((list) => list.filter((p) => p.userId !== userId));
	}

	approveAll(): void {
		if (!this.socket) return;
		const pending = this.snapshot(this.pendingJoiners);
		for (const p of pending) {
			this.socket.emit('approve-join', { roomId: this.roomId, userId: p.userId });
		}
		this.pendingJoiners.set([]);
	}

	private snapshot<T>(store: Writable<T>): T {
		let value!: T;
		const unsubscribe = store.subscribe((v) => (value = v));
		unsubscribe();
		return value;
	}

	async leave(): Promise<void> {
		this.hasJoined = false;
		this.transcription.stop();
		this.denoiser?.cleanup();
		this.denoiser = null;
		this.closeTransports();
		this.cameraStream?.getTracks().forEach((t) => t.stop());
		this.screenStream?.getTracks().forEach((t) => t.stop());
		this.socket?.disconnect();
	}

	private closeTransports(): void {
		this.videoSendTransport?.close();
		this.audioSendTransport?.close();
		this.screenSendTransport?.close();
		this.recvTransport?.close();
		this.videoSendTransport = null;
		this.audioSendTransport = null;
		this.screenSendTransport = null;
		this.recvTransport = null;
		this.recvTransportPromise = null;
	}

	async toggleMute(): Promise<void> {
		const muted = await this.readStore(this.isMuted);

		if (muted) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const newTrack = stream.getAudioTracks()[0];
				this.cameraAudioTrack = newTrack;

				if (this.cameraStream) {
					this.cameraStream.getAudioTracks().forEach((t) => this.cameraStream!.removeTrack(t));
					this.cameraStream.addTrack(newTrack);
				}

				const producedTrack = await this.producedAudioTrack(newTrack);
				if (this.audioProducer) {
					await this.audioProducer.replaceTrack({ track: producedTrack });
				} else if (this.audioSendTransport) {
					this.audioProducer = await this.audioSendTransport.produce({
						track: producedTrack,
						codecOptions: audioCodecOptions,
						stopTracks: false
					});
				}
				this.isMuted.set(false);
				this.emitMuteState();
			} catch (err) {
				console.error('Failed to unmute:', err);
			}
		} else {
			this.cameraAudioTrack?.stop();
			this.cameraAudioTrack = null;
			if (this.cameraStream) {
				this.cameraStream.getAudioTracks().forEach((t) => this.cameraStream!.removeTrack(t));
			}
			if (this.audioProducer) {
				await this.audioProducer.replaceTrack({ track: null });
			}
			this.isMuted.set(true);
			this.emitMuteState();
		}
	}

	async toggleCam(): Promise<void> {
		const camOff = await this.readStore(this.isCamOff);

		if (camOff) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: true });
				const newTrack = stream.getVideoTracks()[0];
				this.cameraVideoTrack = newTrack;

				if (this.cameraStream) {
					this.cameraStream.getVideoTracks().forEach((t) => this.cameraStream!.removeTrack(t));
					this.cameraStream.addTrack(newTrack);
				}

				if (this.device && this.socket) {
					await this.recreateVideoProducer(newTrack);
				}
				this.localStream.set(new MediaStream(this.cameraStream!.getTracks()));
				this.isCamOff.set(false);
			} catch (err) {
				console.error('Failed to turn camera on:', err);
			}
		} else {
			this.cameraVideoTrack?.stop();
			this.cameraVideoTrack = null;
			if (this.cameraStream) {
				this.cameraStream.getVideoTracks().forEach((t) => this.cameraStream!.removeTrack(t));
			}
			if (this.device && this.socket) {
				await this.recreateVideoProducer(null);
			}
			this.localStream.set(
				this.cameraStream ? new MediaStream(this.cameraStream.getTracks()) : null
			);
			this.isCamOff.set(true);
		}
	}

	async toggleScreen(): Promise<void> {
		if (!this.socket || !this.device) return;
		const sharing = await this.readStore(this.isSharing);
		if (sharing) {
			await this.stopShare();
			return;
		}
		try {
			this.screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: { frameRate: { max: 15 }, height: { max: 1080 } }
			});
			const screenTrack = this.screenStream.getVideoTracks()[0];
			if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail';

			const { transportOptions } = await withRetry(() =>
				emitWithTimeout<{ transportOptions: any }>(this.socket, 'create-send-transport', {
					roomId: this.roomId
				})
			);
			this.screenSendTransport = this.device.createSendTransport({
				...transportOptions,
				iceServers
			});
			this.setupSendTransport(this.screenSendTransport);

			this.screenProducer = await withRetry(() =>
				this.screenSendTransport!.produce({
					track: screenTrack,
					encodings: [{ maxBitrate: 1_500_000 }],
					codecOptions,
					stopTracks: false,
					appData: { isScreen: true }
				})
			);

			this.localScreenStream.set(this.screenStream);
			this.isSharing.set(true);
			screenTrack.onended = () => this.stopShare();
		} catch (err) {
			console.error('Screen share failed:', err);
			if (this.screenStream) {
				this.screenStream.getTracks().forEach((t) => t.stop());
				this.screenStream = null;
			}
		}
	}

	async sendMessage(text: string): Promise<void> {
		await this.chat.send(text);
	}

	async askAiPrivate(text: string): Promise<void> {
		await this.ai.ask(text);
	}

	toggleTranscription(): void {
		this.transcription.toggle();
	}

	private async stopShare(): Promise<void> {
		if (this.screenProducer) {
			const id = this.screenProducer.id;
			this.screenProducer.close();
			this.socket?.emit('close-producer', { roomId: this.roomId, producerId: id });
			this.screenProducer = null;
		}
		if (this.screenSendTransport) {
			this.screenSendTransport.close();
			this.screenSendTransport = null;
		}
		if (this.screenStream) {
			this.screenStream.getTracks().forEach((t) => t.stop());
			this.screenStream = null;
		}
		this.localScreenStream.set(null);
		this.isSharing.set(false);
	}

	private async recreateVideoProducer(
		track: MediaStreamTrack | null,
		{ simulcast = true }: { simulcast?: boolean } = {}
	): Promise<void> {
		if (this.videoProducer) {
			const oldId = this.videoProducer.id;
			this.videoProducer.close();
			this.socket?.emit('close-producer', { roomId: this.roomId, producerId: oldId });
			this.videoProducer = null;
		}
		if (this.videoSendTransport) {
			this.videoSendTransport.close();
			this.videoSendTransport = null;
		}
		if (!track || !this.device) return;

		const { transportOptions } = await withRetry(() =>
			emitWithTimeout<{ transportOptions: any }>(this.socket, 'create-send-transport', {
				roomId: this.roomId
			})
		);
		this.videoSendTransport = this.device.createSendTransport({
			...transportOptions,
			iceServers
		});
		this.setupSendTransport(this.videoSendTransport);
		this.videoProducer = await withRetry(() =>
			this.videoSendTransport!.produce({
				track,
				codecOptions,
				stopTracks: false,
				...(simulcast ? { encodings: cameraEncodings } : {})
			})
		);
	}

	private setupSendTransport(transport: mediasoupClient.types.Transport): void {
		transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
			try {
				await emitWithTimeout(this.socket, 'connect-transport', {
					roomId: this.roomId,
					transportId: transport.id,
					dtlsParameters
				});
				callback();
			} catch (error) {
				errback(error as Error);
			}
		});

		transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
			try {
				const { id } = await emitWithTimeout<{ id: string }>(this.socket, 'produce', {
					transportId: transport.id,
					kind,
					rtpParameters,
					appData,
					roomId: this.roomId
				});
				callback({ id });
			} catch (error) {
				errback(error as Error);
			}
		});

		this.wireIceRecovery(transport);
	}

	private wireIceRecovery(transport: mediasoupClient.types.Transport): void {
		transport.on('connectionstatechange', (state) => {
			if (state === 'failed') void this.restartIce(transport);
		});
	}

	private async restartIce(transport: mediasoupClient.types.Transport): Promise<void> {
		if (!this.hasJoined || transport.closed) return;
		try {
			const { iceParameters } = await emitWithTimeout<{
				iceParameters: mediasoupClient.types.IceParameters;
			}>(this.socket, 'restart-ice', {
				roomId: this.roomId,
				transportId: transport.id
			});
			await transport.restartIce({ iceParameters });
		} catch (error) {
			console.warn('ICE restart failed', error);
		}
	}

	private attachRoomEventHandlers(): void {
		if (!this.socket) return;

		this.chat.attach(this.socket);
		this.transcription.attach(this.socket);

		this.socket.on('user-joined', ({ userId, name }: { userId: string; name: string }) => {
			this.upsertParticipant(userId, name);
		});

		this.socket.on('user-left', ({ userId }: { userId: string }) => {
			this.participants.update((p) => {
				const next = { ...p };
				delete next[userId];
				return next;
			});
		});

		this.socket.on(
			'new-producer',
			async ({
				producerId,
				name,
				userId
			}: {
				producerId: string;
				name: string;
				userId: string;
			}) => {
				this.upsertParticipant(userId, name);
				this.producerToUser[producerId] = userId;
				await this.consume(producerId);
			}
		);

		this.socket.on('producer-closed', ({ producerId }: { producerId: string }) => {
			this.consumedProducerIds.delete(producerId);
			this.pausedVideoProducers.delete(producerId);
			this.sentVideoLayers.delete(producerId);
			const userId = this.producerToUser[producerId];
			const kind = this.producerKinds[producerId];
			const isScreen = this.producerIsScreen[producerId];
			delete this.producerToUser[producerId];
			delete this.producerKinds[producerId];
			delete this.producerIsScreen[producerId];

			if (userId) {
				this.participants.update((p) => {
					if (!p[userId]) return p;
					const next = { ...p[userId] };
					if (kind === 'video') {
						if (isScreen) next.screenStream = null;
						else next.videoStream = null;
					}
					if (kind === 'audio') next.audioStream = null;
					return { ...p, [userId]: next };
				});
			}
		});

		this.socket.on('mute-state', ({ userId, muted }: { userId: string; muted: boolean }) => {
			this.participants.update((p) => {
				if (!p[userId]) return p;
				return { ...p, [userId]: { ...p[userId], muted } };
			});
		});

		this.socket.on('dominant-speaker', ({ userId }: { userId: string | null }) => {
			this.dominantSpeaker.set(userId);
		});

		this.socket.on('disconnect', () => {
			if (!this.hasJoined) return;
			this.reconnecting.set(true);
		});

		this.socket.on('connect', () => {
			if (!this.hasJoined) return;
			this.rejoin();
		});
	}

	private async rejoin(): Promise<void> {
		this.participants.set({});
		this.producerToUser = {};
		this.producerKinds = {};
		this.producerIsScreen = {};
		this.consumedProducerIds.clear();
		this.pausedVideoProducers.clear();
		this.sentVideoLayers.clear();
		this.closeTransports();
		this.videoProducer = null;
		this.audioProducer = null;

		try {
			const rejoinAck = await withRetry(() =>
				emitWithTimeout<{
					routerRtpCapabilities?: RtpCapabilities;
					transportOptions?: any;
					participants?: { userId: string; name: string; muted?: boolean }[];
					isHost?: boolean;
					status?: 'pending';
					error?: string;
				}>(this.socket, 'join-room', {
					roomId: this.roomId,
					name: this.name,
					invite: this.inviteToken,
					participantId: this.participantId,
					sessionToken: this.sessionToken
				})
			);

			if (rejoinAck.error) {
				console.warn('rejoin rejected by server:', rejoinAck.error);
				this.reconnecting.set(false);
				this.reconnectFailed.set(true);
				return;
			}

			if (rejoinAck.status === 'pending') {
				this.reconnecting.set(false);
				this.joinStatus.set('pending');
				return;
			}

			this.isHost.set(rejoinAck.isHost === true);

			const { transportOptions, participants: existing } = rejoinAck as {
				transportOptions: any;
				participants: { userId: string; name: string; muted?: boolean }[];
			};

			const next: Record<string, Participant> = {};
			for (const p of existing) {
				next[p.userId] = {
					name: p.name,
					videoStream: null,
					audioStream: null,
					screenStream: null,
					muted: !!p.muted
				};
			}
			this.participants.set(next);

			this.videoSendTransport = this.device!.createSendTransport({
				...transportOptions,
				iceServers
			});
			this.setupSendTransport(this.videoSendTransport);

			const audioRejoin = await withRetry(() =>
				emitWithTimeout<{ transportOptions: any }>(this.socket, 'create-send-transport', {
					roomId: this.roomId
				})
			);
			this.audioSendTransport = this.device!.createSendTransport({
				...audioRejoin.transportOptions,
				iceServers
			});
			this.setupSendTransport(this.audioSendTransport);

			await this.fetchAndConsumeProducers();

			const camOff = await this.readStore(this.isCamOff);
			const muted = await this.readStore(this.isMuted);

			if (this.screenStream) {
				this.screenStream.getTracks().forEach((t) => t.stop());
				this.screenStream = null;
			}
			this.screenProducer = null;
			this.screenSendTransport = null;
			this.localScreenStream.set(null);
			this.isSharing.set(false);

			const videoTrack = !camOff && this.cameraVideoTrack ? this.cameraVideoTrack : null;
			if (videoTrack) {
				this.videoProducer = await this.videoSendTransport.produce({
					track: videoTrack,
					codecOptions,
					stopTracks: false,
					encodings: cameraEncodings
				});
			}

			if (this.cameraAudioTrack && !muted) {
				const producedTrack = await this.producedAudioTrack(this.cameraAudioTrack);
				this.audioProducer = await this.audioSendTransport.produce({
					track: producedTrack,
					codecOptions: audioCodecOptions,
					stopTracks: false
				});
			}

			this.chat.requestHistory();
			this.emitMuteState();
			this.reconnecting.set(false);
		} catch (err) {
			console.error('Reconnect failed:', err);
		}
	}

	/**
	 * Memoize the in-flight promise so concurrent consume() calls share one
	 * recv transport instead of racing to create duplicates.
	 */
	private getRecvTransport(): Promise<mediasoupClient.types.Transport> {
		if (this.recvTransport && !this.recvTransport.closed) {
			return Promise.resolve(this.recvTransport);
		}
		// A closed transport is a dead cache entry (e.g. ICE failed past recovery);
		// drop it so the next consume rebuilds a fresh one.
		if (this.recvTransport?.closed) {
			this.recvTransport = null;
			this.recvTransportPromise = null;
		}
		if (this.recvTransportPromise) return this.recvTransportPromise;
		this.recvTransportPromise = this.createRecvTransport().catch((err) => {
			this.recvTransportPromise = null;
			throw err;
		});
		return this.recvTransportPromise;
	}

	private async createRecvTransport(): Promise<mediasoupClient.types.Transport> {
		const { transportOptions } = await withRetry(() =>
			emitWithTimeout<{ transportOptions: any }>(this.socket, 'create-receive-transport', {
				roomId: this.roomId
			})
		);

		const recvTransport = this.device!.createRecvTransport({
			...transportOptions,
			iceServers
		});

		recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
			try {
				await emitWithTimeout(this.socket, 'connect-receive-transport', {
					transportId: recvTransport.id,
					dtlsParameters,
					roomId: this.roomId
				});
				callback();
			} catch (error) {
				errback(error as Error);
			}
		});

		this.wireIceRecovery(recvTransport);
		this.recvTransport = recvTransport;
		return recvTransport;
	}

	private async consume(producerId: string): Promise<void> {
		if (this.consumedProducerIds.has(producerId)) return;
		this.consumedProducerIds.add(producerId);

		try {
			const recvTransport = await this.getRecvTransport();

			const consumerOptions = await withRetry(() =>
				emitWithTimeout<
					mediasoupClient.types.ConsumerOptions & {
						appData?: Record<string, unknown>;
					}
				>(this.socket, 'consume', {
					producerId,
					transportId: recvTransport.id,
					roomId: this.roomId,
					rtpCapabilities: this.device!.rtpCapabilities
				})
			);

			const consumer = await recvTransport.consume(consumerOptions);
			const stream = new MediaStream([consumer.track]);
			const userId = this.producerToUser[producerId];
			this.producerKinds[producerId] = consumer.kind as 'audio' | 'video';
			const isScreen = !!consumerOptions.appData?.isScreen;
			this.producerIsScreen[producerId] = isScreen;

			if (consumer.kind === 'video') {
				this.socket?.emit('request-keyframe', { roomId: this.roomId, producerId });
			}

			if (userId) {
				this.participants.update((p) => {
					if (!p[userId]) return p;
					const next = { ...p[userId] };
					if (consumer.kind === 'video') {
						if (isScreen) next.screenStream = stream;
						else next.videoStream = stream;
					}
					if (consumer.kind === 'audio') next.audioStream = stream;
					return { ...p, [userId]: next };
				});
			}
		} catch (err) {
			console.error('consume failed for producer', producerId, err);
			this.consumedProducerIds.delete(producerId);
		}
	}

	private upsertParticipant(userId: string, name: string): void {
		this.participants.update((p) => {
			if (p[userId]) return p;
			return {
				...p,
				[userId]: { name, videoStream: null, audioStream: null, screenStream: null, muted: false }
			};
		});
	}

	private readStore<T>(store: Writable<T>): Promise<T> {
		return new Promise((resolve) => {
			const unsubscribe = store.subscribe((v) => {
				resolve(v);
				queueMicrotask(() => unsubscribe());
			});
		});
	}
}

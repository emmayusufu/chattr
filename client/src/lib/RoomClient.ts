import { writable, type Writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';

import { emitWithTimeout, withRetry } from './socket-utils.js';
import { describeMediaError } from './media-errors.js';
import { ChatRatchet, deriveRootKey } from './chat-crypto.js';

export type Participant = {
	name: string;
	videoStream: MediaStream | null;
	audioStream: MediaStream | null;
	screenStream: MediaStream | null;
};

export type ChatMessage = { sender: string; message: string };
export type PendingJoiner = { userId: string; name: string };
export type JoinStatus = 'connecting' | 'pending' | 'admitted' | 'denied' | 'host-left';

type AdmissionAck = {
	routerRtpCapabilities: RtpCapabilities;
	transportOptions: any;
	participants: { userId: string; name: string }[];
	isHost?: boolean;
};

const codecOptions = { videoGoogleStartBitrate: 1000 };
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
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
	readonly messages: Writable<ChatMessage[]> = writable([]);
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
	readonly chatEncrypted: Writable<boolean> = writable(false);

	private readonly roomId: string;
	private readonly name: string;
	private readonly serverUrl: string;
	private readonly chatSecret?: string;
	private readonly inviteToken?: string;
	private chatRatchet: ChatRatchet | null = null;

	private socket: Socket | null = null;
	private device: mediasoupClient.Device | null = null;
	private hasJoined = false;

	private cameraStream: MediaStream | null = null;
	private screenStream: MediaStream | null = null;
	private cameraVideoTrack: MediaStreamTrack | null = null;
	private cameraAudioTrack: MediaStreamTrack | null = null;
	private videoSendTransport: mediasoupClient.types.Transport | null = null;
	private videoProducer: mediasoupClient.types.Producer | null = null;
	private audioProducer: mediasoupClient.types.Producer | null = null;
	private screenSendTransport: mediasoupClient.types.Transport | null = null;
	private screenProducer: mediasoupClient.types.Producer | null = null;
	private recvTransports: Record<string, mediasoupClient.types.Transport> = {};

	private producerToUser: Record<string, string> = {};
	private producerKinds: Record<string, 'audio' | 'video'> = {};
	private producerIsScreen: Record<string, boolean> = {};
	private consumedProducerIds = new Set<string>();

	constructor({ roomId, name, serverUrl, chatSecret, inviteToken }: RoomClientOptions) {
		this.roomId = roomId;
		this.name = name;
		this.serverUrl = serverUrl;
		this.chatSecret = chatSecret;
		this.inviteToken = inviteToken;
	}

	async start(): Promise<void> {
		this.mediaError.set(null);

		if (this.chatSecret) {
			try {
				const rootKey = await deriveRootKey(this.chatSecret);
				this.chatRatchet = new ChatRatchet(rootKey, this.name);
				this.chatEncrypted.set(true);
			} catch (err) {
				console.error('failed to derive chat key:', err);
			}
		}

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
				invite: this.inviteToken
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
			initial[p.userId] = { name: p.name, videoStream: null, audioStream: null, screenStream: null };
		}
		this.participants.set(initial);

		this.device = new mediasoupClient.Device();
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
		const audioSendTransport = this.device.createSendTransport({
			...audioOpts.transportOptions,
			iceServers
		});
		this.setupSendTransport(audioSendTransport);

		this.videoProducer = await withRetry(() =>
			this.videoSendTransport!.produce({
				track: this.cameraVideoTrack!,
				encodings: cameraEncodings,
				codecOptions,
				stopTracks: false
			})
		);
		this.audioProducer = await withRetry(() =>
			audioSendTransport.produce({
				track: this.cameraAudioTrack!,
				stopTracks: false
			})
		);

		this.attachRoomEventHandlers();
		this.socket?.emit('get-chat-history', this.roomId);
		this.hasJoined = true;
		this.joinStatus.set('admitted');
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
		this.cameraStream?.getTracks().forEach((t) => t.stop());
		this.screenStream?.getTracks().forEach((t) => t.stop());
		this.socket?.disconnect();
	}

	async toggleMute(): Promise<void> {
		if (!this.audioProducer || !this.socket) return;
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

				await this.audioProducer.replaceTrack({ track: newTrack });
				this.isMuted.set(false);
			} catch (err) {
				console.error('Failed to unmute:', err);
			}
		} else {
			this.cameraAudioTrack?.stop();
			this.cameraAudioTrack = null;
			if (this.cameraStream) {
				this.cameraStream.getAudioTracks().forEach((t) => this.cameraStream!.removeTrack(t));
			}
			await this.audioProducer.replaceTrack({ track: null });
			this.isMuted.set(true);
		}
	}

	async toggleCam(): Promise<void> {
		if (!this.socket || !this.device) return;
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

				await this.recreateVideoProducer(newTrack);
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
			await this.recreateVideoProducer(null);
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
			this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
			const screenTrack = this.screenStream.getVideoTracks()[0];

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
		const trimmed = text.trim();
		if (!trimmed || !this.socket) return;
		let payload = trimmed;
		if (this.chatRatchet) {
			try {
				payload = await this.chatRatchet.encrypt(trimmed);
			} catch (err) {
				console.error('chat encrypt failed:', err);
				return;
			}
		}
		this.socket.emit('send-chat-message', {
			roomId: this.roomId,
			message: payload,
			sender: this.name
		});
		this.messages.update((list) => [...list, { sender: this.name, message: trimmed }]);
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
				const { id, otherProducers } = await emitWithTimeout<{
					id: string;
					otherProducers: {
						producerId: string;
						name: string;
						userId: string;
						appData: Record<string, unknown>;
					}[];
				}>(this.socket, 'produce', {
					transportId: transport.id,
					kind,
					rtpParameters,
					appData,
					roomId: this.roomId
				});

				for (const { producerId, name, userId } of otherProducers) {
					this.producerToUser[producerId] = userId;
					this.upsertParticipant(userId, name);
					await this.consume(producerId);
				}

				callback({ id });
			} catch (error) {
				errback(error as Error);
			}
		});
	}

	private attachRoomEventHandlers(): void {
		if (!this.socket) return;

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

		this.socket.on('receive-chat-message', async (msg: ChatMessage) => {
			if (msg.sender === this.name) return;
			let decoded = msg;
			if (this.chatRatchet) {
				try {
					decoded = { ...msg, message: await this.chatRatchet.decrypt(msg.message, msg.sender) };
				} catch {
					decoded = msg;
				}
			}
			this.messages.update((list) => [...list, decoded]);
		});

		this.socket.on('receive-chat-history', async (history: ChatMessage[]) => {
			if (!this.chatRatchet) {
				this.messages.set(history);
				return;
			}
			this.chatRatchet.resetReceivers();
			const decoded: ChatMessage[] = [];
			for (const msg of history) {
				try {
					decoded.push({
						...msg,
						message: await this.chatRatchet.decrypt(msg.message, msg.sender)
					});
				} catch {
					decoded.push(msg);
				}
			}
			this.messages.set(decoded);
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
		this.videoSendTransport = null;
		this.videoProducer = null;
		this.audioProducer = null;

		try {
			const rejoinAck = await withRetry(() =>
				emitWithTimeout<{
					routerRtpCapabilities?: RtpCapabilities;
					transportOptions?: any;
					participants?: { userId: string; name: string }[];
					isHost?: boolean;
					status?: 'pending';
					error?: string;
				}>(this.socket, 'join-room', {
					roomId: this.roomId,
					name: this.name,
					invite: this.inviteToken
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
				participants: { userId: string; name: string }[];
			};

			const next: Record<string, Participant> = {};
			for (const p of existing) {
				next[p.userId] = { name: p.name, videoStream: null, audioStream: null, screenStream: null };
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
			const audioSendTransport = this.device!.createSendTransport({
				...audioRejoin.transportOptions,
				iceServers
			});
			this.setupSendTransport(audioSendTransport);

			if (this.screenStream) {
				this.screenStream.getTracks().forEach((t) => t.stop());
				this.screenStream = null;
			}
			this.screenProducer = null;
			this.screenSendTransport = null;
			this.localScreenStream.set(null);
			this.isSharing.set(false);

			const camOff = await this.readStore(this.isCamOff);
			const muted = await this.readStore(this.isMuted);

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
				this.audioProducer = await audioSendTransport.produce({
					track: this.cameraAudioTrack,
					stopTracks: false
				});
			}

			this.socket?.emit('get-chat-history', this.roomId);
			this.reconnecting.set(false);
		} catch (err) {
			console.error('Reconnect failed:', err);
		}
	}

	private async consume(producerId: string): Promise<void> {
		if (this.consumedProducerIds.has(producerId)) return;
		this.consumedProducerIds.add(producerId);

		try {
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

			this.recvTransports[recvTransport.id] = recvTransport;

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
			const isScreen = !!(consumerOptions.appData?.isScreen);
			this.producerIsScreen[producerId] = isScreen;

			if (consumer.kind === 'video') {
				this.socket?.emit('request-keyframe', { roomId: this.roomId, producerId });
				setTimeout(() => {
					this.socket?.emit('request-keyframe', { roomId: this.roomId, producerId });
				}, 800);
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
			return { ...p, [userId]: { name, videoStream: null, audioStream: null, screenStream: null } };
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

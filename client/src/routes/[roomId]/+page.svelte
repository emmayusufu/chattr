<script lang="ts">
	import { onMount } from 'svelte';
	import { Socket, io } from 'socket.io-client';
	import * as mediasoupClient from 'mediasoup-client';
	import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';

	import type { PageData } from './$types';

	export let data: PageData;

	let localStream: MediaStream;
	let remoteStreams: MediaStream[] = [];
	let socket: Socket;
	let device: mediasoupClient.Device;
	let recvTransports: Record<string, mediasoupClient.types.Transport> = {};
	let consumers: Record<string, mediasoupClient.types.Consumer> = {};
	let roomId: string = data.roomId;

	let audioMuted: boolean = false;
	let videoHidden: boolean = false;

	let params: { [key: string]: any } = {
		current: {
			encoding: [
				{
					rid: 'r0',
					maxBitrate: 100000,
					scalabilityMode: 'S1T3'
				},
				{
					rid: 'r1',
					maxBitrate: 300000,
					scalabilityMode: 'S1T3'
				},
				{
					rid: 'r2',
					maxBitrate: 900000,
					scalabilityMode: 'S1T3'
				}
			],
			codecOptions: {
				videoGoogleStartBitrate: 1000
			}
		}
	};

	onMount(async () => {
		// Connect to the signaling server
		socket = io('http://localhost:3000');

		// Join a room
		const { routerRtpCapabilities, transportOptions } = await new Promise<{
			routerRtpCapabilities: RtpCapabilities;
			transportOptions: any;
		}>((resolve) => {
			socket.emit('join-room', { roomId }, resolve);
		});

		// Initialize mediasoup client device
		device = new mediasoupClient.Device();

		// Load the device with the router RTP capabilities
		await device.load({ routerRtpCapabilities });

		// Get local media stream from the browser
		localStream = await navigator.mediaDevices.getUserMedia({
			video: !videoHidden,
			audio: !audioMuted
		});

		const track = localStream.getVideoTracks()[0];
		params.track = track;

		/**
		 * Create a transport for sending our media through mediasoup
		 * using the WebRTC transport created on the server
		 */
		const sendTransport = device.createSendTransport(transportOptions);

		// Subscribe to the transport's connect event to listen for the server to request our RTP capabilities
		sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
			try {
				// Send our local DTLS parameters to the server over our signaling transport
				await new Promise((resolve) => {
					socket.emit(
						'connect-transport',
						{ roomId, transportId: sendTransport.id, dtlsParameters },
						resolve
					);
				});
				callback();
			} catch (error) {
				errback(error as Error);
			}
		});

		// Subscribe to the transport's produce event to listen for the server to request our media
		sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
			try {
				// Send our local RTP parameters to the server over our signaling transport
				const { id, otherProducerIds } = await new Promise<{
					id: string;
					otherProducerIds: string[];
				}>((resolve) => {
					socket.emit(
						'produce',
						{ transportId: sendTransport.id, kind, rtpParameters, roomId },
						resolve
					);
				});

				for (const otherProducerId of otherProducerIds) {
					await consume(otherProducerId);
				}

				// Tell the server what transport is being used by the producer for RTP
				callback({ id });
			} catch (error) {
				errback(error as Error);
			}
		});

		// Add our local media stream to the send transport and let it produce tracks to send to the server
		const producer = await sendTransport.produce(params);

		producer.on('trackended', () => {
			console.log('trackended');
		});

		producer.on('transportclose', () => {
			console.log('transportclose');
		});

		// Handle joining of new participants (new Producers)
		socket.on('new-producer', async ({ producerId }) => {
			await consume(producerId);
		});

		// Handle a participant leaving
		socket.on('producer-closed', ({ producerId }) => {
			// Remove the closed producer's remote media track
			const remoteVideoElement = document.getElementById(producerId) as HTMLVideoElement;
			if (remoteVideoElement) {
				remoteVideoElement.remove();
			}
		});
	});

	// Handler for receiving media from a producer.
	async function consume(producerId: string) {
		// Create a receive transport for the client
		socket.emit('create-receive-transport', { roomId }, async (data: { transportOptions: any }) => {
			const transportOptions = data.transportOptions;
			const recvTransport = device.createRecvTransport(transportOptions);

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

			// Subscribe to a new video track from a remote client
			const consumerParameters = await new Promise((resolve) => {
				socket.emit(
					'consume',
					{ producerId, transportId: recvTransport.id, roomId },
					(consumerParameters: { consumerParameters: mediasoupClient.types.ConsumerOptions }) => {
						resolve(consumerParameters);
					}
				);
			});

			const consumer = await recvTransport.consume(
				consumerParameters as mediasoupClient.types.ConsumerOptions
			);
			consumers[consumer.id] = consumer;
			const remoteVideoElement = document.createElement('video');
			remoteVideoElement.id = producerId;
			remoteVideoElement.srcObject = new MediaStream([consumer.track]);
			remoteVideoElement.autoplay = true;
			remoteVideoElement.playsInline = true;
			document.body.appendChild(remoteVideoElement);
		});
	}
</script>

<svelte:head>
	<title>{roomId}</title>
</svelte:head>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Socket, io } from 'socket.io-client';
	import * as mediasoupClient from 'mediasoup-client';
	import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';
	import VideoPlayer from '../../components/VideoPlayer.svelte';

	import type { PageData } from './$types';

	export let data: PageData;

	let localStream: MediaStream;
	let remoteStreams: { producerId: string; stream: MediaStream }[] = [];
	let socket: Socket;
	let device: mediasoupClient.Device;
	let recvTransports: Record<string, mediasoupClient.types.Transport> = {};
	let roomId: string = data.roomId;
	let chatMessage = '';
	let messages: {
		message: string;
		sender: string;
	}[] = [];

	let audioTrack: MediaStreamTrack;
	let videoTrack: MediaStreamTrack;
	let track: MediaStreamTrack;

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

	// let localVideo: HTMLVideoElement;

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
			video: true,
			audio: true
		});

		track = localStream.getVideoTracks()[0];
		// params.track = track;

		videoTrack = localStream.getVideoTracks()[0];
		audioTrack = localStream.getAudioTracks()[0];

		// localVideo.srcObject = localStream;

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
		const producer = await sendTransport.produce({
			track,
			...params
		});

		producer.on('trackended', () => {
			console.log('trackended');
		});

		producer.on('transportclose', () => {
			console.log('transportclose');
		});

		// const videoProducer = await sendTransport.produce({
		// 	track: videoTrack,
		// 	...params
		// });

		// const audioProducer = await sendTransport.produce({
		// 	track: audioTrack,
		// 	...params
		// });

		// videoProducer.on('trackended', () => {
		// 	console.log('video track ended');
		// });

		// videoProducer.on('transportclose', () => {
		// 	console.log('video transport closed');
		// });

		// audioProducer.on('trackended', () => {
		// 	console.log('audio track ended');
		// });

		// audioProducer.on('transportclose', () => {
		// 	console.log('audio transport closed');
		// });

		// Handle joining of new participants (new Producers)
		socket.on('new-producer', async ({ producerId }) => {
			await consume(producerId);
		});

		// Handle a participant leaving
		socket.on('producer-closed', ({ producerId }) => {
			// Remove the closed producer's remote media track
			remoteStreams = remoteStreams.filter((stream) => {
				stream.producerId !== producerId;
			});
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

			console.log({
				consumer
			});

			const newRemoteStream = {
				producerId,
				stream: new MediaStream([consumer.track])
			};

			remoteStreams = [...remoteStreams, newRemoteStream];
		});

		socket.on('receive-chat-message', (message) => {
			// messages = [...messages, message];
			socket.emit('get-chat-history', data.roomId);
		});

		// Event listener to receive chat history
		socket.emit('get-chat-history', data.roomId);
		socket.on('receive-chat-history', (history) => {
			messages = history;
		});
	}

	async function sendMessage() {
		if (chatMessage.trim() !== '') {
			const data = {
				roomId,
				message: chatMessage,
				sender: 'User' // You can replace this with the actual user's name
			};

			// Send the chat message to the server
			socket.emit('send-chat-message', data);

			// Clear the chat input field after sending the message
			chatMessage = '';
		}
	}
</script>

<svelte:head>
	<title>Room : {roomId}</title>
</svelte:head>

<!-- <video bind:this={video} muted={false} autoplay /> -->

<div class="room">
	<div class="video-grid">
		{#each remoteStreams as { stream }}
			<VideoPlayer mediaStream={stream} />
		{/each}
	</div>

	<div class="right-sidebar">
		<div class="messages">
			{#each messages as message}
				<p>{message.sender}: {message.message}</p>
			{/each}
		</div>
		<form>
			<input type="text" bind:value={chatMessage} />
			<button on:click={sendMessage}>Send</button>
		</form>
	</div>
</div>

<style la>
	.room {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		height: 90vh;
		padding: 1rem;

		& .video-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
			grid-gap: 0.5rem;
			width: 70%;
			height: 100%;
		}

		& .right-sidebar {
			display: flex;
			flex-direction: column;
			width: 30%;
			height: 100%;
			border: 1px solid rgba(114, 114, 114, 0.544);

			& .messages {
				flex: 1;
				overflow-y: scroll;
				padding: 10px;
			}

			& form {
				display: flex;
				flex-direction: row;
				gap: 0.5rem;

				& input {
					width: 80%;
				}

				& button {
					width: 20%;
				}
			}
		}
	}
</style>

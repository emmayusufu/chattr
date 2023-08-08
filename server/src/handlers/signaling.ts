import type { Socket } from "socket.io";
import type {
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/types";
import {
  worker,
  mediaCodecs,
  webRtcTransportOptions,
} from "../mediasoup.js";
import { rooms, getAllProducersInRoom } from "../rooms.js";

export function registerSignalingHandlers(socket: Socket) {
  const userId = socket.id;

  socket.on(
    "join-room",
    async (data: { roomId: string; name: string }, callback) => {
      const { roomId, name } = data;

      if (!rooms[roomId]) {
        const router = await worker.createRouter({ mediaCodecs });
        rooms[roomId] = { router, users: {} };
      }

      const room = rooms[roomId];

      const existingParticipants = Object.entries(room.users).map(
        ([uid, u]) => ({ userId: uid, name: u.name })
      );

      const transport = await room.router.createWebRtcTransport(
        webRtcTransportOptions
      );

      room.users[userId] = {
        name: name || "guest",
        producers: [],
        consumers: [],
        transports: [{ transport, sender: true }],
      };

      socket.join(roomId);
      socket.to(roomId).emit("user-joined", { userId, name: name || "guest" });

      callback({
        routerRtpCapabilities: room.router.rtpCapabilities,
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
        participants: existingParticipants,
      });
    }
  );

  socket.on(
    "connect-transport",
    async (
      data: {
        roomId: string;
        transportId: string;
        dtlsParameters: DtlsParameters;
      },
      callback
    ) => {
      const transport = rooms[data.roomId]?.users[userId]?.transports.find(
        (t) => t.transport.id === data.transportId
      );
      if (!transport) return;

      await transport.transport.connect({
        dtlsParameters: data.dtlsParameters,
      });
      callback();
    }
  );

  socket.on(
    "produce",
    async (
      data: {
        roomId: string;
        transportId: string;
        kind: "audio" | "video";
        rtpParameters: RtpParameters;
      },
      callback
    ) => {
      const user = rooms[data.roomId]?.users[userId];
      const transport = user?.transports.find(
        (t) => t.transport.id === data.transportId
      );
      if (!user || !transport) return;

      const producer = await transport.transport.produce({
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });
      user.producers.push(producer);

      const otherProducers = getAllProducersInRoom(data.roomId, userId);

      callback({ id: producer.id, otherProducers });
      socket.to(data.roomId).emit("new-producer", {
        producerId: producer.id,
        name: user.name,
        userId,
      });
    }
  );

  socket.on(
    "create-receive-transport",
    async (data: { roomId: string }, callback) => {
      const room = rooms[data.roomId];
      const user = room?.users[userId];
      if (!room || !user) return;

      const transport = await room.router.createWebRtcTransport(
        webRtcTransportOptions
      );
      user.transports.push({ transport, sender: false });

      callback({
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
    }
  );

  socket.on(
    "create-send-transport",
    async (data: { roomId: string }, callback) => {
      const room = rooms[data.roomId];
      const user = room?.users[userId];
      if (!room || !user) return;

      const transport = await room.router.createWebRtcTransport(
        webRtcTransportOptions
      );
      user.transports.push({ transport, sender: true });

      callback({
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
    }
  );

  socket.on(
    "connect-receive-transport",
    async (
      data: {
        roomId: string;
        transportId: string;
        dtlsParameters: DtlsParameters;
      },
      callback
    ) => {
      const transport = rooms[data.roomId]?.users[userId]?.transports.find(
        (t) => t.transport.id === data.transportId
      );
      if (!transport) return;

      await transport.transport.connect({
        dtlsParameters: data.dtlsParameters,
      });
      callback();
    }
  );

  socket.on(
    "close-producer",
    ({ roomId, producerId }: { roomId: string; producerId: string }) => {
      const user = rooms[roomId]?.users[userId];
      if (!user) return;
      const producer = user.producers.find((p) => p.id === producerId);
      if (!producer) return;
      producer.close();
      user.producers = user.producers.filter((p) => p.id !== producerId);
    }
  );

  socket.on(
    "request-keyframe",
    ({ roomId, producerId }: { roomId: string; producerId: string }) => {
      const room = rooms[roomId];
      if (!room) return;
      for (const u of Object.values(room.users)) {
        for (const consumer of u.consumers) {
          if (consumer.producerId === producerId) {
            consumer.requestKeyFrame().catch(() => {});
          }
        }
      }
    }
  );

  socket.on(
    "consume",
    async (
      data: {
        roomId: string;
        transportId: string;
        producerId: string;
        rtpCapabilities: RtpCapabilities;
      },
      callback
    ) => {
      const room = rooms[data.roomId];
      const user = room?.users[userId];
      const userTransport = user?.transports.find(
        ({ transport }) => transport.id === data.transportId
      );
      if (!room || !user || !userTransport) return;

      if (
        !room.router.canConsume({
          producerId: data.producerId,
          rtpCapabilities: data.rtpCapabilities,
        })
      ) {
        return;
      }

      const consumer = await userTransport.transport.consume({
        producerId: data.producerId,
        rtpCapabilities: data.rtpCapabilities,
        paused: false,
      });

      consumer.on("transportclose", () => {
        console.log("Consumer transport closed");
      });
      consumer.on("producerclose", () => {
        socket.emit("producer-closed", { producerId: data.producerId });
        const currentUser = rooms[data.roomId]?.users[userId];
        if (!currentUser) return;

        userTransport.transport.close();
        currentUser.transports = currentUser.transports.filter(
          (t) => t.transport.id !== userTransport.transport.id
        );
        currentUser.consumers = currentUser.consumers.filter(
          (c) => c.id !== consumer.id
        );
      });

      user.consumers.push(consumer);

      callback({
        id: consumer.id,
        producerId: data.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    }
  );
}

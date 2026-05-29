import type { Server, Socket } from "socket.io";
import type { DtlsParameters, RtpCapabilities, RtpParameters } from "mediasoup/node/lib/types";
import { worker, mediaCodecs, webRtcTransportOptions } from "../mediasoup.js";
import { rooms, getAllProducersInRoom, findProducerInRoom } from "../rooms.js";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { validName, validRoomId } from "../validate.js";

async function admitUser(
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  name: string
): Promise<{
  routerRtpCapabilities: RtpCapabilities;
  transportOptions: any;
  participants: { userId: string; name: string; muted: boolean }[];
}> {
  const room = rooms[roomId];
  const existingParticipants = Object.entries(room.users).map(([uid, u]) => ({
    userId: uid,
    name: u.name,
    muted: u.muted,
  }));
  const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);

  room.users[userId] = {
    name,
    producers: [],
    consumers: [],
    transports: [{ transport, sender: true }],
    muted: false,
  };

  socket.join(roomId);
  socket.to(roomId).emit("user-joined", { userId, name });

  return {
    routerRtpCapabilities: room.router.rtpCapabilities,
    transportOptions: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
    participants: existingParticipants,
  };
}

export function registerSignalingHandlers(io: Server, socket: Socket) {
  const userId = socket.id;

  socket.on(
    "join-room",
    async (data: { roomId: string; name: string; invite?: string }, callback) => {
      const roomId = validRoomId(data?.roomId);
      if (!roomId) {
        callback({ error: "invalid-room-id" });
        return;
      }

      const name = validName(data?.name) ?? "guest";

      if (!rooms[roomId]) {
        if (Object.keys(rooms).length >= config.maxRooms) {
          logger.warn(
            { roomCount: Object.keys(rooms).length, max: config.maxRooms },
            "rejected join: server room cap reached"
          );
          callback({ error: "server-full" });
          return;
        }
        const router = await worker.createRouter({ mediaCodecs });
        rooms[roomId] = {
          router,
          users: {},
          hostUserId: null,
          pending: {},
          invites: {},
        };
      }

      const room = rooms[roomId];

      if (
        Object.keys(room.users).length + Object.keys(room.pending).length >=
        config.maxUsersPerRoom
      ) {
        logger.warn(
          { roomId, occupants: Object.keys(room.users).length, max: config.maxUsersPerRoom },
          "rejected join: room cap reached"
        );
        callback({ error: "room-full" });
        return;
      }

      // First user (or first after host left) becomes host and admitted immediately.
      if (room.hostUserId === null) {
        room.hostUserId = userId;
        const admission = await admitUser(io, socket, roomId, userId, name);
        callback({ ...admission, isHost: true });
        return;
      }

      const inviteToken = typeof data?.invite === "string" ? data.invite : null;
      if (inviteToken) {
        const invite = room.invites[inviteToken];
        if (invite && !invite.used) {
          invite.used = true;
          const admission = await admitUser(io, socket, roomId, userId, name);
          callback({ ...admission, isHost: false, bypassed: true });
          return;
        }
      }

      room.pending[userId] = { name, socketId: userId };
      const hostSocket = io.sockets.sockets.get(room.hostUserId);
      hostSocket?.emit("pending-join-request", { userId, name });
      callback({ status: "pending" });
    }
  );

  socket.on(
    "create-invite",
    (data: { roomId: string }, callback: (res: { token?: string; error?: string }) => void) => {
      const roomId = validRoomId(data?.roomId);
      if (!roomId) {
        callback?.({ error: "invalid-room-id" });
        return;
      }
      const room = rooms[roomId];
      if (!room || room.hostUserId !== userId) {
        callback?.({ error: "not-host" });
        return;
      }
      const tokenBytes = new Uint8Array(18);
      globalThis.crypto.getRandomValues(tokenBytes);
      const token = Buffer.from(tokenBytes)
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      room.invites[token] = { token, used: false, createdAt: Date.now() };
      callback?.({ token });
    }
  );

  socket.on("revoke-invite", (data: { roomId: string; token: string }) => {
    const roomId = validRoomId(data?.roomId);
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room || room.hostUserId !== userId) return;
    delete room.invites[data.token];
  });

  socket.on("approve-join", async (data: { roomId: string; userId: string }, callback) => {
    const roomId = validRoomId(data?.roomId);
    if (!roomId) {
      callback?.({ error: "invalid-room-id" });
      return;
    }
    const room = rooms[roomId];
    if (!room || room.hostUserId !== userId) {
      callback?.({ error: "not-host" });
      return;
    }
    const pending = room.pending[data.userId];
    if (!pending) {
      callback?.({ error: "not-pending" });
      return;
    }
    const pendingSocket = io.sockets.sockets.get(pending.socketId);
    if (!pendingSocket) {
      delete room.pending[data.userId];
      callback?.({ error: "socket-gone" });
      return;
    }

    delete room.pending[data.userId];
    const admission = await admitUser(io, pendingSocket, roomId, data.userId, pending.name);
    pendingSocket.emit("join-approved", admission);
    callback?.({ ok: true });
  });

  socket.on("deny-join", (data: { roomId: string; userId: string }) => {
    const roomId = validRoomId(data?.roomId);
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room || room.hostUserId !== userId) return;
    const pending = room.pending[data.userId];
    if (!pending) return;
    const pendingSocket = io.sockets.sockets.get(pending.socketId);
    pendingSocket?.emit("join-denied");
    delete room.pending[data.userId];
  });

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
        appData?: Record<string, unknown>;
      },
      callback
    ) => {
      const user = rooms[data.roomId]?.users[userId];
      const transport = user?.transports.find((t) => t.transport.id === data.transportId);
      if (!user || !transport) return;

      const producer = await transport.transport.produce({
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData ?? {},
      });
      user.producers.push(producer);

      const otherProducers = getAllProducersInRoom(data.roomId, userId);

      callback({ id: producer.id, otherProducers });
      socket.to(data.roomId).emit("new-producer", {
        producerId: producer.id,
        name: user.name,
        userId,
        appData: producer.appData,
      });
    }
  );

  socket.on("create-receive-transport", async (data: { roomId: string }, callback) => {
    const room = rooms[data.roomId];
    const user = room?.users[userId];
    if (!room || !user) return;

    const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
    user.transports.push({ transport, sender: false });

    callback({
      transportOptions: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  });

  socket.on("create-send-transport", async (data: { roomId: string }, callback) => {
    const room = rooms[data.roomId];
    const user = room?.users[userId];
    if (!room || !user) return;

    const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
    user.transports.push({ transport, sender: true });

    callback({
      transportOptions: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  });

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

  socket.on("close-producer", ({ roomId, producerId }: { roomId: string; producerId: string }) => {
    const user = rooms[roomId]?.users[userId];
    if (!user) return;
    const producer = user.producers.find((p) => p.id === producerId);
    if (!producer) return;
    producer.close();
    user.producers = user.producers.filter((p) => p.id !== producerId);
  });

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
        logger.debug({ consumerId: consumer.id }, "consumer transport closed");
      });
      consumer.on("producerclose", () => {
        socket.emit("producer-closed", { producerId: data.producerId });
        const currentUser = rooms[data.roomId]?.users[userId];
        if (!currentUser) return;

        userTransport.transport.close();
        currentUser.transports = currentUser.transports.filter(
          (t) => t.transport.id !== userTransport.transport.id
        );
        currentUser.consumers = currentUser.consumers.filter((c) => c.id !== consumer.id);
      });

      user.consumers.push(consumer);

      const producer = findProducerInRoom(data.roomId, data.producerId);
      callback({
        id: consumer.id,
        producerId: data.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        appData: (producer?.appData ?? {}) as Record<string, unknown>,
      });
    }
  );
}

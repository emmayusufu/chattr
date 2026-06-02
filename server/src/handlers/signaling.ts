import type { Server, Socket } from "socket.io";
import type { DtlsParameters, RtpCapabilities, RtpParameters } from "mediasoup/node/lib/types";
import { worker, mediaCodecs, webRtcTransportOptions } from "../mediasoup.js";
import { rooms, getAllProducersInRoom, findProducerInRoom, userIdForProducer } from "../rooms.js";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { validId, validName, validRoomId } from "../validate.js";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_ROOM = 20;

async function admitUser(
  socket: Socket,
  roomId: string,
  userId: string,
  name: string,
  sessionToken: string
): Promise<{
  routerRtpCapabilities: RtpCapabilities;
  transportOptions: any;
  participants: { userId: string; name: string; muted: boolean; handRaised: boolean }[];
}> {
  const room = rooms[roomId];
  const existingParticipants = Object.entries(room.users)
    .filter(([, u]) => !u.disconnected)
    .map(([uid, u]) => ({
      userId: uid,
      name: u.name,
      muted: u.muted,
      handRaised: u.handRaised,
    }));
  const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
  transport.setMaxIncomingBitrate(5_000_000).catch(() => {});

  room.users[userId] = {
    name,
    producers: [],
    consumers: [],
    transports: [{ transport, sender: true }],
    muted: false,
    handRaised: false,
    socketId: socket.id,
    sessionToken,
    disconnected: false,
    graceTimer: null,
  };

  socket.data.participantId = userId;
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
  // Identity is the stable participantId, resolved once join-room runs. Until
  // then it falls back to socket.id (legacy clients that send no participantId).
  let userId = socket.id;

  socket.on(
    "join-room",
    async (
      data: {
        roomId: string;
        name: string;
        invite?: string;
        participantId?: string;
        sessionToken?: string;
      },
      callback
    ) => {
      const roomId = validRoomId(data?.roomId);
      if (!roomId) {
        callback({ error: "invalid-room-id" });
        return;
      }

      const name = validName(data?.name) ?? "guest";
      userId = validId(data?.participantId) ?? socket.id;
      const sessionToken = validId(data?.sessionToken) ?? socket.id;
      socket.data.participantId = userId;

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
        const audioLevelObserver = await router.createAudioLevelObserver({
          maxEntries: 1,
          threshold: -70,
          interval: 800,
        });
        audioLevelObserver.on("volumes", (volumes) => {
          const producerId = volumes[0]?.producer?.id;
          const speaker = producerId ? userIdForProducer(roomId, producerId) : null;
          io.to(roomId).emit("dominant-speaker", { userId: speaker });
        });
        audioLevelObserver.on("silence", () => {
          io.to(roomId).emit("dominant-speaker", { userId: null });
        });
        rooms[roomId] = {
          router,
          audioLevelObserver,
          users: {},
          hostUserId: null,
          pending: {},
          invites: {},
        };
      }

      const room = rooms[roomId];

      // Reconnect inside the grace window: verify the secret token, then resume
      // in place (fresh transport, host preserved) instead of bouncing to pending.
      const existing = room.users[userId];
      if (existing) {
        if (existing.sessionToken !== sessionToken) {
          callback({ error: "identity-conflict" });
          return;
        }
        if (existing.graceTimer) {
          clearTimeout(existing.graceTimer);
          existing.graceTimer = null;
        }
        // The old media is dead; close it so other clients clean up their stale
        // consumers. The reconnecting client re-produces on the new transport.
        for (const producer of existing.producers) producer.close();
        for (const consumer of existing.consumers) consumer.close();
        for (const { transport } of existing.transports) transport.close();

        const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
        transport.setMaxIncomingBitrate(5_000_000).catch(() => {});
        existing.producers = [];
        existing.consumers = [];
        existing.transports = [{ transport, sender: true }];
        existing.socketId = socket.id;
        existing.disconnected = false;
        existing.name = name;

        socket.join(roomId);
        callback({
          routerRtpCapabilities: room.router.rtpCapabilities,
          transportOptions: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
          participants: Object.entries(room.users)
            .filter(([uid, u]) => uid !== userId && !u.disconnected)
            .map(([uid, u]) => ({
              userId: uid,
              name: u.name,
              muted: u.muted,
              handRaised: u.handRaised,
            })),
          isHost: room.hostUserId === userId,
          reconnected: true,
        });

        // The host's pending requests went to their now-dead socket; replay them
        // so anyone who knocked during the grace window is still approvable.
        if (room.hostUserId === userId) {
          for (const [pendingId, p] of Object.entries(room.pending)) {
            socket.emit("pending-join-request", { userId: pendingId, name: p.name });
          }
        }
        return;
      }

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

      if (room.hostUserId === null) {
        room.hostUserId = userId;
        const admission = await admitUser(socket, roomId, userId, name, sessionToken);
        callback({ ...admission, isHost: true });
        return;
      }

      const inviteToken = typeof data?.invite === "string" ? data.invite : null;
      if (inviteToken) {
        const invite = room.invites[inviteToken];
        const fresh = invite && Date.now() - invite.createdAt < INVITE_TTL_MS;
        if (invite && !fresh) delete room.invites[inviteToken];
        if (invite && !invite.used && fresh) {
          invite.used = true;
          const admission = await admitUser(socket, roomId, userId, name, sessionToken);
          callback({ ...admission, isHost: false, bypassed: true });
          return;
        }
      }

      room.pending[userId] = { name, socketId: socket.id, sessionToken };
      const hostSocket = io.sockets.sockets.get(room.users[room.hostUserId]?.socketId ?? "");
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
      for (const [t, inv] of Object.entries(room.invites)) {
        if (Date.now() - inv.createdAt >= INVITE_TTL_MS) delete room.invites[t];
      }
      if (Object.keys(room.invites).length >= MAX_INVITES_PER_ROOM) {
        callback?.({ error: "too-many-invites" });
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
    const admission = await admitUser(
      pendingSocket,
      roomId,
      data.userId,
      pending.name,
      pending.sessionToken
    );
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
      if (!user || !transport) {
        callback?.({ error: "not-ready" });
        return;
      }

      const producer = await transport.transport.produce({
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData ?? {},
      });
      user.producers.push(producer);

      if (data.kind === "audio") {
        rooms[data.roomId]?.audioLevelObserver
          .addProducer({ producerId: producer.id })
          .catch(() => {});
      }

      callback({ id: producer.id });
      socket.to(data.roomId).emit("new-producer", {
        producerId: producer.id,
        name: user.name,
        userId,
        appData: producer.appData,
      });
    }
  );

  // The live producer set, fetched once the client is ready to receive, so no
  // producer slips through the join-setup window.
  socket.on("get-producers", (data: { roomId: string }, callback) => {
    const room = rooms[data?.roomId];
    const user = room?.users[userId];
    if (!user) {
      callback?.({ error: "not-ready" });
      return;
    }
    // Include the authoritative roster of currently-connected participants so the
    // client can heal a missed user-left/joined on a flaky link, not just missed
    // media. Grace-pending (disconnected) users are excluded: their tiles should
    // clear, not linger.
    callback({
      producers: getAllProducersInRoom(data.roomId, userId),
      participants: Object.entries(room.users)
        .filter(([uid, u]) => uid !== userId && !u.disconnected)
        .map(([uid, u]) => ({
          userId: uid,
          name: u.name,
          muted: u.muted,
          handRaised: u.handRaised,
        })),
    });
  });

  // Authoritative waiting-room list for the host to reconcile against, in case a
  // pending-join-request push was dropped on a poor connection.
  socket.on("get-pending", (data: { roomId: string }, callback) => {
    const room = rooms[data?.roomId];
    if (!room || room.hostUserId !== userId) {
      callback?.({ error: "not-host" });
      return;
    }
    callback({
      pending: Object.entries(room.pending).map(([uid, p]) => ({ userId: uid, name: p.name })),
    });
  });

  socket.on("create-receive-transport", async (data: { roomId: string }, callback) => {
    const room = rooms[data.roomId];
    const user = room?.users[userId];
    if (!room || !user) {
      callback?.({ error: "not-ready" });
      return;
    }

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
    if (!room || !user) {
      callback?.({ error: "not-ready" });
      return;
    }

    const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
    transport.setMaxIncomingBitrate(5_000_000).catch(() => {});
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

  socket.on("restart-ice", async (data: { roomId: string; transportId: string }, callback) => {
    const entry = rooms[data?.roomId]?.users[userId]?.transports.find(
      (t) => t.transport.id === data?.transportId
    );
    if (!entry) {
      callback?.({ error: "not-found" });
      return;
    }
    const iceParameters = await entry.transport.restartIce();
    callback?.({ iceParameters });
  });

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

  // Guard on the current state so the client can safely re-assert visibility on
  // every reconcile tick: an unchanged consumer is a no-op (and no redundant
  // keyframe), only a real transition acts.
  socket.on("pause-consumer", ({ roomId, producerId }: { roomId: string; producerId: string }) => {
    const user = rooms[roomId]?.users[userId];
    if (!user) return;
    for (const c of user.consumers) {
      if (c.producerId === producerId && !c.paused) c.pause().catch(() => {});
    }
  });

  socket.on("resume-consumer", ({ roomId, producerId }: { roomId: string; producerId: string }) => {
    const user = rooms[roomId]?.users[userId];
    if (!user) return;
    for (const c of user.consumers) {
      if (c.producerId === producerId && c.paused) {
        c.resume()
          .then(() => c.requestKeyFrame())
          .catch(() => {});
      }
    }
  });

  socket.on(
    "set-preferred-layers",
    (data: { roomId: string; producerId: string; spatialLayer: number; temporalLayer: number }) => {
      if (typeof data?.spatialLayer !== "number") return;
      const user = rooms[data.roomId]?.users[userId];
      if (!user) return;
      for (const c of user.consumers) {
        if (c.producerId === data.producerId && c.kind === "video") {
          c.setPreferredLayers({
            spatialLayer: data.spatialLayer,
            temporalLayer: data.temporalLayer,
          }).catch(() => {});
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
      if (!room || !user || !userTransport) {
        callback?.({ error: "not-ready" });
        return;
      }

      if (
        !room.router.canConsume({
          producerId: data.producerId,
          rtpCapabilities: data.rtpCapabilities,
        })
      ) {
        callback?.({ error: "cannot-consume" });
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
        // Close only this consumer, not the shared recv transport (which now
        // carries every other consumer too).
        consumer.close();
        const currentUser = rooms[data.roomId]?.users[userId];
        if (currentUser) {
          currentUser.consumers = currentUser.consumers.filter((c) => c.id !== consumer.id);
        }
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

import type { Server, Socket } from "socket.io";
import { rooms, messages } from "../rooms.js";

const NETWORK_GRACE_MS = 15_000;

function isPageUnload(reason: string): boolean {
  return reason === "client namespace disconnect" || reason === "server namespace disconnect";
}

/** The participant's final teardown; runs when the grace window expires. */
export function finalizeDeparture(io: Server, roomId: string, participantId: string) {
  const room = rooms[roomId];
  if (!room) return;
  const user = room.users[participantId];
  if (!user) return;

  const wasHost = room.hostUserId === participantId;

  for (const producer of user.producers) producer.close();
  for (const consumer of user.consumers) consumer.close();
  for (const { transport } of user.transports) transport.close();
  delete room.users[participantId];

  io.to(roomId).emit("user-left", { userId: participantId });

  if (wasHost) {
    // Host gone for good. Hand the room to the oldest still-connected
    // participant (join order is preserved object-key order) so a host's
    // dropped connection doesn't end everyone's meeting.
    const successor = Object.entries(room.users).find(([, u]) => !u.disconnected);
    if (successor) {
      room.hostUserId = successor[0];
      io.to(roomId).emit("host-changed", { userId: successor[0] });
    } else {
      // No one connected is left: end the room.
      for (const pending of Object.values(room.pending)) {
        const s = io.sockets.sockets.get(pending.socketId);
        s?.emit("join-denied");
        s?.disconnect();
      }
      room.pending = {};

      io.to(roomId).emit("host-left");
      for (const other of Object.values(room.users)) {
        if (other.graceTimer) clearTimeout(other.graceTimer);
        for (const producer of other.producers) producer.close();
        for (const consumer of other.consumers) consumer.close();
        for (const { transport } of other.transports) transport.close();
        io.sockets.sockets.get(other.socketId)?.disconnect();
      }
      room.users = {};
      room.hostUserId = null;
    }
  }

  if (Object.keys(room.users).length === 0 && Object.keys(room.pending).length === 0) {
    room.router.close();
    delete rooms[roomId];
    delete messages[roomId];
  }
}

export function removeParticipant(io: Server, roomId: string, participantId: string) {
  const user = rooms[roomId]?.users[participantId];
  if (!user) return;
  if (user.graceTimer) clearTimeout(user.graceTimer);
  finalizeDeparture(io, roomId, participantId);
}

export function registerDisconnectHandler(io: Server, socket: Socket) {
  socket.on("leave-room", (_data: unknown, callback?: () => void) => {
    const participantId: string | undefined = socket.data.participantId;
    const roomId = participantId
      ? Object.keys(rooms).find((id) => participantId in rooms[id].users)
      : undefined;
    if (participantId && roomId) removeParticipant(io, roomId, participantId);
    callback?.();
  });

  socket.on("disconnect", (reason: string) => {
    const participantId: string | undefined = socket.data.participantId;
    if (!participantId) return;

    const roomId = Object.keys(rooms).find(
      (id) => participantId in rooms[id].users || participantId in rooms[id].pending
    );
    if (!roomId) return;
    const room = rooms[roomId];

    if (room.pending[participantId]) {
      delete room.pending[participantId];
      const hostSocketId = room.hostUserId ? room.users[room.hostUserId]?.socketId : null;
      if (hostSocketId) {
        io.sockets.sockets.get(hostSocketId)?.emit("pending-canceled", { userId: participantId });
      }
      return;
    }

    const user = room.users[participantId];
    if (!user) return;
    // A stale socket from before a reconnect must not start a grace timer for a
    // participant who has already returned on a newer socket.
    if (user.socketId !== socket.id) return;

    if (isPageUnload(reason)) {
      removeParticipant(io, roomId, participantId);
      return;
    }

    user.disconnected = true;
    if (user.graceTimer) clearTimeout(user.graceTimer);
    user.graceTimer = setTimeout(
      () => finalizeDeparture(io, roomId, participantId),
      NETWORK_GRACE_MS
    );
  });
}

import type { Server, Socket } from "socket.io";
import { rooms, messages } from "../rooms.js";

/**
 * How long a dropped participant's slot is held open so a brief blip reconnects
 * in place instead of ending the call (host) or bouncing them to pending (guest).
 */
const GRACE_MS = 30_000;

/** The participant's final teardown; runs when the grace window expires. */
function finalizeDeparture(io: Server, roomId: string, participantId: string) {
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

  // Host gone for good: end the room. Tear everyone down now rather than leaving
  // them on their own grace timers, since the call is over.
  if (wasHost) {
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

  if (Object.keys(room.users).length === 0 && Object.keys(room.pending).length === 0) {
    room.router.close();
    delete rooms[roomId];
    delete messages[roomId];
  }
}

export function registerDisconnectHandler(io: Server, socket: Socket) {
  socket.on("disconnect", () => {
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

    user.disconnected = true;
    if (user.graceTimer) clearTimeout(user.graceTimer);
    user.graceTimer = setTimeout(() => finalizeDeparture(io, roomId, participantId), GRACE_MS);
  });
}

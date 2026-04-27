import type { Server, Socket } from "socket.io";
import { rooms, messages } from "../rooms.js";

export function registerDisconnectHandler(io: Server, socket: Socket) {
  const userId = socket.id;

  socket.on("disconnect", () => {
    const roomId = Object.keys(rooms).find(
      (id) => userId in rooms[id].users || userId in rooms[id].pending
    );
    if (!roomId) return;
    const room = rooms[roomId];

    // Pending user disconnected before being approved.
    if (room.pending[userId]) {
      delete room.pending[userId];
      if (room.hostUserId) {
        io.sockets.sockets.get(room.hostUserId)?.emit("pending-canceled", { userId });
      }
      return;
    }

    const user = room.users[userId];
    if (user) {
      for (const producer of user.producers) producer.close();
      for (const consumer of user.consumers) consumer.close();
      for (const { transport } of user.transports) transport.close();
      delete room.users[userId];
    }

    socket.to(roomId).emit("user-left", { userId });

    // If the host left, the room ends: deny pending and kick everyone.
    if (room.hostUserId === userId) {
      for (const pending of Object.values(room.pending)) {
        const s = io.sockets.sockets.get(pending.socketId);
        s?.emit("join-denied");
        s?.disconnect();
      }
      room.pending = {};

      io.to(roomId).emit("host-left");
      for (const otherUserId of Object.keys(room.users)) {
        io.sockets.sockets.get(otherUserId)?.disconnect();
      }
      room.hostUserId = null;
    }

    if (Object.keys(room.users).length === 0 && Object.keys(room.pending).length === 0) {
      room.router.close();
      delete rooms[roomId];
      delete messages[roomId];
    }
  });
}

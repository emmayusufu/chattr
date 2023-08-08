import type { Socket } from "socket.io";
import { rooms, messages } from "../rooms.js";

export function registerDisconnectHandler(socket: Socket) {
  const userId = socket.id;

  socket.on("disconnect", () => {
    const roomId = Object.keys(rooms).find(
      (id) => userId in rooms[id].users
    );
    if (!roomId) return;

    const user = rooms[roomId].users[userId];

    for (const producer of user.producers) producer.close();
    for (const consumer of user.consumers) consumer.close();
    for (const { transport } of user.transports) transport.close();

    delete rooms[roomId].users[userId];

    socket.to(roomId).emit("user-left", { userId });

    if (Object.keys(rooms[roomId].users).length === 0) {
      rooms[roomId].router.close();
      delete rooms[roomId];
      delete messages[roomId];
    }
  });
}

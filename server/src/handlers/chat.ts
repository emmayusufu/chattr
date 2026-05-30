import type { Server, Socket } from "socket.io";
import { messages, rooms } from "../rooms.js";
import { validMessage, validRoomId } from "../validate.js";

const MAX_HISTORY = 200;

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on("send-chat-message", (data) => {
    const roomId = validRoomId(data?.roomId);
    const message = validMessage(data?.message);
    if (!roomId || !message) return;

    // Members only, and the sender is the server-side identity, never client-supplied.
    const user = rooms[roomId]?.users[socket.data.participantId];
    if (!user) return;

    const chatMessage = { sender: user.name, message, timestamp: Date.now() };
    const roomMessages = messages[roomId] ?? [];
    roomMessages.push(chatMessage);
    if (roomMessages.length > MAX_HISTORY) {
      roomMessages.splice(0, roomMessages.length - MAX_HISTORY);
    }
    messages[roomId] = roomMessages;
    io.to(roomId).emit("receive-chat-message", chatMessage);
  });

  socket.on("get-chat-history", (rawRoomId: unknown) => {
    const roomId = validRoomId(rawRoomId);
    if (!roomId) return;
    if (!rooms[roomId]?.users[socket.data.participantId]) return;
    socket.emit("receive-chat-history", messages[roomId] ?? []);
  });
}

import type { Server, Socket } from "socket.io";
import { messages } from "../rooms.js";
import { validMessage, validName, validRoomId } from "../validate.js";

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on("send-chat-message", (data) => {
    const roomId = validRoomId(data?.roomId);
    const message = validMessage(data?.message);
    if (!roomId || !message) return;

    const sender = validName(data?.sender) ?? "guest";

    const chatMessage = { sender, message, timestamp: Date.now() };
    const roomMessages = messages[roomId] ?? [];
    roomMessages.push(chatMessage);
    messages[roomId] = roomMessages;
    io.to(roomId).emit("receive-chat-message", chatMessage);
  });

  socket.on("get-chat-history", (rawRoomId: unknown) => {
    const roomId = validRoomId(rawRoomId);
    if (!roomId) return;
    socket.emit("receive-chat-history", messages[roomId] ?? []);
  });
}

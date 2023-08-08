import type { Server, Socket } from "socket.io";
import { messages } from "../rooms.js";

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on("send-chat-message", (data) => {
    const { roomId, message, sender } = data;
    const chatMessage = { sender, message, timestamp: Date.now() };
    const roomMessages = messages[roomId] ?? [];
    roomMessages.push(chatMessage);
    messages[roomId] = roomMessages;
    io.to(roomId).emit("receive-chat-message", chatMessage);
  });

  socket.on("get-chat-history", (roomId: string) => {
    socket.emit("receive-chat-history", messages[roomId] ?? []);
  });
}

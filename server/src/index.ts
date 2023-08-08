import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerSignalingHandlers } from "./handlers/signaling.js";
import { registerDisconnectHandler } from "./handlers/disconnect.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket: Socket) => {
  registerChatHandlers(io, socket);
  registerSignalingHandlers(socket);
  registerDisconnectHandler(socket);
});

httpServer.listen(3000, () => {
  console.log("Server listening on port 3000 🚀");
});

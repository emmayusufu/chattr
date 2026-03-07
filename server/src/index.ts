import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerSignalingHandlers } from "./handlers/signaling.js";
import { registerDisconnectHandler } from "./handlers/disconnect.js";
import { config } from "./config.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
});

io.on("connection", (socket: Socket) => {
  registerChatHandlers(io, socket);
  registerSignalingHandlers(socket);
  registerDisconnectHandler(socket);
});

httpServer.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

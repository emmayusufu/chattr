import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerSignalingHandlers } from "./handlers/signaling.js";
import { registerDisconnectHandler } from "./handlers/disconnect.js";
import { registerScratchpadHandlers } from "./handlers/scratchpad.js";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { checkRate, clearRate } from "./rate-limit.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
});

io.on("connection", (socket: Socket) => {
  logger.debug({ socketId: socket.id }, "socket connected");

  socket.use(([event], next) => {
    if (!checkRate(socket.id, event)) {
      logger.warn({ socketId: socket.id, event }, "rate limit exceeded");
      return next(new Error("rate limit"));
    }
    next();
  });

  socket.on("disconnect", () => clearRate(socket.id));

  registerChatHandlers(io, socket);
  registerSignalingHandlers(io, socket);
  registerDisconnectHandler(io, socket);
  registerScratchpadHandlers(io, socket);
});

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, cors: config.clientOrigin }, "server listening");
});

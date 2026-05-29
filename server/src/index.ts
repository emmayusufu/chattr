import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerSignalingHandlers } from "./handlers/signaling.js";
import { registerDisconnectHandler } from "./handlers/disconnect.js";
import { rooms } from "./rooms.js";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { checkRate, clearRate } from "./rate-limit.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowed = config.clientOrigin;
      if (!origin || allowed === "*" || origin === allowed || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  },
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

  socket.on("transcript-segment", (data: { roomId?: string; segment?: unknown }) => {
    if (typeof data?.roomId === "string" && data.segment) {
      socket.to(data.roomId).emit("transcript-segment", { segment: data.segment });
    }
  });

  socket.on("start-transcription", (data: { roomId?: string }) => {
    if (typeof data?.roomId === "string") {
      socket.to(data.roomId).emit("start-transcription");
    }
  });

  socket.on("stop-transcription", (data: { roomId?: string }) => {
    if (typeof data?.roomId === "string") {
      socket.to(data.roomId).emit("stop-transcription");
    }
  });

  socket.on("mute-state", (data: { roomId?: string; muted?: boolean }) => {
    if (typeof data?.roomId !== "string" || typeof data?.muted !== "boolean") return;
    const user = rooms[data.roomId]?.users[socket.id];
    if (user) user.muted = data.muted;
    socket.to(data.roomId).emit("mute-state", { userId: socket.id, muted: data.muted });
  });

});

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, cors: config.clientOrigin }, "server listening");
});

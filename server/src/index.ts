import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerSignalingHandlers } from "./handlers/signaling.js";
import { registerDisconnectHandler, removeParticipant } from "./handlers/disconnect.js";
import { rooms } from "./rooms.js";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { checkRate, clearRate } from "./rate-limit.js";
import { validRoomId } from "./validate.js";

if (process.env.NODE_ENV === "production" && config.clientOrigin === "*") {
  logger.warn(
    "CLIENT_ORIGIN is unset in production; CORS is wide open. Set it to the public origin."
  );
}

const isMember = (roomId: string, participantId: string | undefined): boolean =>
  !!participantId && !!rooms[roomId]?.users[participantId];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // Ping more often so a silently-dead socket (a closed tab whose close frame
  // never arrived) is noticed in ~30s instead of the ~45s default, which is what
  // made a departed tile linger. pingTimeout stays generous so a laggy-but-alive
  // mobile link isn't wrongly dropped mid-call.
  pingInterval: 10_000,
  pingTimeout: 20_000,
  cors: {
    origin: (origin, callback) => {
      const allowed = config.clientOrigin;
      if (
        !origin ||
        allowed === "*" ||
        origin === allowed ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  },
});

app.post("/leave", express.text({ type: () => true, limit: "1kb" }), (req, res) => {
  res.status(204).end();
  let data: { roomId?: string; participantId?: string; sessionToken?: string };
  try {
    data = JSON.parse(typeof req.body === "string" && req.body ? req.body : "{}");
  } catch {
    return;
  }
  const roomId = validRoomId(data.roomId);
  if (!roomId || !data.participantId || !data.sessionToken) return;
  const user = rooms[roomId]?.users[data.participantId];
  if (!user || user.sessionToken !== data.sessionToken) return;
  removeParticipant(io, roomId, data.participantId);
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

  socket.on("mute-state", (data: { roomId?: string; muted?: boolean }) => {
    const roomId = validRoomId(data?.roomId);
    const participantId = socket.data.participantId;
    if (!roomId || typeof data?.muted !== "boolean" || !isMember(roomId, participantId)) return;
    rooms[roomId].users[participantId].muted = data.muted;
    socket.to(roomId).emit("mute-state", { userId: participantId, muted: data.muted });
  });

  socket.on("hand-state", (data: { roomId?: string; handRaised?: boolean }) => {
    const roomId = validRoomId(data?.roomId);
    const participantId = socket.data.participantId;
    if (!roomId || typeof data?.handRaised !== "boolean" || !isMember(roomId, participantId))
      return;
    rooms[roomId].users[participantId].handRaised = data.handRaised;
    socket.to(roomId).emit("hand-state", { userId: participantId, handRaised: data.handRaised });
  });
});

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, cors: config.clientOrigin }, "server listening");
});

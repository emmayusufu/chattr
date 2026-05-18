import type { Server, Socket } from "socket.io";
import { appendScratchpadUpdate, loadScratchpadLog } from "../db.js";
import { rooms } from "../rooms.js";
import { validRoomId } from "../validate.js";

const MAX_UPDATE_BYTES = 256_000;

function isAdmitted(roomId: string, socketId: string): boolean {
  const room = rooms[roomId];
  return !!(room && room.users[socketId]);
}

function toUint8(raw: unknown): Uint8Array | null {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Buffer.isBuffer(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  return null;
}

export function registerScratchpadHandlers(_io: Server, socket: Socket) {
  socket.on(
    "scratchpad-sync",
    (data: unknown, ack?: (response: { updates: Uint8Array[] }) => void) => {
      if (typeof data !== "object" || data === null || typeof ack !== "function") return;
      const { roomId: rawRoomId } = data as Record<string, unknown>;
      const roomId = validRoomId(rawRoomId);
      if (!roomId) return;
      if (!isAdmitted(roomId, socket.id)) {
        ack({ updates: [] });
        return;
      }
      if (!socket.rooms.has(roomId)) socket.join(roomId);

      const updates = loadScratchpadLog(roomId);
      ack({ updates });
    }
  );

  socket.on("scratchpad-awareness", (data: unknown) => {
    if (typeof data !== "object" || data === null) return;
    const { roomId: rawRoomId, update: rawUpdate } = data as Record<string, unknown>;
    const roomId = validRoomId(rawRoomId);
    if (!roomId) return;
    if (!isAdmitted(roomId, socket.id)) return;
    if (!socket.rooms.has(roomId)) socket.join(roomId);

    const u8 = toUint8(rawUpdate);
    if (!u8 || u8.byteLength === 0 || u8.byteLength > MAX_UPDATE_BYTES) return;

    socket.to(roomId).emit("scratchpad-awareness", { update: u8 });
  });

  socket.on("scratchpad-update", (data: unknown) => {
    if (typeof data !== "object" || data === null) return;
    const { roomId: rawRoomId, update: rawUpdate } = data as Record<string, unknown>;
    const roomId = validRoomId(rawRoomId);
    if (!roomId) return;
    if (!isAdmitted(roomId, socket.id)) return;
    if (!socket.rooms.has(roomId)) socket.join(roomId);

    const u8 = toUint8(rawUpdate);
    if (!u8 || u8.byteLength === 0 || u8.byteLength > MAX_UPDATE_BYTES) return;

    appendScratchpadUpdate(roomId, u8);
    socket.to(roomId).emit("scratchpad-update", { update: u8 });
  });
}

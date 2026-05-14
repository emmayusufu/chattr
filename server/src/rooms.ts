import type { Producer } from "mediasoup/node/lib/types";
import type { ChatMessage, Room } from "./types.js";

export const rooms: Record<string, Room> = {};
export const messages: Record<string, ChatMessage[]> = {};

export type RemoteProducer = {
  producerId: string;
  name: string;
  userId: string;
  appData: Record<string, unknown>;
};

export function getAllProducersInRoom(roomId: string, excludeUserId = ""): RemoteProducer[] {
  const room = rooms[roomId];
  if (!room) return [];

  return Object.entries(room.users)
    .filter(([userId]) => userId !== excludeUserId)
    .flatMap(([uid, user]) =>
      user.producers.map((producer) => ({
        producerId: producer.id,
        name: user.name,
        userId: uid,
        appData: (producer.appData ?? {}) as Record<string, unknown>,
      }))
    );
}

export function findProducerInRoom(roomId: string, producerId: string): Producer | undefined {
  const room = rooms[roomId];
  if (!room) return undefined;
  for (const u of Object.values(room.users)) {
    const p = u.producers.find((p) => p.id === producerId);
    if (p) return p;
  }
  return undefined;
}

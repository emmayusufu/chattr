import type { ChatMessage, Room } from "./types.js";

export const rooms: Record<string, Room> = {};
export const messages: Record<string, ChatMessage[]> = {};

export type RemoteProducer = {
  producerId: string;
  name: string;
  userId: string;
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
      }))
    );
}

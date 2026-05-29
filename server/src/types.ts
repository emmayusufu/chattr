import type { Consumer, Producer, Router, WebRtcTransport } from "mediasoup/node/lib/types";

export type ChatMessage = {
  sender: unknown;
  message: unknown;
  timestamp: number;
};

export type UserTransport = {
  sender: boolean;
  transport: WebRtcTransport;
};

export type User = {
  name: string;
  producers: Producer[];
  consumers: Consumer[];
  transports: UserTransport[];
  muted: boolean;
};

export type PendingJoiner = {
  name: string;
  socketId: string;
};

export type Invite = {
  token: string;
  used: boolean;
  createdAt: number;
};

export type Room = {
  router: Router;
  users: Record<string, User>;
  hostUserId: string | null;
  pending: Record<string, PendingJoiner>;
  invites: Record<string, Invite>;
};

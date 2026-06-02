import type {
  AudioLevelObserver,
  Consumer,
  Producer,
  Router,
  WebRtcTransport,
} from "mediasoup/node/lib/types";

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
  handRaised: boolean;
  /**
   * Identity is the stable, client-generated participantId (the key in
   * room.users). socketId is the current live socket and changes on reconnect.
   */
  socketId: string;
  sessionToken: string;
  disconnected: boolean;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

export type PendingJoiner = {
  name: string;
  socketId: string;
  sessionToken: string;
};

export type Invite = {
  token: string;
  used: boolean;
  createdAt: number;
};

export type Room = {
  router: Router;
  audioLevelObserver: AudioLevelObserver;
  users: Record<string, User>;
  hostUserId: string | null;
  pending: Record<string, PendingJoiner>;
  invites: Record<string, Invite>;
};

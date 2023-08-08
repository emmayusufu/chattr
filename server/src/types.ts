import type {
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
};

export type Room = {
  router: Router;
  users: Record<string, User>;
};

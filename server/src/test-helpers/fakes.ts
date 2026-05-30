import { vi } from "vitest";
import type { Room, User } from "../../src/types.js";

export type Handler = (...args: any[]) => void;

export type FakeSocket = {
  id: string;
  handlers: Record<string, Handler>;
  on: (event: string, handler: Handler) => void;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  data: Record<string, unknown>;
};

export type FakeIo = {
  to: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  sockets: { sockets: Map<string, FakeSocket> };
  register: (socket: FakeSocket) => void;
};

export function makeFakeSocket(id = "socket-1"): FakeSocket {
  const handlers: Record<string, Handler> = {};
  return {
    id,
    handlers,
    on(event, handler) {
      handlers[event] = handler;
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
    data: {},
  };
}

export function makeFakeIo(): FakeIo {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const sockets = { sockets: new Map<string, FakeSocket>() };
  return {
    to,
    emit,
    sockets,
    register(socket) {
      sockets.sockets.set(socket.id, socket);
    },
  };
}

export function fakeProducer(id: string) {
  return { id, appData: {}, close: vi.fn() } as any;
}

export function fakeRoom(): Room {
  return {
    router: { close: vi.fn() } as any,
    audioLevelObserver: {} as any,
    users: {},
    hostUserId: null,
    pending: {},
    invites: {},
  };
}

export function fakeUser(name: string, producerIds: string[] = []): User {
  return {
    name,
    producers: producerIds.map(fakeProducer),
    consumers: [],
    transports: [],
    muted: false,
    socketId: "socket-" + name,
    sessionToken: "token-" + name,
    disconnected: false,
    graceTimer: null,
  };
}

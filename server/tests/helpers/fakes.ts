import { vi } from "vitest";
import type { Room, User } from "../../src/types.js";

export type Handler = (...args: any[]) => void;

export type FakeSocket = {
  handlers: Record<string, Handler>;
  on: (event: string, handler: Handler) => void;
  emit: ReturnType<typeof vi.fn>;
  data: Record<string, unknown>;
};

export type FakeIo = {
  to: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
};

export function makeFakeSocket(): FakeSocket {
  const handlers: Record<string, Handler> = {};
  return {
    handlers,
    on(event, handler) {
      handlers[event] = handler;
    },
    emit: vi.fn(),
    data: {},
  };
}

export function makeFakeIo(): FakeIo {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { to, emit };
}

export function fakeProducer(id: string) {
  return { id } as any;
}

export function fakeRoom(): Room {
  return { router: {} as any, users: {} };
}

export function fakeUser(name: string, producerIds: string[] = []): User {
  return {
    name,
    producers: producerIds.map(fakeProducer),
    consumers: [],
    transports: [],
  };
}

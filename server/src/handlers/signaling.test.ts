import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the mediasoup module so importing the signaling handlers doesn't spin up
// a native worker. The router/transport fakes are just enough for join-room.
let transportSeq = 0;
function fakeTransport() {
  return {
    id: "t" + transportSeq++,
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    setMaxIncomingBitrate: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };
}
function fakeRouter() {
  return {
    rtpCapabilities: {},
    createWebRtcTransport: vi.fn(async () => fakeTransport()),
    createAudioLevelObserver: vi.fn(async () => ({
      on: vi.fn(),
      addProducer: vi.fn().mockResolvedValue(undefined),
    })),
    canConsume: vi.fn(() => true),
    close: vi.fn(),
  };
}

vi.mock("../mediasoup.js", () => ({
  worker: { createRouter: vi.fn(async () => fakeRouter()) },
  mediaCodecs: [],
  webRtcTransportOptions: {},
}));

import { registerSignalingHandlers } from "./signaling.js";
import { rooms } from "../rooms.js";
import {
  makeFakeIo,
  makeFakeSocket,
  fakeUser,
  type FakeIo,
  type FakeSocket,
} from "../test-helpers/fakes.js";

function join(
  socket: FakeSocket,
  data: {
    roomId: string;
    name: string;
    participantId: string;
    sessionToken: string;
    invite?: string;
  }
): Promise<any> {
  return new Promise((resolve) => socket.handlers["join-room"](data, resolve));
}

const ROOM = "room1";

describe("signaling: reconnect + identity", () => {
  let io: FakeIo;

  beforeEach(() => {
    for (const k of Object.keys(rooms)) delete rooms[k];
    io = makeFakeIo();
    transportSeq = 0;
  });

  function newSocket(id: string): FakeSocket {
    const s = makeFakeSocket(id);
    io.register(s);
    registerSignalingHandlers(io as any, s as any);
    return s;
  }

  it("admits the first joiner as host", async () => {
    const host = newSocket("s-host");
    const ack = await join(host, {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    expect(ack.isHost).toBe(true);
    expect(ack.error).toBeUndefined();
    expect(rooms[ROOM].hostUserId).toBe("p-host");
    expect(rooms[ROOM].users["p-host"]).toBeDefined();
  });

  it("puts a second joiner without an invite into the waiting room", async () => {
    await join(newSocket("s-host"), {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    const ack = await join(newSocket("s-guest"), {
      roomId: ROOM,
      name: "Guest",
      participantId: "p-guest",
      sessionToken: "tok-guest",
    });
    expect(ack.status).toBe("pending");
    expect(rooms[ROOM].pending["p-guest"]).toBeDefined();
    expect(rooms[ROOM].users["p-guest"]).toBeUndefined();
  });

  it("resumes a known participant in place on reconnect (same token), no waiting room", async () => {
    await join(newSocket("s-host"), {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    const ack = await join(newSocket("s-host-2"), {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    expect(ack.reconnected).toBe(true);
    expect(ack.isHost).toBe(true);
    expect(ack.status).not.toBe("pending");
    expect(rooms[ROOM].users["p-host"].socketId).toBe("s-host-2");
  });

  it("rejects a reconnect with the wrong session token (no hijack)", async () => {
    await join(newSocket("s-host"), {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    const ack = await join(newSocket("s-attacker"), {
      roomId: ROOM,
      name: "Attacker",
      participantId: "p-host",
      sessionToken: "WRONG",
    });
    expect(ack.error).toBe("identity-conflict");
    expect(rooms[ROOM].users["p-host"].socketId).toBe("s-host");
  });

  it("rejects an invalid room id", async () => {
    const ack = await join(newSocket("s1"), {
      roomId: "bad id!",
      name: "X",
      participantId: "p1",
      sessionToken: "t1",
    });
    expect(ack.error).toBe("invalid-room-id");
  });
});

describe("signaling: get-producers / get-pending", () => {
  let io: FakeIo;

  beforeEach(() => {
    for (const k of Object.keys(rooms)) delete rooms[k];
    io = makeFakeIo();
    transportSeq = 0;
  });

  function newSocket(id: string): FakeSocket {
    const s = makeFakeSocket(id);
    io.register(s);
    registerSignalingHandlers(io as any, s as any);
    return s;
  }

  function call(socket: FakeSocket, event: string, data: unknown): Promise<any> {
    return new Promise((resolve) => socket.handlers[event](data, resolve));
  }

  it("get-producers returns a list for a member and an error for a non-member", async () => {
    const host = newSocket("s-host");
    await join(host, {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });

    const ok = await call(host, "get-producers", { roomId: ROOM });
    expect(Array.isArray(ok.producers)).toBe(true);

    const stranger = newSocket("s-stranger");
    const denied = await call(stranger, "get-producers", { roomId: ROOM });
    expect(denied.error).toBe("not-ready");
  });

  it("get-producers roster lists connected peers, excluding self and grace-pending users", async () => {
    const host = newSocket("s-host");
    await join(host, {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    // A connected guest and a guest who dropped and is in the grace window.
    rooms[ROOM].users["p-live"] = fakeUser("Live", []);
    rooms[ROOM].users["p-gone"] = fakeUser("Gone", []);
    rooms[ROOM].users["p-gone"].disconnected = true;

    const res = await call(host, "get-producers", { roomId: ROOM });
    const ids = res.participants.map((p: { userId: string }) => p.userId);
    expect(ids).toContain("p-live");
    expect(ids).not.toContain("p-host"); // self excluded
    expect(ids).not.toContain("p-gone"); // grace-pending excluded
  });

  it("get-pending is host-only", async () => {
    const host = newSocket("s-host");
    await join(host, {
      roomId: ROOM,
      name: "Host",
      participantId: "p-host",
      sessionToken: "tok-host",
    });
    await join(newSocket("s-guest"), {
      roomId: ROOM,
      name: "Guest",
      participantId: "p-guest",
      sessionToken: "tok-guest",
    });

    const hostView = await call(host, "get-pending", { roomId: ROOM });
    expect(hostView.pending).toEqual([{ userId: "p-guest", name: "Guest" }]);

    const stranger = newSocket("s-stranger");
    const denied = await call(stranger, "get-pending", { roomId: ROOM });
    expect(denied.error).toBe("not-host");
  });
});

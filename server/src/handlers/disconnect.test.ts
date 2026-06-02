import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { registerDisconnectHandler } from "./disconnect.js";
import { rooms, messages } from "../rooms.js";
import { makeFakeIo, makeFakeSocket, fakeRoom, fakeUser } from "../test-helpers/fakes.js";

describe("disconnect handler (reconnect grace)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const k of Object.keys(rooms)) delete rooms[k];
    for (const k of Object.keys(messages)) delete messages[k];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupRoom() {
    rooms["r"] = fakeRoom();
    return rooms["r"];
  }

  it("holds the slot with a grace timer instead of removing the user immediately", () => {
    const room = setupRoom();
    const user = fakeUser("Alice");
    user.socketId = "s1";
    room.users["u1"] = user;

    const socket = makeFakeSocket("s1");
    socket.data.participantId = "u1";
    const io = makeFakeIo();
    registerDisconnectHandler(io as any, socket as any);

    socket.handlers["disconnect"]();

    expect(rooms["r"].users["u1"]).toBeDefined();
    expect(rooms["r"].users["u1"].disconnected).toBe(true);
    expect(rooms["r"].users["u1"].graceTimer).not.toBeNull();
    // The slot is held silently; nobody is told anything until the grace expires.
    expect(io.emit).not.toHaveBeenCalledWith("user-left", expect.anything());
  });

  it("tears the user down when the grace window expires", () => {
    const room = setupRoom();
    const guest = fakeUser("Alice", ["p1"]);
    guest.socketId = "s1";
    const host = fakeUser("Host");
    host.socketId = "sh";
    room.hostUserId = "host";
    room.users["host"] = host;
    room.users["u1"] = guest;

    const socket = makeFakeSocket("s1");
    socket.data.participantId = "u1";
    const io = makeFakeIo();
    registerDisconnectHandler(io as any, socket as any);

    socket.handlers["disconnect"]();
    vi.advanceTimersByTime(30_000);

    expect(rooms["r"]?.users["u1"]).toBeUndefined();
    expect(guest.producers[0].close).toHaveBeenCalled();
    expect(io.to).toHaveBeenCalledWith("r");
    expect(io.emit).toHaveBeenCalledWith("user-left", { userId: "u1" });
  });

  it("removes a page unload (clean client disconnect) at once but holds a network drop", () => {
    setupRoom();

    const unload = fakeUser("Unloader");
    unload.socketId = "s-unload";
    rooms["r"].users["u-unload"] = unload;
    const flaky = fakeUser("Flaky");
    flaky.socketId = "s-flaky";
    rooms["r"].users["u-flaky"] = flaky;

    const sUnload = makeFakeSocket("s-unload");
    sUnload.data.participantId = "u-unload";
    registerDisconnectHandler(makeFakeIo() as any, sUnload as any);
    const sFlaky = makeFakeSocket("s-flaky");
    sFlaky.data.participantId = "u-flaky";
    registerDisconnectHandler(makeFakeIo() as any, sFlaky as any);

    sUnload.handlers["disconnect"]("client namespace disconnect");
    expect(rooms["r"].users["u-unload"]).toBeUndefined();
    expect(rooms["r"].users["u-flaky"]).toBeDefined();

    sFlaky.handlers["disconnect"]("transport close");
    vi.advanceTimersByTime(4_000);
    expect(rooms["r"].users["u-flaky"]).toBeDefined();

    vi.advanceTimersByTime(12_000);
    expect(rooms["r"]?.users["u-flaky"]).toBeUndefined();
  });

  it("does not start a grace timer for a stale socket after reconnect", () => {
    const room = setupRoom();
    const user = fakeUser("Alice");
    // The user already returned on a newer socket.
    user.socketId = "s2";
    room.users["u1"] = user;

    const staleSocket = makeFakeSocket("s1");
    staleSocket.data.participantId = "u1";
    const io = makeFakeIo();
    registerDisconnectHandler(io as any, staleSocket as any);

    staleSocket.handlers["disconnect"]();

    expect(rooms["r"].users["u1"].disconnected).toBe(false);
    expect(rooms["r"].users["u1"].graceTimer).toBeNull();
  });

  it("promotes the next connected participant when the host's grace expires", () => {
    const room = setupRoom();
    const host = fakeUser("Host");
    host.socketId = "sh";
    const guest = fakeUser("Guest", ["pg"]);
    guest.socketId = "sg";
    room.hostUserId = "host";
    room.users["host"] = host;
    room.users["guest"] = guest;

    const hostSocket = makeFakeSocket("sh");
    hostSocket.data.participantId = "host";
    const guestSocket = makeFakeSocket("sg");
    const io = makeFakeIo();
    io.register(guestSocket);
    registerDisconnectHandler(io as any, hostSocket as any);

    hostSocket.handlers["disconnect"]();
    vi.advanceTimersByTime(30_000);

    expect(io.emit).toHaveBeenCalledWith("host-changed", { userId: "guest" });
    expect(rooms["r"].hostUserId).toBe("guest");
    expect(rooms["r"].users["guest"]).toBeDefined();
    expect(guestSocket.disconnect).not.toHaveBeenCalled();
    expect(guest.producers[0].close).not.toHaveBeenCalled();
  });

  it("ends the room when the host leaves and no one connected remains", () => {
    const room = setupRoom();
    const host = fakeUser("Host");
    host.socketId = "sh";
    const guest = fakeUser("Guest", ["pg"]);
    guest.socketId = "sg";
    guest.disconnected = true; // the only other user is itself mid-grace
    room.hostUserId = "host";
    room.users["host"] = host;
    room.users["guest"] = guest;

    const hostSocket = makeFakeSocket("sh");
    hostSocket.data.participantId = "host";
    const io = makeFakeIo();
    io.register(makeFakeSocket("sg"));
    registerDisconnectHandler(io as any, hostSocket as any);

    hostSocket.handlers["disconnect"]();
    vi.advanceTimersByTime(30_000);

    expect(io.emit).toHaveBeenCalledWith("host-left");
    expect(rooms["r"]).toBeUndefined();
  });

  it("cancels the grace timer if the same socket's user is re-marked connected", () => {
    const room = setupRoom();
    const user = fakeUser("Alice");
    user.socketId = "s1";
    room.users["u1"] = user;

    const socket = makeFakeSocket("s1");
    socket.data.participantId = "u1";
    const io = makeFakeIo();
    registerDisconnectHandler(io as any, socket as any);

    socket.handlers["disconnect"]();
    // Simulate the signaling reconnect branch clearing the timer.
    clearTimeout(rooms["r"].users["u1"].graceTimer!);
    rooms["r"].users["u1"].graceTimer = null;
    rooms["r"].users["u1"].disconnected = false;

    vi.advanceTimersByTime(30_000);

    expect(rooms["r"].users["u1"]).toBeDefined();
    // The grace was canceled, so the user is never finalized/removed.
    expect(io.emit).not.toHaveBeenCalledWith("user-left", expect.anything());
  });
});

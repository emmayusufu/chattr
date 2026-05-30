import { describe, expect, it, beforeEach } from "vitest";

import { registerChatHandlers } from "./chat.js";
import { messages, rooms } from "../rooms.js";
import {
  makeFakeIo,
  makeFakeSocket,
  fakeRoom,
  fakeUser,
  type FakeIo,
  type FakeSocket,
} from "../test-helpers/fakes.js";

describe("chat handlers", () => {
  let socket: FakeSocket;
  let io: FakeIo;

  // Join the socket to a room as a member named Alice. Chat is members-only and
  // the sender is the server-side identity, so membership has to exist for any
  // message to be accepted.
  function join(roomId: string, name = "Alice") {
    rooms[roomId] = fakeRoom();
    rooms[roomId].users["me"] = fakeUser(name);
  }

  beforeEach(() => {
    for (const k of Object.keys(messages)) delete messages[k];
    for (const k of Object.keys(rooms)) delete rooms[k];
    socket = makeFakeSocket();
    socket.data.participantId = "me";
    io = makeFakeIo();
    registerChatHandlers(io as any, socket as any);
  });

  describe("send-chat-message", () => {
    it("stores the message keyed by roomId with the server-derived sender", () => {
      join("r1");
      socket.handlers["send-chat-message"]({ roomId: "r1", message: "hello" });

      expect(messages["r1"]).toHaveLength(1);
      expect(messages["r1"][0]).toMatchObject({ sender: "Alice", message: "hello" });
      expect(typeof messages["r1"][0].timestamp).toBe("number");
    });

    it("appends to existing room messages without replacing them", () => {
      join("r");
      socket.handlers["send-chat-message"]({ roomId: "r", message: "one" });
      socket.handlers["send-chat-message"]({ roomId: "r", message: "two" });

      expect(messages["r"].map((m) => m.message)).toEqual(["one", "two"]);
    });

    it("isolates messages between rooms", () => {
      join("a");
      join("b");
      socket.handlers["send-chat-message"]({ roomId: "a", message: "x" });
      socket.handlers["send-chat-message"]({ roomId: "b", message: "y" });

      expect(messages["a"]).toHaveLength(1);
      expect(messages["b"]).toHaveLength(1);
      expect(messages["a"][0].message).toBe("x");
      expect(messages["b"][0].message).toBe("y");
    });

    it("broadcasts to the room over io.to(roomId).emit", () => {
      join("room-x");
      socket.handlers["send-chat-message"]({ roomId: "room-x", message: "hi all" });

      expect(io.to).toHaveBeenCalledWith("room-x");
      expect(io.emit).toHaveBeenCalledTimes(1);
      expect(io.emit).toHaveBeenCalledWith(
        "receive-chat-message",
        expect.objectContaining({ sender: "Alice", message: "hi all" })
      );
    });

    it("drops messages from a non-member", () => {
      // No room/membership set up for "ghost".
      socket.handlers["send-chat-message"]({ roomId: "ghost", message: "x" });
      expect(messages["ghost"]).toBeUndefined();
      expect(io.emit).not.toHaveBeenCalled();
    });
  });

  describe("get-chat-history", () => {
    it("returns the stored messages for the requested room", () => {
      join("r");
      socket.handlers["send-chat-message"]({ roomId: "r", message: "a" });
      socket.handlers["send-chat-message"]({ roomId: "r", message: "b" });

      socket.handlers["get-chat-history"]("r");

      expect(socket.emit).toHaveBeenCalledWith(
        "receive-chat-history",
        expect.arrayContaining([
          expect.objectContaining({ message: "a" }),
          expect.objectContaining({ message: "b" }),
        ])
      );
    });

    it("returns an empty array for a member's room with no messages", () => {
      join("empty");
      socket.handlers["get-chat-history"]("empty");
      expect(socket.emit).toHaveBeenCalledWith("receive-chat-history", []);
    });

    it("ignores history requests from a non-member", () => {
      socket.handlers["get-chat-history"]("nobody");
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    it("drops messages with an invalid roomId", () => {
      join("invalid id with spaces");
      socket.handlers["send-chat-message"]({ roomId: "invalid id with spaces", message: "x" });
      expect(messages["invalid id with spaces"]).toBeUndefined();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("drops messages exceeding the length limit", () => {
      join("r");
      const huge = "x".repeat(5000);
      socket.handlers["send-chat-message"]({ roomId: "r", message: huge });
      expect(messages["r"]).toBeUndefined();
    });

    it("drops empty messages", () => {
      join("r");
      socket.handlers["send-chat-message"]({ roomId: "r", message: "   " });
      expect(messages["r"]).toBeUndefined();
    });

    it("drops get-chat-history with an invalid roomId", () => {
      socket.handlers["get-chat-history"]({ not: "a string" });
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });
});

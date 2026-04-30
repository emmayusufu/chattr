import { describe, expect, it, beforeEach } from "vitest";

import { registerChatHandlers } from "../../../src/handlers/chat.js";
import { messages } from "../../../src/rooms.js";
import { makeFakeIo, makeFakeSocket, type FakeIo, type FakeSocket } from "../../helpers/fakes.js";

describe("chat handlers", () => {
  let socket: FakeSocket;
  let io: FakeIo;

  beforeEach(() => {
    for (const k of Object.keys(messages)) delete messages[k];
    socket = makeFakeSocket();
    io = makeFakeIo();
    registerChatHandlers(io as any, socket as any);
  });

  describe("send-chat-message", () => {
    it("stores the message keyed by roomId with sender, message, and timestamp", () => {
      socket.handlers["send-chat-message"]({
        roomId: "r1",
        message: "hello",
        sender: "Alice",
      });

      expect(messages["r1"]).toHaveLength(1);
      expect(messages["r1"][0]).toMatchObject({ sender: "Alice", message: "hello" });
      expect(typeof messages["r1"][0].timestamp).toBe("number");
    });

    it("appends to existing room messages without replacing them", () => {
      socket.handlers["send-chat-message"]({ roomId: "r", message: "one", sender: "A" });
      socket.handlers["send-chat-message"]({ roomId: "r", message: "two", sender: "B" });

      expect(messages["r"].map((m) => m.message)).toEqual(["one", "two"]);
    });

    it("isolates messages between rooms", () => {
      socket.handlers["send-chat-message"]({ roomId: "a", message: "x", sender: "A" });
      socket.handlers["send-chat-message"]({ roomId: "b", message: "y", sender: "B" });

      expect(messages["a"]).toHaveLength(1);
      expect(messages["b"]).toHaveLength(1);
      expect(messages["a"][0].message).toBe("x");
      expect(messages["b"][0].message).toBe("y");
    });

    it("broadcasts to the room over io.to(roomId).emit", () => {
      socket.handlers["send-chat-message"]({
        roomId: "room-x",
        message: "hi all",
        sender: "Alice",
      });

      expect(io.to).toHaveBeenCalledWith("room-x");
      expect(io.emit).toHaveBeenCalledTimes(1);
      expect(io.emit).toHaveBeenCalledWith(
        "receive-chat-message",
        expect.objectContaining({ sender: "Alice", message: "hi all" })
      );
    });
  });

  describe("get-chat-history", () => {
    it("returns the stored messages for the requested room", () => {
      socket.handlers["send-chat-message"]({ roomId: "r", message: "a", sender: "X" });
      socket.handlers["send-chat-message"]({ roomId: "r", message: "b", sender: "Y" });

      socket.handlers["get-chat-history"]("r");

      expect(socket.emit).toHaveBeenCalledWith(
        "receive-chat-history",
        expect.arrayContaining([
          expect.objectContaining({ message: "a" }),
          expect.objectContaining({ message: "b" }),
        ])
      );
    });

    it("returns an empty array for a room with no messages", () => {
      socket.handlers["get-chat-history"]("nobody");
      expect(socket.emit).toHaveBeenCalledWith("receive-chat-history", []);
    });
  });

  describe("input validation", () => {
    it("drops messages with an invalid roomId", () => {
      socket.handlers["send-chat-message"]({
        roomId: "invalid id with spaces",
        message: "x",
        sender: "A",
      });
      expect(messages["invalid id with spaces"]).toBeUndefined();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("drops messages exceeding the length limit", () => {
      const huge = "x".repeat(5000);
      socket.handlers["send-chat-message"]({ roomId: "r", message: huge, sender: "A" });
      expect(messages["r"]).toBeUndefined();
    });

    it("drops empty messages", () => {
      socket.handlers["send-chat-message"]({ roomId: "r", message: "   ", sender: "A" });
      expect(messages["r"]).toBeUndefined();
    });

    it("drops get-chat-history with an invalid roomId", () => {
      socket.handlers["get-chat-history"]({ not: "a string" });
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe("sender", () => {
    it("uses the client-supplied sender after validation", () => {
      socket.handlers["send-chat-message"]({ roomId: "r", message: "hi", sender: "Guest" });
      expect(messages["r"][0].sender).toBe("Guest");
    });

    it("falls back to 'guest' when the sender is missing", () => {
      socket.handlers["send-chat-message"]({ roomId: "r", message: "hi" });
      expect(messages["r"][0].sender).toBe("guest");
    });
  });
});

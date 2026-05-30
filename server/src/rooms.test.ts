import { describe, expect, it, beforeEach } from "vitest";

import { rooms, getAllProducersInRoom } from "./rooms.js";
import { fakeRoom, fakeUser } from "./test-helpers/fakes.js";

describe("rooms", () => {
  beforeEach(() => {
    for (const id of Object.keys(rooms)) delete rooms[id];
  });

  describe("getAllProducersInRoom", () => {
    describe("when the room is missing or empty", () => {
      it("returns an empty list for an unknown room", () => {
        expect(getAllProducersInRoom("missing")).toEqual([]);
      });

      it("returns an empty list when the room has no users", () => {
        rooms["r"] = fakeRoom();
        expect(getAllProducersInRoom("r")).toEqual([]);
      });

      it("returns an empty list when users have no producers", () => {
        rooms["r"] = fakeRoom();
        rooms["r"].users["u1"] = fakeUser("Alice", []);
        expect(getAllProducersInRoom("r")).toEqual([]);
      });
    });

    describe("with multiple users producing", () => {
      beforeEach(() => {
        rooms["r"] = fakeRoom();
        rooms["r"].users["u1"] = fakeUser("Alice", ["p1", "p2"]);
        rooms["r"].users["u2"] = fakeUser("Bob", ["p3"]);
      });

      it("flattens every producer with its owner's name and userId", () => {
        const result = getAllProducersInRoom("r");
        expect(result).toHaveLength(3);
        expect(result).toContainEqual({
          producerId: "p1",
          name: "Alice",
          userId: "u1",
          appData: {},
        });
        expect(result).toContainEqual({
          producerId: "p2",
          name: "Alice",
          userId: "u1",
          appData: {},
        });
        expect(result).toContainEqual({ producerId: "p3", name: "Bob", userId: "u2", appData: {} });
      });

      it("excludes producers belonging to the given user", () => {
        const result = getAllProducersInRoom("r", "u1");
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ producerId: "p3", userId: "u2" });
      });

      it("returns nothing when the only remaining user is excluded", () => {
        delete rooms["r"].users["u2"];
        expect(getAllProducersInRoom("r", "u1")).toEqual([]);
      });
    });
  });
});

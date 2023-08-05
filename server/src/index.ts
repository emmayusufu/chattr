import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import mediasoup from "mediasoup";
import { RtpCodecCapability } from "mediasoup/node/lib/types";

const app = express();
const httpServer = createServer(app);
const worker = await mediasoup.createWorker();
const messages: {
  [key: string]: {
    sender: any;
    message: any;
    timestamp: number;
  }[];
} = {};

const rooms: {
  [key: string]: {
    router: mediasoup.types.Router;
    users: {
      [key: string]: {
        producers: mediasoup.types.Producer[];
        consumers: mediasoup.types.Consumer[];
        transports: {
          sender: boolean;
          transport: mediasoup.types.WebRtcTransport;
          /**
           * TODO: update sender transport to have a given user's id whose media is gonna get consumer
           * That way when a given consumer leaves, their transports will also be removed from others clients' transport lists.
           * */
        }[];
      };
    };
  };
} = {};

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];

const webRtcTransportOptions = {
  listenIps: [
    {
      ip: "127.0.0.1",
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket: Socket) => {
  const userId = socket.id;

  socket.on("send-chat-message", (data) => {
    const { roomId, message, sender } = data;
    const roomMessages = messages[roomId] || [];
    const chatMessage = { sender, message, timestamp: Date.now() };
    roomMessages.push(chatMessage);
    messages[roomId] = roomMessages;
    io.to(roomId).emit("receive-chat-message", chatMessage);
  });

  socket.on("get-chat-history", (roomId) => {
    const roomMessages = messages[roomId] || [];
    socket.emit("receive-chat-history", roomMessages);
  });

  socket.on("disconnect", () => {
    // Get the room the user is in
    const roomId = Object.keys(rooms).find((roomId) => {
      const room = rooms[roomId];
      return Object.keys(room.users).includes(userId);
    });
    if (roomId) {
      // Find the room the user is in
      const user = rooms[roomId].users[userId];

      // Close the user's producers
      for (const producer of user.producers) {
        producer.close();
      }

      // Close the user's consumers and remove their transports
      for (const transport of user.transports) {
        const transportId = transport.transport.id;

        const otherUserIds = Object.keys(rooms[roomId].users).filter(
          (otherUserId) => otherUserId !== userId
        );

        if (transport.sender) {
          const senderTransport = transport.transport;

          for (const otherUserId of otherUserIds) {
            const otherUser = rooms[roomId].users[otherUserId];

            otherUser.transports = otherUser.transports.filter(
              (t) => t.transport.id !== senderTransport.id
            );
          }
        }
      }

      // Remove the user from the room
      delete rooms[roomId].users[userId];
    }

    // If the room is empty, delete it from the list of rooms and close the router
    if (roomId && Object.keys(rooms[roomId].users).length === 0) {
      rooms[roomId].router.close();
      delete rooms[roomId];
    }
  });

  // Joining a room
  socket.on("join-room", async (data: { roomId: string }, callback) => {
    const { roomId } = data;

    // Handling creation of a router if it doesn't exist
    if (!rooms[roomId]) {
      const router = await worker.createRouter({ mediaCodecs });
      rooms[roomId] = {
        router,
        users: {},
      };
    }

    const room = rooms[roomId];
    const router = room.router;

    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );

    rooms[roomId].users[userId] = {
      producers: [],
      consumers: [],
      transports: [{ transport, sender: true }],
    };

    socket.join(roomId);
    socket.to(roomId).emit("user-joined", userId);

    callback({
      routerRtpCapabilities: router.rtpCapabilities,
      transportOptions: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  });

  // Handling connecting of a transport
  socket.on(
    "connect-transport",
    async (
      data: {
        roomId: string;
        transportId: string;
        dtlsParameters: mediasoup.types.DtlsParameters;
      },
      callback
    ) => {
      const { roomId, transportId, dtlsParameters } = data;
      const transport = rooms[roomId].users[userId].transports.find(
        (transport) => transport.transport.id === transportId
      );

      if (!transport) {
        return;
      }

      await transport.transport.connect({ dtlsParameters });
      callback();
    }
  );
  // Handling producing of media
  socket.on(
    "produce",
    async (
      data: {
        roomId: string;
        transportId: string;
        kind: "audio" | "video";
        rtpParameters: mediasoup.types.RtpParameters;
      },
      callback
    ) => {
      const { roomId, transportId, kind, rtpParameters } = data;
      const transport = rooms[roomId].users[userId].transports.find(
        (transport) => transport.transport.id === transportId
      );

      if (!transport) {
        return;
      }

      const producer = await transport.transport.produce({
        kind,
        rtpParameters,
      });

      rooms[roomId].users[userId].producers.push(producer);

      const otherProducerIds = getAllProducersInRoom(roomId, userId).map(
        ({ id }) => id
      );

      callback({
        id: producer.id,
        otherProducerIds,
      });

      socket.to(roomId).emit("new-producer", { producerId: producer.id });
    }
  );

  // Handling creation of a receive transport
  socket.on(
    "create-receive-transport",
    async (data: { roomId: string }, callback) => {
      const { roomId } = data;
      const { router } = rooms[roomId];
      const transport = await router.createWebRtcTransport(
        webRtcTransportOptions
      );
      rooms[roomId].users[userId].transports.push({ transport, sender: false });

      callback({
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
    }
  );

  // Handle connection of a receive transport
  socket.on(
    "connect-receive-transport",
    async (
      data: {
        roomId: string;
        transportId: string;
        dtlsParameters: mediasoup.types.DtlsParameters;
      },
      callback
    ) => {
      const { roomId, transportId, dtlsParameters } = data;
      const transport = rooms[roomId].users[userId].transports.find(
        (transport) => transport.transport.id === transportId
      );
      if (!transport) {
        return;
      }
      await transport.transport.connect({ dtlsParameters });
      callback();
    }
  );

  // Handle consuming of media
  socket.on(
    "consume",
    async (
      data: {
        roomId: string;
        transportId: string;
        producerId: string;
        kind: "audio" | "video";
      },
      callback
    ) => {
      const { roomId, transportId, producerId } = data;
      const { router } = rooms[roomId];
      const transport = rooms[roomId].users[userId].transports.find(
        ({ transport }) => transport.id === transportId
      );
      if (!transport) {
        return;
      }
      const consumer = await transport.transport.consume({
        producerId,
        rtpCapabilities: router.rtpCapabilities,
        paused: false,
      });

      // Handle closing of producer transport
      consumer.on("transportclose", () => {
        console.log("Consumer transport closed");
      });
      // Handle closing of producer
      consumer.on("producerclose", () => {
        socket.emit("producer-closed", { producerId });
        // Remove the consumer from the user's list of consumers
        const user = rooms[roomId].users[userId];
        user.consumers = user.consumers.filter(
          (consumer) => consumer.id !== consumer.id
        );
      });
      rooms[roomId].users[userId].consumers.push(consumer);
      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    }
  );
});

function getAllProducersInRoom(roomId: string, excludeUserId: string = "") {
  const room = rooms[roomId];
  if (!room) {
    return [];
  }

  const users = Object.keys(room.users);
  const producers = users.reduce((result, userId) => {
    if (userId !== excludeUserId) {
      const user = room.users[userId];
      return result.concat(user.producers);
    }
    return result;
  }, [] as mediasoup.types.Producer<mediasoup.types.AppData>[]);

  return producers;
}

httpServer.listen(3000, () => {
  console.log("Server listening on port 3000 🚀");
});

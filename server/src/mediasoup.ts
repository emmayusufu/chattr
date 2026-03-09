import mediasoup from "mediasoup";
import type { RtpCodecCapability } from "mediasoup/node/lib/types";
import { logger } from "./logger.js";
import { config } from "./config.js";

export const worker = await mediasoup.createWorker();

worker.on("died", (error) => {
  logger.fatal({ err: error }, "mediasoup worker died, exiting for process manager restart");
  setTimeout(() => process.exit(1), 2000);
});

export const mediaCodecs: RtpCodecCapability[] = [
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

logger.info({ announcedIp: config.announcedIp }, "mediasoup announcing IP");

export const webRtcTransportOptions = {
  listenIps: [{ ip: "0.0.0.0", announcedIp: config.announcedIp }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

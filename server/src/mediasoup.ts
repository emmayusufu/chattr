import mediasoup from "mediasoup";
import type { RtpCodecCapability } from "mediasoup/node/lib/types";
import { config } from "./config.js";

export const worker = await mediasoup.createWorker();

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

console.log(`mediasoup announcing IP: ${config.announcedIp}`);

export const webRtcTransportOptions = {
  listenIps: [{ ip: "0.0.0.0", announcedIp: config.announcedIp }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

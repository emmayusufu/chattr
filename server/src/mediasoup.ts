import mediasoup from "mediasoup";
import { networkInterfaces } from "os";
import type { RtpCodecCapability } from "mediasoup/node/lib/types";

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

function detectLanIp(): string {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || detectLanIp();
console.log(`mediasoup announcing IP: ${announcedIp}`);

export const webRtcTransportOptions = {
  listenIps: [{ ip: "0.0.0.0", announcedIp }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

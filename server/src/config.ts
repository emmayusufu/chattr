import { networkInterfaces } from "os";

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

export const config = {
  port: Number(process.env.PORT) || 3000,
  announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || detectLanIp(),
  maxUsersPerRoom: Number(process.env.MAX_USERS_PER_ROOM) || 16,
  maxRooms: Number(process.env.MAX_ROOMS) || 100,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
  inputLimits: {
    roomId: 64,
    name: 64,
    message: 2000,
  },
};

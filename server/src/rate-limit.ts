type Bucket = { tokens: number; lastRefill: number };

const limits: Record<string, { capacity: number; refillPerSec: number }> = {
  "join-room": { capacity: 3, refillPerSec: 0.2 },
  "send-chat-message": { capacity: 10, refillPerSec: 5 },
  produce: { capacity: 8, refillPerSec: 4 },
  consume: { capacity: 20, refillPerSec: 10 },
  "create-send-transport": { capacity: 8, refillPerSec: 2 },
  "create-receive-transport": { capacity: 30, refillPerSec: 15 },
  "request-keyframe": { capacity: 30, refillPerSec: 15 },
  "create-invite": { capacity: 10, refillPerSec: 1 },
  "revoke-invite": { capacity: 20, refillPerSec: 5 },
  "transcript-segment": { capacity: 30, refillPerSec: 10 },
  "mute-state": { capacity: 10, refillPerSec: 3 },
};

const defaultLimit = { capacity: 30, refillPerSec: 20 };

const buckets = new Map<string, Map<string, Bucket>>();

export function checkRate(socketId: string, event: string): boolean {
  const limit = limits[event] ?? defaultLimit;
  const now = Date.now();

  let socketBuckets = buckets.get(socketId);
  if (!socketBuckets) {
    socketBuckets = new Map();
    buckets.set(socketId, socketBuckets);
  }

  let bucket = socketBuckets.get(event);
  if (!bucket) {
    bucket = { tokens: limit.capacity, lastRefill: now };
    socketBuckets.set(event, bucket);
  }

  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(limit.capacity, bucket.tokens + elapsedSec * limit.refillPerSec);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function clearRate(socketId: string): void {
  buckets.delete(socketId);
}

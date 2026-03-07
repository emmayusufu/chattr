import { config } from "./config.js";

export function bounded(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

export function validRoomId(value: unknown): string | null {
  const v = bounded(value, config.inputLimits.roomId);
  if (!v) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(v)) return null;
  return v;
}

export function validName(value: unknown): string | null {
  return bounded(value, config.inputLimits.name);
}

export function validMessage(value: unknown): string | null {
  return bounded(value, config.inputLimits.message);
}

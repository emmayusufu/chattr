export type RCMouseEvent = {
  x: number;
  y: number;
  button: 'left' | 'right';
  action: 'down' | 'up' | 'move';
};

export type RCKeyEvent = {
  key: string;
  action: 'down' | 'up';
};

export function normalizePointer(
  e: MouseEvent,
  rect: DOMRect
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  };
}

export function mouseButton(e: MouseEvent): 'left' | 'right' {
  return e.button === 2 ? 'right' : 'left';
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window.__TAURI__ || (window as any).__TAURI_INTERNALS__);
}

export async function injectMouse(x: number, y: number, button: string, action: string): Promise<void> {
  if (!window.__TAURI__) return;
  await window.__TAURI__.core.invoke('inject_mouse', { x, y, button, action });
}

export async function injectKey(key: string, action: string): Promise<void> {
  if (!window.__TAURI__) return;
  await window.__TAURI__.core.invoke('inject_key', { key, action });
}

<script lang="ts">
  import { normalizePointer, mouseButton } from './remote-control';
  import type { RoomClient } from './RoomClient';

  export let room: RoomClient;
  export let targetUserId: string;

  let overlayEl: HTMLDivElement;

  function onMouseDown(e: MouseEvent) {
    if (!overlayEl) return;
    const { x, y } = normalizePointer(e, overlayEl.getBoundingClientRect());
    room.sendMouseEvent(targetUserId, { x, y, button: mouseButton(e), action: 'down' });
  }

  function onMouseUp(e: MouseEvent) {
    if (!overlayEl) return;
    const { x, y } = normalizePointer(e, overlayEl.getBoundingClientRect());
    room.sendMouseEvent(targetUserId, { x, y, button: mouseButton(e), action: 'up' });
  }

  function onMouseMove(e: MouseEvent) {
    if (!overlayEl || e.buttons === 0) return;
    const { x, y } = normalizePointer(e, overlayEl.getBoundingClientRect());
    room.sendMouseEvent(targetUserId, { x, y, button: 'left', action: 'move' });
  }

  function onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    room.sendKeyEvent(targetUserId, { key: e.key, action: 'down' });
  }

  function onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    room.sendKeyEvent(targetUserId, { key: e.key, action: 'up' });
  }

  function onContext(e: MouseEvent) {
    e.preventDefault();
  }
</script>

<div
  class="rc-overlay"
  bind:this={overlayEl}
  tabindex="-1"
  on:mousedown={onMouseDown}
  on:mouseup={onMouseUp}
  on:mousemove={onMouseMove}
  on:keydown={onKeyDown}
  on:keyup={onKeyUp}
  on:contextmenu={onContext}
>
  <div class="rc-badge">controlling</div>
</div>

<style>
  .rc-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    cursor: crosshair;
    outline: none;
  }

  .rc-badge {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.25rem 0.6rem;
    background: rgba(233, 140, 58, 0.85);
    color: var(--bg);
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: 999px;
    pointer-events: none;
  }
</style>

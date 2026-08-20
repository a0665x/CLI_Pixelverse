import { buildHeartbeatPath } from './agent_timeline_graphs.mjs';

const FRAME_INTERVAL_MS = 1000 / 30;

const defaultPathFor = (row, nowMs) => buildHeartbeatPath({
  state: row.state,
  heartbeatTone: row.tone,
  heartbeatLoad: row.load,
}, nowMs, 160, 176);

export function createLiveEcgController({
  root,
  now = () => Date.now(),
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
  reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  pathFor = defaultPathFor,
} = {}) {
  let rows = new Map();
  let frame = 0;
  let running = false;
  let lastPaint = -Infinity;

  const paint = () => {
    const time = now();
    root?.querySelectorAll?.('[data-agent-ecg]').forEach((node) => {
      const row = rows.get(node.dataset.agentEcg);
      const path = row && node.querySelector?.('path');
      if (path) path.setAttribute('d', pathFor(row, time));
    });
  };

  const tick = (timestamp) => {
    if (!running) return;
    if (timestamp - lastPaint >= FRAME_INTERVAL_MS) {
      lastPaint = timestamp;
      paint();
    }
    frame = requestFrame(tick);
  };

  return {
    sync(nextRows = []) {
      rows = new Map(nextRows.map((row) => [row.id, { ...row }]));
      paint();
    },
    start() {
      if (running) return;
      running = true;
      if (reducedMotion()) {
        paint();
        return;
      }
      frame = requestFrame(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      if (frame) cancelFrame(frame);
      frame = 0;
      lastPaint = -Infinity;
    },
  };
}

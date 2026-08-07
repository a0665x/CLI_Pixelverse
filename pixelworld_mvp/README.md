# PixelWorld Work Village MVP

Standalone phase-one visualization for CLI_Pixelverse Agent activity. The camera always shows the complete outdoor village. Use the right-hand test panel to select an Agent and dispatch normalized demo events; every destination change except Heartbeat uses four-direction A*.

## Requirements

- Node.js 20.19 or newer
- npm

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## MVP behavior

- Three functional buildings: Knowledge & Planning Hall, Build Workshop, Collaboration & Signal Station.
- Four open zones: Arrival/Queue Plaza, Thinking Garden, Lounge Lawn, Repair Corner.
- Test triggers for initialization, thinking, planning, reading, editing, tools, external services, clone, response, waiting, blocked, self-healing, idle, offline, and heartbeat.
- Fixed global camera, A* routes, work-slot queues, foot-Y depth, foreground occlusion, Agent chips, speech bubbles, building activity summaries, and debug overlays.

Phase one has no backend or interiors. Future hooks must be adapted to `AgentWorldEvent`; they must not call Phaser systems directly.

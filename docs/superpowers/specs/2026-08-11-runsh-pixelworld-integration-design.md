# Run.sh Pixelworld Integration Design

## Goal

Make the Phaser village currently reviewed at port 5173 the primary world view served by `./run.sh`, while retaining the existing CLI_Pixelverse dashboard, backend APIs, event timeline, inspector, exposure controls, adapters, and multi-agent lifecycle.

## Chosen architecture

The existing dashboard remains the top-level document. Its legacy floorplan renderer stays as a compatibility layer for existing JavaScript modules, but is visually replaced by a same-origin `/pixelworld/index.html?embed=1` frame. This isolates Phaser canvas styles, pointer input, cutaway overlays, and furniture editing from the dashboard CSS.

The dashboard continues to own `/api/world/stream` and posts each accepted snapshot to the frame. The Pixelworld frame also owns a small live client that fetches `/api/world` and opens its own EventSource when no parent snapshot arrives, so `/pixelworld/` remains independently usable.

The production Docker image builds `pixelworld_mvp` in a Node builder stage and copies its Vite output into `/app/public/pixelworld`. The Python FastAPI catch-all already serves that directory, so `./run.sh` needs no second web server or port.

## Agent and event flow

1. Existing hooks, adapters, Hermes polling, and bridge requests update `WorldState` exactly as before.
2. `/api/world/stream` emits the canonical snapshot.
3. The outer dashboard updates counts, inspector, heartbeat, exposure UI, and timelines, then posts the snapshot into the Pixelworld frame.
4. The Pixelworld live adapter reconciles agents by stable backend ID. `main_agent` maps to a main-role sprite; `subagent` and `branch_session` map to subagent-role skins.
5. New IDs create controllers at the village spawn, missing IDs are removed, and retained IDs keep their current location.
6. `pixel_state`, `state`, `room_key`, recent action, and task text map to a `WorldEventKind`. The existing behavior router, station allocator, A* travel planner, doorway transit, status bubbles, building occupancy, and indoor motion then handle the visual result.
7. Repeated identical snapshots are deduplicated per agent. New snapshot sequence numbers produce stable event IDs and do not replay motion unnecessarily.

## State routing

- initialization → `session_start`
- thinking → `think`
- planning → `plan`
- file reading/search → `read`
- editing/writing → `edit`
- shell/execution/tool call → `tool`
- web/MCP/external tool → `web`
- delegation/collaboration/clone room → `clone`
- response work → `respond`
- waiting for user → `await`
- blocked/error → `blocked`
- recovery → `self_heal`
- offline/sleeping → `offline`
- idle/completed → `idle`
- heartbeat-only updates → `heartbeat`

## UI compatibility

The outer brand panel, locale selector, exposure URL, summary cards, sidebar, Hook table, agent inspector, offline-agent deletion, timeline graphs, heartbeat controls, mobile mode, map validator link, REST API, SSE API, and adapter commands remain available. The old global-map camera and furniture toolbar are hidden in Pixelworld mode because the Phaser village owns navigation and indoor furniture editing.

The embedded village keeps fixed global framing, building click-to-open cutaways, live building badges, test panel, furniture palette, grouping/layers/copy/paste/save operations, animals, occlusion, and A* movement.

## Persistence and assets

Existing backend runtime data and dashboard furniture layout files are not migrated or deleted. Phaser indoor layouts continue using their versioned browser storage. The purchased Modern Office files remain local and gitignored; the installer copies them into the Pixelworld public tree before Docker build.

## Failure handling

- Invalid snapshot payloads are ignored without breaking the render loop.
- EventSource reconnects through browser-native retry behavior; periodic fetch is the fallback.
- A full station or unreachable destination surfaces the existing queue/error bubble rather than dropping the agent.
- The dashboard remains operational if the frame fails to load.
- The Docker build fails clearly if Node dependencies or Pixelworld compilation fail.

## Verification

- Unit tests cover state mapping, event creation, roster reconciliation, deduplication, and dashboard snapshot forwarding.
- Existing Python, Node, and Pixelworld test suites remain green.
- Docker build and `./run.sh down_up` serve one WebUI at port 5660.
- Browser QA verifies the village is the visible map, dashboard panels remain usable, multiple agents appear, state events trigger A* travel, houses open, and console/network logs contain no application errors.

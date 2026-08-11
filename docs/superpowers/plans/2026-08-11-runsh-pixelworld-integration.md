# Run.sh Pixelworld Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the reviewed Phaser village as the primary `./run.sh` world and drive every main/subagent/session sprite from the existing live backend event stream.

**Architecture:** Build `pixelworld_mvp` into `/public/pixelworld`, embed it same-origin inside the current dashboard, forward canonical snapshots from the dashboard, and reconcile those snapshots into dynamic Phaser agents whose state changes use the existing behavior router and A* travel system.

**Tech Stack:** Bash, Docker multi-stage builds, Python/FastAPI, TypeScript, Phaser 3, Vite, Vitest, browser EventSource/postMessage.

## Global Constraints

- Preserve all user changes already present in the dirty main worktree.
- Keep the existing REST/SSE endpoints and CLI adapter commands backward compatible.
- Do not commit purchased Modern Office assets; keep them under the existing ignored private asset directory.
- Use the reviewed fixed village camera and current four-theme indoor editor without redesigning them.
- Reconcile agents by backend ID and support main agents, subagents, and branch sessions concurrently.

---

### Task 1: Import the reviewed Pixelworld source

**Files:**
- Create: `pixelworld_mvp/package.json`, `pixelworld_mvp/src/**`, `pixelworld_mvp/tests/**`, and public licensed assets from `feat/pixelworld-work-village-mvp`
- Preserve: `pixelworld_mvp/build_world_guide.md`

**Interfaces:**
- Produces: the tested Vite application run by `npm test -- --run` and `npm run build`.

- [ ] **Step 1: Confirm the destination has no overlapping tracked Pixelworld source**

Run: `git status --short pixelworld_mvp && git ls-files pixelworld_mvp`

Expected: only the local guide exists and no production source would be overwritten.

- [ ] **Step 2: Materialize the reviewed branch subtree**

Import the exact `pixelworld_mvp` tree from `feat/pixelworld-work-village-mvp`, leaving untracked destination-only files intact.

- [ ] **Step 3: Install the purchased local asset pack**

Run: `pixelworld_mvp/scripts/install-modern-office-assets.sh "$HOME/Downloads/Modern_Office_Revamped_v1.2.zip"`

Expected: the private spritesheet and generated single-object crops exist but remain ignored by git.

- [ ] **Step 4: Verify the imported baseline**

Run: `npm test -- --run && npm run build`

Expected: all Pixelworld tests and the production build pass before live integration begins.

### Task 2: Add the live snapshot adapter and dynamic roster

**Files:**
- Create: `pixelworld_mvp/src/live/backendSnapshot.ts`
- Create: `pixelworld_mvp/src/live/LiveWorldClient.ts`
- Modify: `pixelworld_mvp/src/agents/AgentRegistry.ts`
- Modify: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/domStatusOverlay.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Test: `pixelworld_mvp/tests/backendSnapshot.test.ts`
- Test: `pixelworld_mvp/tests/agentRegistryLiveRoster.test.ts`
- Test: `pixelworld_mvp/tests/worldSceneLiveSnapshot.test.ts`

**Interfaces:**
- Produces: `worldEventForBackendAgent(agent, sequence): AgentWorldEvent` and `LiveWorldClient`.
- Produces: `WorldScene.syncLiveSnapshot(snapshot): void`.
- Produces: `AgentRegistry.ensure(agentId, role, spawn)` and `AgentRegistry.remove(agentId)`.

- [ ] **Step 1: Write failing state-routing tests**

Cover initialization, thinking, planning, read, edit, shell/tool, web/MCP, clone, response, await, blocked, recovery, offline, and idle mappings. Assert activity and bubble text use backend task/status text.

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `npm test -- --run tests/backendSnapshot.test.ts`

Expected: FAIL because `backendSnapshot.ts` does not exist.

- [ ] **Step 3: Implement typed backend snapshot conversion**

Implement pure normalization and event construction with no Phaser dependency. Prefer `pixel_state`, then raw state/action/room hints, and finally normalized state.

- [ ] **Step 4: Write failing roster reconciliation tests**

Assert arbitrary stable IDs can be added, selected, and removed; removal destroys the controller and selects a surviving agent; at least 32 simultaneous agents are accepted.

- [ ] **Step 5: Run roster tests and verify RED**

Run: `npm test -- --run tests/agentRegistryLiveRoster.test.ts`

Expected: FAIL because dynamic roster methods do not exist.

- [ ] **Step 6: Implement dynamic registry and overlay removal**

Add explicit-ID controller creation, cleanup in both Phaser and DOM overlays, allocator release, selected-agent fallback, and roster notifications.

- [ ] **Step 7: Write failing WorldScene snapshot tests**

Assert a snapshot creates all backend IDs, removes absent IDs, dispatches changed events once, and does not replay an unchanged signature.

- [ ] **Step 8: Implement `syncLiveSnapshot` and the live client**

The client accepts parent `postMessage` snapshots, fetches `/api/world`, connects `/api/world/stream`, and falls back to polling. `main.ts` starts it after `WorldScene` is ready.

- [ ] **Step 9: Run focused and full Pixelworld tests**

Run: `npm test -- --run tests/backendSnapshot.test.ts tests/agentRegistryLiveRoster.test.ts tests/worldSceneLiveSnapshot.test.ts`

Then: `npm test -- --run`

Expected: focused and full suites pass.

### Task 3: Embed Pixelworld into the retained dashboard

**Files:**
- Create: `public/pixelworld_embed.mjs`
- Modify: `public/index.html`
- Modify: `public/app.mjs`
- Test: `tests/test_pixelworld_embed.mjs`
- Test: `tests/test_dashboard_layout.py`

**Interfaces:**
- Produces: `forwardPixelworldSnapshot(frame, snapshot, origin)`.
- Consumes: `renderSnapshot(snapshot)` and the same-origin `/pixelworld/index.html?embed=1` frame.

- [ ] **Step 1: Write failing forwarding and dashboard-contract tests**

Assert only object snapshots are posted, the target origin is explicit, the page contains the Pixelworld frame, and the existing sidebar/timeline/inspector IDs remain.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/test_pixelworld_embed.mjs && pytest -q tests/test_dashboard_layout.py`

Expected: FAIL because the forwarding module and frame do not exist.

- [ ] **Step 3: Add the same-origin frame and compatibility styling**

Keep the legacy camera stage present but visually hidden. Place the Pixelworld frame above it, hide old camera/furniture controls in Pixelworld mode, and retain the outer HUD/sidebar/timeline.

- [ ] **Step 4: Forward snapshots from `renderSnapshot`**

Use the pure helper so every initial fetch, SSE update, and polling update reaches the frame. Re-send the latest snapshot when the frame reports readiness.

- [ ] **Step 5: Run Node/Python frontend tests**

Run: `node --test tests/test_pixelworld_embed.mjs tests/*.mjs` and `pytest -q tests/test_dashboard_layout.py tests/test_fastapi_service.py`

Expected: all selected tests pass.

### Task 4: Build Pixelworld into the run.sh image

**Files:**
- Create: `.dockerignore`
- Modify: `Dockerfile`
- Modify: `pixelworld_mvp/vite.config.ts`
- Modify: `run.sh`
- Test: `tests/test_run_pixelworld.py`

**Interfaces:**
- Produces: `/app/public/pixelworld/index.html` plus stable Vite assets in the Docker image.
- Preserves: the existing `./run.sh start|down_up|status|doctor` interface.

- [ ] **Step 1: Write failing build-contract tests**

Assert the Dockerfile has a Node builder, runs `npm ci` and `npm run build`, copies `dist` into `public/pixelworld`, and run.sh stale detection includes Pixelworld inputs.

- [ ] **Step 2: Run the test and verify RED**

Run: `pytest -q tests/test_run_pixelworld.py`

Expected: FAIL against the Python-only Dockerfile.

- [ ] **Step 3: Implement the multi-stage build**

Build with Node 22, use Vite base `/pixelworld/`, exclude local caches/node_modules/dist from context, and copy the final output into the Python image after the repository copy.

- [ ] **Step 4: Extend stale-image detection and status output**

Include Pixelworld source/package files in the image freshness signal and list `/pixelworld/` in `./run.sh status`.

- [ ] **Step 5: Run the build-contract and shell tests**

Run: `pytest -q tests/test_run_pixelworld.py tests/test_run_floorplan.py` and `bash -n run.sh`

Expected: all pass.

### Task 5: End-to-end verification and delivery

**Files:**
- Modify only if verification finds a reproducible defect.

**Interfaces:**
- Verifies the complete `hook → backend snapshot/SSE → Pixelworld agent → A* destination` chain.

- [ ] **Step 1: Run every automated suite**

Run Pixelworld Vitest/build, root Node tests, root Pytest, and shell syntax checks.

- [ ] **Step 2: Build and restart the service**

Run: `PIXELVERSE_REBUILD=1 PIXELVERSE_AGENT_KIND=codex ./run.sh down_up`

Expected: Docker build succeeds and health endpoints answer on port 5660.

- [ ] **Step 3: Send a multi-agent lifecycle sequence**

Use existing `/api/heartbeat` and bridge endpoints to create one main agent and at least two subagents with different states. Verify `/api/world` retains all IDs and the frame renders all sprites.

- [ ] **Step 4: Browser QA the retained dashboard and new world**

Verify village visibility, sidebar/timeline/inspector operation, house cutaways, furniture editing, A* paths, agent bubbles, no failed application assets, and no console errors.

- [ ] **Step 5: Refresh CodeGraph and commit scoped changes**

Run: `codegraph sync .`, verify status is current, inspect the scoped diff, and commit only integration files without absorbing unrelated dirty-worktree changes.

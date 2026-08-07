# PixelWorld Work Village MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, fixed-camera Phaser 3 work village where a test panel dispatches normalized Agent events, every non-heartbeat move uses A*, and main/subagents visibly perform status-specific actions.

**Architecture:** `pixelworld_mvp/` is an isolated Vite application. Pure TypeScript modules own event routing, world validation, station allocation, navigation, and status aggregation; Phaser adapters only render those decisions. The demo panel and future CLI_Pixelverse hook adapter both produce the same `AgentWorldEvent`, so formal integration replaces the ingress source without replacing behavior or movement.

**Tech Stack:** Node.js 20.19+; npm; Phaser 3.90.0; TypeScript 7.0.2; Vite 8.2.1; Vitest 4.1.10; HTML5 Canvas; CSS.

## Global Constraints

- Work only inside `pixelworld_mvp/`; do not modify existing CLI_Pixelverse runtime files during this MVP.
- Preserve the existing untracked `pixelworld_mvp/build_world_guide.md`; do not overwrite or stage it unless the user explicitly asks.
- Use a 16×16 px navigation tile and a 40×22 tile logical world (640×352 px).
- Keep the whole village visible by default with an integer-scaled, nearest-neighbor, pixel-rounded camera; no Agent follow, camera pan, or zoom in phase one. The supported phase-one viewport floor is 840×480 px.
- Phase one is outdoor-only: no backend, SSE, hooks, doors, interior scenes, database, or multiplayer networking.
- Every destination change except Heartbeat must use four-direction A*; Heartbeat preserves the current route, position, and action.
- Trees, walls, fences, water, closed flowerbeds, and fixed equipment block the foot hitbox; canopies and roofs are visual foregrounds, not full-sprite colliders.
- Support at least one main Agent plus ten subagents without assigning two Agents to one interaction slot.
- Moving Agents are not permanent navigation blockers; full stations use queue anchors.
- Render route-template status copy by default. Never render raw hook payloads; `detail` is displayable only after ingress-side sanitization.
- Use project-bundled Kenney character/urban assets and AppleDog work props with copied license/attribution files. Do not use protected Pokémon assets.
- Keep pure logic independent from Phaser and cover it with Vitest before wiring rendering.
- Use TDD for each logic unit, run `npm test`, `npm run typecheck`, and `npm run build` before completion, and commit only the files named by each task.

## File Structure

```text
pixelworld_mvp/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── README.md
├── ATTRIBUTION.md
├── public/assets/
│   ├── kenney/                 # selected 16×16 Agent/prop tiles + licenses
│   └── appledog/               # selected work props + attribution
├── src/
│   ├── main.ts                 # browser entrypoint
│   ├── styles.css              # fixed canvas/test-panel layout
│   ├── game/
│   │   ├── constants.ts        # tile/world/camera constants
│   │   └── createGame.ts       # Phaser config and bootstrap
│   ├── world/
│   │   ├── types.ts            # shared domain contracts
│   │   ├── worldDefinition.ts  # compact village data
│   │   └── validateWorld.ts    # startup configuration validation
│   ├── events/
│   │   ├── behaviorRouter.ts   # event → route/action/bubble policy
│   │   └── eventIngress.ts     # validation, sanitization, deduplication
│   ├── navigation/
│   │   ├── navigationGrid.ts   # blocked tile rasterization
│   │   └── aStar.ts            # deterministic four-way pathfinder
│   ├── stations/
│   │   └── stationAllocator.ts # interaction/queue occupancy
│   ├── agents/
│   │   ├── pathFollower.ts     # delta-time waypoint progress
│   │   ├── ActionController.ts # action loops/effects
│   │   ├── AgentController.ts  # sprite route and arrival lifecycle
│   │   └── AgentRegistry.ts    # main/subagent creation and selection
│   ├── rendering/
│   │   ├── assetManifest.ts
│   │   ├── createVillageTextures.ts
│   │   ├── DepthOcclusionSystem.ts
│   │   └── StatusOverlaySystem.ts
│   ├── status/
│   │   └── buildingActivity.ts # deterministic aggregate/priority rules
│   ├── scenes/
│   │   └── WorldScene.ts       # composition root for the MVP world
│   ├── ui/
│   │   ├── demoEvents.ts       # panel action → AgentWorldEvent
│   │   └── TestPanel.ts        # HTML controls and event log
│   └── debug/
│       └── DebugOverlay.ts     # grid/collision/path/anchor/depth layers
└── tests/
    ├── gameConfig.test.ts
    ├── behaviorRouter.test.ts
    ├── eventIngress.test.ts
    ├── validateWorld.test.ts
    ├── stationAllocator.test.ts
    ├── aStar.test.ts
    ├── sceneryDefinition.test.ts
    ├── pathFollower.test.ts
    ├── depthOcclusion.test.ts
    ├── buildingActivity.test.ts
    └── demoEvents.test.ts
```

---

### Task 1: Standalone Vite/Phaser foundation and fixed camera contract

**Files:**
- Create: `pixelworld_mvp/package.json`
- Create: `pixelworld_mvp/package-lock.json` (generated by `npm install`)
- Create: `pixelworld_mvp/tsconfig.json`
- Create: `pixelworld_mvp/vite.config.ts`
- Create: `pixelworld_mvp/index.html`
- Create: `pixelworld_mvp/src/styles.css`
- Create: `pixelworld_mvp/src/main.ts`
- Create: `pixelworld_mvp/src/game/constants.ts`
- Create: `pixelworld_mvp/src/game/createGame.ts`
- Create: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Test: `pixelworld_mvp/tests/gameConfig.test.ts`

**Interfaces:**
- Consumes: no application interfaces; this task creates the standalone project boundary.
- Produces: `TILE_SIZE`, `WORLD_TILES`, `WORLD_PIXELS`, `integerScaleFor(width, height)`, `buildGameConfig(parent: string): Phaser.Types.Core.GameConfig`, and a minimal `WorldScene` composition root.

- [ ] **Step 1: Create the package/build configuration and failing fixed-camera test**

Create `pixelworld_mvp/package.json`:

```json
{
  "name": "cli-pixelverse-work-village-mvp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20.19.0" },
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "phaser": "3.90.0" },
  "devDependencies": {
    "typescript": "7.0.2",
    "vite": "8.2.1",
    "vitest": "4.1.10"
  }
}
```

Create `pixelworld_mvp/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `pixelworld_mvp/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

Create `pixelworld_mvp/tests/gameConfig.test.ts` before creating the imported modules:

```ts
import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD_PIXELS, WORLD_TILES, integerScaleFor } from '../src/game/constants';

describe('fixed village game config', () => {
  it('uses the approved 40x22 world and pixel-perfect fixed camera settings', () => {
    expect(TILE_SIZE).toBe(16);
    expect(WORLD_TILES).toEqual({ width: 40, height: 22 });
    expect(WORLD_PIXELS).toEqual({ width: 640, height: 352 });
    expect(integerScaleFor(1280, 704)).toBe(2);
    expect(integerScaleFor(839, 479)).toBe(1);
  });
});
```

- [ ] **Step 2: Install the pinned dependencies**

Run:

```bash
cd pixelworld_mvp
npm install
```

Expected: exit 0 and `package-lock.json` records Phaser 3.90.0, Vite 8.2.1, TypeScript 7.0.2, and Vitest 4.1.10.

- [ ] **Step 3: Run the test and verify the contract is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- gameConfig.test.ts
```

Expected: FAIL because `src/game/constants.ts` does not exist.

- [ ] **Step 4: Add the minimal fixed-camera Phaser shell**

Create `src/game/constants.ts`:

```ts
export const TILE_SIZE = 16 as const;
export const WORLD_TILES = Object.freeze({ width: 40, height: 22 });
export const WORLD_PIXELS = Object.freeze({
  width: WORLD_TILES.width * TILE_SIZE,
  height: WORLD_TILES.height * TILE_SIZE,
});

export function integerScaleFor(availableWidth: number, availableHeight: number): number {
  return Math.max(1, Math.floor(Math.min(
    availableWidth / WORLD_PIXELS.width,
    availableHeight / WORLD_PIXELS.height,
  )));
}
```

Create `src/scenes/WorldScene.ts`:

```ts
import Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height);
    this.cameras.main.setRoundPixels(true);
    this.add.rectangle(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height, 0x79ad5b)
      .setOrigin(0);
    this.add.text(16, 16, 'PixelWorld Work Village MVP', {
      color: '#17351f',
      fontFamily: 'monospace',
      fontSize: '12px',
    });
  }
}
```

Create `src/game/createGame.ts`:

```ts
import Phaser from 'phaser';
import { WorldScene } from '../scenes/WorldScene';
import { WORLD_PIXELS, integerScaleFor } from './constants';

export function buildGameConfig(
  parent: string,
  onWorldReady?: (world: WorldScene) => void,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: WORLD_PIXELS.width,
    height: WORLD_PIXELS.height,
    backgroundColor: '#13251b',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_PIXELS.width,
      height: WORLD_PIXELS.height,
    },
    callbacks: {
      postBoot: (game) => {
        if (onWorldReady) game.events.once('world-ready', onWorldReady);
        const root = document.getElementById(parent);
        if (!root) throw new Error(`Missing #${parent}`);
        const resize = () => {
          const scale = integerScaleFor(root.clientWidth, root.clientHeight);
          game.canvas.style.width = `${WORLD_PIXELS.width * scale}px`;
          game.canvas.style.height = `${WORLD_PIXELS.height * scale}px`;
        };
        const observer = new ResizeObserver(resize);
        observer.observe(root);
        game.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());
        resize();
      },
    },
    scene: [WorldScene],
  };
}

export function createGame(
  parent = 'game-root',
  onWorldReady?: (world: WorldScene) => void,
): Phaser.Game {
  return new Phaser.Game(buildGameConfig(parent, onWorldReady));
}
```

Create `src/main.ts`:

```ts
import { createGame } from './game/createGame';
import './styles.css';

createGame();
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PixelWorld Work Village MVP</title>
  </head>
  <body>
    <main id="app-shell">
      <section id="game-root" aria-label="Agent 工作村莊"></section>
      <aside id="test-panel-root" aria-label="Agent 狀態測試面板"></aside>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/styles.css`:

```css
:root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #0b1510; }
body { display: grid; place-items: center; }
#app-shell { display: grid; grid-template-columns: minmax(0, 1fr) 264px; gap: 12px; width: min(100vw, 1280px); height: min(100vh, 720px); padding: 12px; }
#game-root { min-width: 0; min-height: 0; display: grid; place-items: center; background: #13251b; image-rendering: pixelated; }
#game-root canvas { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
#test-panel-root { overflow: auto; border: 1px solid #41604c; border-radius: 8px; background: #14241a; }
@media (max-width: 840px) {
  #app-shell { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
  #test-panel-root { max-height: 44px; }
  #test-panel-root[data-expanded='true'] { max-height: 45vh; }
}
```

- [ ] **Step 5: Verify the project shell**

Run:

```bash
cd pixelworld_mvp
npm test -- gameConfig.test.ts
npm run typecheck
npm run build
```

Expected: one passing test file, typecheck exit 0, and Vite creates `dist/index.html` without errors.

- [ ] **Step 6: Commit the foundation**

```bash
git add pixelworld_mvp/package.json pixelworld_mvp/package-lock.json pixelworld_mvp/tsconfig.json pixelworld_mvp/vite.config.ts pixelworld_mvp/index.html pixelworld_mvp/src/styles.css pixelworld_mvp/src/main.ts pixelworld_mvp/src/game/constants.ts pixelworld_mvp/src/game/createGame.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/gameConfig.test.ts
git commit -m "feat(pixelworld): scaffold fixed-camera Phaser MVP"
```

---

### Task 2: Normalized events, behavior routing, and ingress safety

**Files:**
- Create: `pixelworld_mvp/src/world/types.ts`
- Create: `pixelworld_mvp/src/events/behaviorRouter.ts`
- Create: `pixelworld_mvp/src/events/eventIngress.ts`
- Test: `pixelworld_mvp/tests/behaviorRouter.test.ts`
- Test: `pixelworld_mvp/tests/eventIngress.test.ts`

**Interfaces:**
- Consumes: no rendering interfaces.
- Produces: `AgentWorldEvent`, `WorldEventKind`, `AgentAction`, `BehaviorRoute`, `routeEvent(event): BehaviorRoute`, `sanitizeDisplayDetail(value): string | undefined`, and `EventIngress.ingest(event): IngressResult`.

- [ ] **Step 1: Write failing routing and ingress tests**

Create `tests/behaviorRouter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routeEvent } from '../src/events/behaviorRouter';
import type { AgentWorldEvent, WorldEventKind } from '../src/world/types';

const event = (kind: WorldEventKind): AgentWorldEvent => ({
  eventId: `evt-${kind}`,
  timestamp: 1,
  source: 'demo',
  agentId: 'main',
  agentRole: 'main',
  kind,
  phase: kind,
  activityLabel: kind,
});

describe('routeEvent', () => {
  it.each([
    ['think', 'thinking-garden', 'ponder'],
    ['plan', 'planning-board', 'plan'],
    ['read', 'reading-desk', 'read'],
    ['edit', 'editing-desk', 'type'],
    ['tool', 'terminal-rack', 'terminal'],
    ['web', 'signal-console', 'signal'],
    ['clone', 'dispatch-pad', 'dispatch'],
    ['await', 'queue-plaza', 'queue'],
    ['blocked', 'repair-bench', 'repair'],
    ['idle', 'lounge', 'rest'],
  ] as const)('maps %s to %s/%s', (kind, destinationId, action) => {
    expect(routeEvent(event(kind))).toMatchObject({ destinationId, action });
  });

  it('preserves movement and suppresses bubbles for heartbeat', () => {
    expect(routeEvent(event('heartbeat'))).toEqual({
      preserveLocation: true,
      action: 'pulse',
      bubblePolicy: 'none',
      bubbleText: '',
      priority: 0,
    });
  });

  it('makes blocked persistent and higher-priority than normal work', () => {
    expect(routeEvent(event('blocked'))).toMatchObject({ bubblePolicy: 'persistent', priority: 100 });
    expect(routeEvent(event('edit')).priority).toBeLessThan(100);
  });
});
```

Create `tests/eventIngress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EventIngress, sanitizeDisplayDetail } from '../src/events/eventIngress';
import type { AgentWorldEvent } from '../src/world/types';

const valid: AgentWorldEvent = {
  eventId: 'evt-1', timestamp: 1, source: 'demo', agentId: 'main', agentRole: 'main',
  kind: 'edit', phase: 'working', activityLabel: '修改程式', detail: '<script>secret</script>\nlong line',
};

describe('EventIngress', () => {
  it('accepts once and rejects a duplicate event id', () => {
    const ingress = new EventIngress();
    expect(ingress.ingest(valid).accepted).toBe(true);
    expect(ingress.ingest(valid)).toEqual({ accepted: false, reason: 'duplicate-event' });
  });

  it('rejects missing identity without routing', () => {
    const ingress = new EventIngress();
    expect(ingress.ingest({ ...valid, eventId: '', agentId: '' })).toEqual({
      accepted: false,
      reason: 'invalid-event',
    });
  });

  it('strips markup/newlines and caps optional display detail at 80 characters', () => {
    expect(sanitizeDisplayDetail(valid.detail)).toBe('scriptsecret/script long line');
    expect(sanitizeDisplayDetail('x'.repeat(100))).toHaveLength(80);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd pixelworld_mvp
npm test -- behaviorRouter.test.ts eventIngress.test.ts
```

Expected: FAIL because the event contracts and routers do not exist.

- [ ] **Step 3: Define the exact domain contracts and route table**

Create `src/world/types.ts`:

```ts
export type WorldEventKind =
  | 'session_start' | 'think' | 'plan' | 'read' | 'edit' | 'tool' | 'web'
  | 'clone' | 'respond' | 'await' | 'blocked' | 'self_heal' | 'idle'
  | 'offline' | 'heartbeat' | 'unknown';

export type AgentAction =
  | 'arrive' | 'ponder' | 'plan' | 'read' | 'type' | 'terminal' | 'signal'
  | 'dispatch' | 'respond' | 'queue' | 'repair' | 'rest' | 'offline' | 'pulse';

export type Facing = 'left' | 'right' | 'up' | 'down';
export interface GridPoint { x: number; y: number }

export interface AgentWorldEvent {
  eventId: string;
  timestamp: number;
  source: 'demo' | 'hook';
  agentId: string;
  agentRole: 'main' | 'subagent';
  kind: WorldEventKind;
  phase: string;
  activityLabel: string;
  detail?: string;
  toolName?: string;
}

export interface BehaviorRoute {
  destinationId?: string;
  preserveLocation: boolean;
  action: AgentAction;
  bubblePolicy: 'none' | 'transient' | 'persistent';
  bubbleText: string;
  priority: number;
}
```

Create `src/events/behaviorRouter.ts` with the complete route table:

```ts
import type { AgentWorldEvent, BehaviorRoute, WorldEventKind } from '../world/types';

const ROUTES: Record<WorldEventKind, BehaviorRoute> = {
  session_start: { destinationId: 'arrival', preserveLocation: false, action: 'arrive', bubblePolicy: 'transient', bubbleText: '開始工作', priority: 20 },
  think: { destinationId: 'thinking-garden', preserveLocation: false, action: 'ponder', bubblePolicy: 'transient', bubbleText: '正在思考', priority: 30 },
  plan: { destinationId: 'planning-board', preserveLocation: false, action: 'plan', bubblePolicy: 'transient', bubbleText: '整理計畫', priority: 35 },
  read: { destinationId: 'reading-desk', preserveLocation: false, action: 'read', bubblePolicy: 'transient', bubbleText: '查閱檔案', priority: 35 },
  edit: { destinationId: 'editing-desk', preserveLocation: false, action: 'type', bubblePolicy: 'transient', bubbleText: '修改程式', priority: 40 },
  tool: { destinationId: 'terminal-rack', preserveLocation: false, action: 'terminal', bubblePolicy: 'transient', bubbleText: '使用工具', priority: 45 },
  web: { destinationId: 'signal-console', preserveLocation: false, action: 'signal', bubblePolicy: 'transient', bubbleText: '連接外部服務', priority: 45 },
  clone: { destinationId: 'dispatch-pad', preserveLocation: false, action: 'dispatch', bubblePolicy: 'transient', bubbleText: '建立 Subagent', priority: 50 },
  respond: { destinationId: 'response-desk', preserveLocation: false, action: 'respond', bubblePolicy: 'transient', bubbleText: '傳送結果', priority: 40 },
  await: { destinationId: 'queue-plaza', preserveLocation: false, action: 'queue', bubblePolicy: 'persistent', bubbleText: '等待輸入', priority: 90 },
  blocked: { destinationId: 'repair-bench', preserveLocation: false, action: 'repair', bubblePolicy: 'persistent', bubbleText: '工作受阻', priority: 100 },
  self_heal: { destinationId: 'repair-bench', preserveLocation: false, action: 'repair', bubblePolicy: 'transient', bubbleText: '正在修復', priority: 70 },
  idle: { destinationId: 'lounge', preserveLocation: false, action: 'rest', bubblePolicy: 'transient', bubbleText: '暫時休息', priority: 10 },
  offline: { destinationId: 'repair-bench', preserveLocation: false, action: 'offline', bubblePolicy: 'persistent', bubbleText: 'Agent 離線', priority: 100 },
  heartbeat: { preserveLocation: true, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
  unknown: { preserveLocation: true, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
};

export function routeEvent(event: AgentWorldEvent): BehaviorRoute {
  return { ...ROUTES[event.kind] };
}

export const ROUTE_DESTINATIONS = Object.freeze(
  [...new Set(Object.values(ROUTES).flatMap((route) => route.destinationId ? [route.destinationId] : []))],
);
```

- [ ] **Step 4: Implement validation, sanitization, and deduplication**

Create `src/events/eventIngress.ts`:

```ts
import { routeEvent } from './behaviorRouter';
import type { AgentWorldEvent, BehaviorRoute } from '../world/types';

export type IngressResult =
  | { accepted: true; event: AgentWorldEvent; route: BehaviorRoute }
  | { accepted: false; reason: 'duplicate-event' | 'invalid-event' };

export function sanitizeDisplayDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || undefined;
}

function isValid(event: AgentWorldEvent): boolean {
  return Boolean(
    event.eventId.trim() && event.agentId.trim() && event.phase.trim() &&
    event.activityLabel.trim() && Number.isFinite(event.timestamp),
  );
}

export class EventIngress {
  private readonly seen = new Set<string>();

  ingest(input: AgentWorldEvent): IngressResult {
    if (!isValid(input)) return { accepted: false, reason: 'invalid-event' };
    if (this.seen.has(input.eventId)) return { accepted: false, reason: 'duplicate-event' };
    this.seen.add(input.eventId);
    const detail = sanitizeDisplayDetail(input.detail);
    const { detail: _discarded, ...withoutDetail } = input;
    const event: AgentWorldEvent = detail === undefined ? withoutDetail : { ...withoutDetail, detail };
    return { accepted: true, event, route: routeEvent(event) };
  }
}
```

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
cd pixelworld_mvp
npm test -- behaviorRouter.test.ts eventIngress.test.ts
npm run typecheck
```

Expected: both test files pass and typecheck exits 0 with `exactOptionalPropertyTypes` enabled.

- [ ] **Step 6: Commit the event boundary**

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/events/behaviorRouter.ts pixelworld_mvp/src/events/eventIngress.ts pixelworld_mvp/tests/behaviorRouter.test.ts pixelworld_mvp/tests/eventIngress.test.ts
git commit -m "feat(pixelworld): normalize Agent world events"
```

---

### Task 3: Data-driven village definition, validation, and station allocation

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Create: `pixelworld_mvp/src/world/worldDefinition.ts`
- Create: `pixelworld_mvp/src/world/validateWorld.ts`
- Create: `pixelworld_mvp/src/stations/stationAllocator.ts`
- Test: `pixelworld_mvp/tests/validateWorld.test.ts`
- Test: `pixelworld_mvp/tests/stationAllocator.test.ts`

**Interfaces:**
- Consumes: `GridPoint`, `Facing`, `AgentAction`, and `ROUTE_DESTINATIONS` from Task 2.
- Produces: `WORLD_DEFINITION`, `validateWorld(definition): string[]`, `StationAllocator.assign(agentId, stationId, excludedAnchorIds): StationAssignmentResult`, `assignmentFor(agentId)`, `restore(assignment)`, `releaseAgent(agentId)`, and `assignments()`.

- [ ] **Step 1: Write failing world-validation and station-occupancy tests**

Create `tests/validateWorld.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ROUTE_DESTINATIONS } from '../src/events/behaviorRouter';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { validateWorld } from '../src/world/validateWorld';

describe('WORLD_DEFINITION', () => {
  it('is a valid 40x22 village with three buildings and four open zones', () => {
    expect(validateWorld(WORLD_DEFINITION)).toEqual([]);
    expect(WORLD_DEFINITION.width).toBe(40);
    expect(WORLD_DEFINITION.height).toBe(22);
    expect(WORLD_DEFINITION.buildings).toHaveLength(3);
    expect(WORLD_DEFINITION.zones).toHaveLength(4);
  });

  it('defines every destination referenced by the behavior router', () => {
    const ids = new Set(WORLD_DEFINITION.stations.map((station) => station.id));
    expect(ROUTE_DESTINATIONS.filter((id) => !ids.has(id))).toEqual([]);
  });
});
```

Create `tests/stationAllocator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { StationAllocator } from '../src/stations/stationAllocator';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('StationAllocator', () => {
  it('uses unique interaction slots, then queue anchors, then reports full', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const station = WORLD_DEFINITION.stations.find((item) => item.id === 'editing-desk')!;
    const capacity = station.interactionSlots.length + station.queueAnchors.length;
    const results = Array.from({ length: capacity }, (_, index) => allocator.assign(`a-${index}`, station.id));
    expect(results.every((result) => result.ok)).toBe(true);
    expect(new Set(results.flatMap((result) => result.ok ? [`${result.assignment.point.x},${result.assignment.point.y}`] : [])).size).toBe(capacity);
    expect(allocator.assign('overflow', station.id)).toEqual({ ok: false, reason: 'station-full' });
  });

  it('releases an old slot when an Agent changes station', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'editing-desk');
    expect(first.ok).toBe(true);
    expect(allocator.assign('main', 'lounge').ok).toBe(true);
    expect(allocator.assignments().filter((item) => item.agentId === 'main')).toHaveLength(1);
  });

  it('skips an unreachable anchor supplied by the route dispatcher', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'editing-desk');
    expect(first.ok).toBe(true);
    const excluded = new Set(first.ok ? [first.assignment.anchorId] : []);
    const second = allocator.assign('main', 'editing-desk', excluded);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.assignment.anchorId).not.toBe(first.assignment.anchorId);
  });
});
```

- [ ] **Step 2: Run tests and verify the data modules are missing**

Run:

```bash
cd pixelworld_mvp
npm test -- validateWorld.test.ts stationAllocator.test.ts
```

Expected: FAIL because the world definition, validator, and allocator do not exist.

- [ ] **Step 3: Add the world/station data types**

Append to `src/world/types.ts`:

```ts
export interface GridRect { x: number; y: number; width: number; height: number }
export interface WorldBuilding { id: string; label: string; bounds: GridRect; labelAnchor: GridPoint }
export interface WorldZone { id: string; label: string; bounds: GridRect }
export interface InteractionSlot {
  id: string;
  point: GridPoint;
  facing: Facing;
  action: AgentAction;
}
export interface StationDefinition {
  id: string;
  zoneId: string;
  buildingId?: string;
  approachAnchors: GridPoint[];
  interactionSlots: InteractionSlot[];
  queueAnchors: GridPoint[];
  interiorSceneId?: string;
}
export interface WorldDefinition {
  width: number;
  height: number;
  spawn: GridPoint;
  buildings: WorldBuilding[];
  zones: WorldZone[];
  obstacleRects: GridRect[];
  stations: StationDefinition[];
}
```

- [ ] **Step 4: Create the compact three-building/four-zone map configuration**

Create `src/world/worldDefinition.ts`:

```ts
import type { AgentAction, Facing, GridPoint, StationDefinition, WorldDefinition } from './types';

const slot = (id: string, x: number, y: number, facing: Facing, action: AgentAction) => ({
  id, point: { x, y }, facing, action,
});
const station = (
  id: string,
  zoneId: string,
  slots: ReturnType<typeof slot>[],
  queue: GridPoint[] = [],
  buildingId?: string,
): StationDefinition => ({
  id,
  zoneId,
  ...(buildingId ? { buildingId, interiorSceneId: `${buildingId}-interior` } : {}),
  approachAnchors: slots.map((item) => item.point),
  interactionSlots: slots,
  queueAnchors: queue,
});

export const WORLD_DEFINITION: WorldDefinition = {
  width: 40,
  height: 22,
  spawn: { x: 20, y: 11 },
  buildings: [
    { id: 'knowledge-hall', label: 'Knowledge & Planning Hall', bounds: { x: 2, y: 2, width: 9, height: 5 }, labelAnchor: { x: 6, y: 1 } },
    { id: 'build-workshop', label: 'Build Workshop', bounds: { x: 15, y: 2, width: 10, height: 5 }, labelAnchor: { x: 20, y: 1 } },
    { id: 'signal-station', label: 'Collaboration & Signal Station', bounds: { x: 29, y: 2, width: 9, height: 5 }, labelAnchor: { x: 33, y: 1 } },
  ],
  zones: [
    { id: 'arrival-zone', label: 'Arrival / Queue Plaza', bounds: { x: 14, y: 9, width: 12, height: 5 } },
    { id: 'thinking-zone', label: 'Thinking Garden', bounds: { x: 2, y: 10, width: 10, height: 8 } },
    { id: 'lounge-zone', label: 'Lounge Lawn', bounds: { x: 14, y: 16, width: 12, height: 4 } },
    { id: 'repair-zone', label: 'Repair Corner', bounds: { x: 31, y: 11, width: 7, height: 7 } },
  ],
  obstacleRects: [
    { x: 2, y: 2, width: 9, height: 5 },
    { x: 15, y: 2, width: 10, height: 5 },
    { x: 29, y: 2, width: 9, height: 5 },
    { x: 27, y: 14, width: 4, height: 3 },
    { x: 3, y: 12, width: 2, height: 4 },
    { x: 0, y: 0, width: 40, height: 1 },
    { x: 0, y: 21, width: 40, height: 1 },
    { x: 0, y: 1, width: 1, height: 20 },
    { x: 39, y: 1, width: 1, height: 20 },
  ],
  stations: [
    station('arrival', 'arrival-zone', [slot('arrival-1', 20, 11, 'down', 'arrive')]),
    station('thinking-garden', 'thinking-zone', [slot('think-1', 7, 14, 'down', 'ponder'), slot('think-2', 9, 13, 'left', 'ponder')], [{ x: 10, y: 15 }]),
    station('planning-board', 'knowledge-hall', [slot('plan-1', 5, 8, 'up', 'plan'), slot('plan-2', 6, 8, 'up', 'plan')], [{ x: 4, y: 8 }], 'knowledge-hall'),
    station('reading-desk', 'knowledge-hall', [slot('read-1', 8, 8, 'up', 'read'), slot('read-2', 9, 8, 'up', 'read')], [{ x: 10, y: 8 }], 'knowledge-hall'),
    station('editing-desk', 'build-workshop', [slot('edit-1', 18, 8, 'up', 'type'), slot('edit-2', 19, 8, 'up', 'type')], [{ x: 17, y: 8 }, { x: 20, y: 8 }], 'build-workshop'),
    station('terminal-rack', 'build-workshop', [slot('tool-1', 22, 8, 'up', 'terminal'), slot('tool-2', 23, 8, 'up', 'terminal')], [{ x: 21, y: 8 }], 'build-workshop'),
    station('signal-console', 'signal-station', [slot('signal-1', 31, 8, 'up', 'signal'), slot('signal-2', 32, 8, 'up', 'signal')], [{ x: 30, y: 8 }], 'signal-station'),
    station('dispatch-pad', 'signal-station', [slot('dispatch-1', 34, 8, 'up', 'dispatch'), slot('dispatch-2', 35, 8, 'up', 'dispatch')], [{ x: 36, y: 8 }], 'signal-station'),
    station('response-desk', 'signal-station', [slot('response-1', 29, 8, 'up', 'respond'), slot('response-2', 30, 8, 'up', 'respond')], [{ x: 28, y: 8 }], 'signal-station'),
    station('queue-plaza', 'arrival-zone', [slot('queue-1', 16, 12, 'right', 'queue'), slot('queue-2', 17, 12, 'right', 'queue'), slot('queue-3', 18, 12, 'right', 'queue')], [{ x: 19, y: 12 }, { x: 20, y: 12 }]),
    station('repair-bench', 'repair-zone', [slot('repair-1', 33, 14, 'right', 'repair'), slot('repair-2', 33, 15, 'right', 'repair')], [{ x: 32, y: 14 }, { x: 32, y: 15 }]),
    station('lounge', 'lounge-zone', [slot('lounge-1', 19, 18, 'down', 'rest'), slot('lounge-2', 21, 18, 'down', 'rest'), slot('lounge-3', 23, 18, 'down', 'rest')], [{ x: 18, y: 18 }, { x: 24, y: 18 }]),
  ],
};
```

- [ ] **Step 5: Implement exact startup validation**

Create `src/world/validateWorld.ts`:

```ts
import type { GridPoint, GridRect, WorldDefinition } from './types';

const inside = (point: GridPoint, world: WorldDefinition) =>
  Number.isInteger(point.x) && Number.isInteger(point.y) &&
  point.x >= 0 && point.y >= 0 && point.x < world.width && point.y < world.height;
const blocked = (point: GridPoint, rect: GridRect) =>
  point.x >= rect.x && point.y >= rect.y &&
  point.x < rect.x + rect.width && point.y < rect.y + rect.height;

export function validateWorld(world: WorldDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const locationIds = new Set([...world.zones.map((item) => item.id), ...world.buildings.map((item) => item.id)]);
  const buildingIds = new Set(world.buildings.map((item) => item.id));
  if (world.width !== 40 || world.height !== 22) errors.push('world must be 40x22 tiles');
  if (!inside(world.spawn, world)) errors.push('spawn is outside the world');
  world.obstacleRects.forEach((rect, index) => {
    if (rect.width <= 0 || rect.height <= 0 || rect.x < 0 || rect.y < 0 ||
        rect.x + rect.width > world.width || rect.y + rect.height > world.height) {
      errors.push(`invalid obstacle rectangle: ${index}`);
    }
  });
  for (const station of world.stations) {
    if (ids.has(station.id)) errors.push(`duplicate station: ${station.id}`);
    ids.add(station.id);
    if (!locationIds.has(station.zoneId)) errors.push(`unknown station zone: ${station.id}@${station.zoneId}`);
    if (station.buildingId && !buildingIds.has(station.buildingId)) errors.push(`unknown station building: ${station.id}@${station.buildingId}`);
    if (station.interactionSlots.length === 0) errors.push(`station has no slots: ${station.id}`);
    for (const point of [...station.approachAnchors, ...station.interactionSlots.map((item) => item.point), ...station.queueAnchors]) {
      if (!inside(point, world)) errors.push(`station point outside world: ${station.id}@${point.x},${point.y}`);
      if (world.obstacleRects.some((rect) => blocked(point, rect))) errors.push(`station point blocked: ${station.id}@${point.x},${point.y}`);
    }
  }
  return errors;
}
```

- [ ] **Step 6: Implement deterministic slot/queue allocation**

Create `src/stations/stationAllocator.ts`:

```ts
import type { AgentAction, Facing, GridPoint, StationDefinition } from '../world/types';

export interface StationAssignment {
  agentId: string;
  stationId: string;
  anchorId: string;
  point: GridPoint;
  facing: Facing;
  action: AgentAction;
  kind: 'interaction' | 'queue';
}
export type StationAssignmentResult =
  | { ok: true; assignment: StationAssignment }
  | { ok: false; reason: 'unknown-station' | 'station-full' };

export class StationAllocator {
  private readonly stations = new Map<string, StationDefinition>();
  private readonly byAgent = new Map<string, StationAssignment>();

  constructor(stations: StationDefinition[]) {
    stations.forEach((station) => this.stations.set(station.id, station));
  }

  assign(
    agentId: string,
    stationId: string,
    excludedAnchorIds: ReadonlySet<string> = new Set(),
  ): StationAssignmentResult {
    const station = this.stations.get(stationId);
    if (!station) return { ok: false, reason: 'unknown-station' };
    this.releaseAgent(agentId);
    const occupied = new Set([...this.byAgent.values()].map((item) => item.anchorId));
    const slot = station.interactionSlots.find((item) => {
      const anchorId = `${stationId}:${item.id}`;
      return !occupied.has(anchorId) && !excludedAnchorIds.has(anchorId);
    });
    if (slot) {
      const assignment: StationAssignment = {
        agentId, stationId, anchorId: `${stationId}:${slot.id}`, point: slot.point,
        facing: slot.facing, action: slot.action, kind: 'interaction',
      };
      this.byAgent.set(agentId, assignment);
      return { ok: true, assignment };
    }
    const queueIndex = station.queueAnchors.findIndex((_, index) => {
      const anchorId = `${stationId}:queue-${index}`;
      return !occupied.has(anchorId) && !excludedAnchorIds.has(anchorId);
    });
    if (queueIndex < 0) return { ok: false, reason: 'station-full' };
    const point = station.queueAnchors[queueIndex]!;
    const assignment: StationAssignment = {
      agentId, stationId, anchorId: `${stationId}:queue-${queueIndex}`, point,
      facing: 'right', action: 'queue', kind: 'queue',
    };
    this.byAgent.set(agentId, assignment);
    return { ok: true, assignment };
  }

  releaseAgent(agentId: string): void { this.byAgent.delete(agentId); }
  assignmentFor(agentId: string): StationAssignment | undefined { return this.byAgent.get(agentId); }
  restore(assignment: StationAssignment): void { this.byAgent.set(assignment.agentId, assignment); }
  assignments(): readonly StationAssignment[] { return [...this.byAgent.values()]; }
}
```

- [ ] **Step 7: Run tests and commit the world data boundary**

Run:

```bash
cd pixelworld_mvp
npm test -- validateWorld.test.ts stationAllocator.test.ts behaviorRouter.test.ts
npm run typecheck
```

Expected: all focused tests pass and no route destination is absent from the world definition.

Commit:

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/src/world/validateWorld.ts pixelworld_mvp/src/stations/stationAllocator.ts pixelworld_mvp/tests/validateWorld.test.ts pixelworld_mvp/tests/stationAllocator.test.ts
git commit -m "feat(pixelworld): define village stations and occupancy"
```

---

### Task 4: Deterministic four-direction A* navigation

**Files:**
- Create: `pixelworld_mvp/src/navigation/navigationGrid.ts`
- Create: `pixelworld_mvp/src/navigation/aStar.ts`
- Test: `pixelworld_mvp/tests/aStar.test.ts`

**Interfaces:**
- Consumes: `GridPoint`, `GridRect`, and `WorldDefinition` from Tasks 2–3.
- Produces: `NavigationGrid.fromWorld(world)`, `isWalkable(point): boolean`, and `findPath(grid, start, goal): GridPoint[] | null`. Returned paths include both start and goal.

- [ ] **Step 1: Write failing route/collision tests**

Create `tests/aStar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findPath } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('four-direction A*', () => {
  const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

  it('routes from spawn to every station anchor without crossing blocked tiles', () => {
    for (const station of WORLD_DEFINITION.stations) {
      for (const slot of station.interactionSlots) {
        const path = findPath(grid, WORLD_DEFINITION.spawn, slot.point);
        expect(path, station.id).not.toBeNull();
        expect(path!.at(0)).toEqual(WORLD_DEFINITION.spawn);
        expect(path!.at(-1)).toEqual(slot.point);
        expect(path!.every((point) => grid.isWalkable(point))).toBe(true);
        for (let index = 1; index < path!.length; index += 1) {
          const previous = path![index - 1]!;
          const current = path![index]!;
          expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(1);
        }
      }
    }
  });

  it('returns null for a blocked or unreachable goal', () => {
    expect(findPath(grid, WORLD_DEFINITION.spawn, { x: 3, y: 3 })).toBeNull();
  });

  it('returns a one-point path when start equals goal', () => {
    expect(findPath(grid, { x: 20, y: 11 }, { x: 20, y: 11 })).toEqual([{ x: 20, y: 11 }]);
  });
});
```

- [ ] **Step 2: Run the test and verify the pathfinder is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- aStar.test.ts
```

Expected: FAIL because `NavigationGrid` and `findPath` do not exist.

- [ ] **Step 3: Rasterize the approved static obstacle rectangles**

Create `src/navigation/navigationGrid.ts`:

```ts
import type { GridPoint, WorldDefinition } from '../world/types';

const key = (point: GridPoint) => `${point.x},${point.y}`;

export class NavigationGrid {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly blocked: Set<string>,
  ) {}

  static fromWorld(world: WorldDefinition): NavigationGrid {
    const blocked = new Set<string>();
    for (const rect of world.obstacleRects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) blocked.add(`${x},${y}`);
      }
    }
    return new NavigationGrid(world.width, world.height, blocked);
  }

  isWalkable(point: GridPoint): boolean {
    return Number.isInteger(point.x) && Number.isInteger(point.y) &&
      point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height &&
      !this.blocked.has(key(point));
  }

  blockedPoints(): GridPoint[] {
    return [...this.blocked].map((value) => {
      const [x, y] = value.split(',').map(Number);
      return { x: x!, y: y! };
    });
  }
}
```

- [ ] **Step 4: Implement deterministic Manhattan A***

Create `src/navigation/aStar.ts`:

```ts
import type { GridPoint } from '../world/types';
import { NavigationGrid } from './navigationGrid';

const key = ({ x, y }: GridPoint) => `${x},${y}`;
const distance = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const DIRECTIONS: readonly GridPoint[] = [
  { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
];

function reconstruct(cameFrom: Map<string, string>, points: Map<string, GridPoint>, goalKey: string): GridPoint[] {
  const path: GridPoint[] = [];
  let cursor: string | undefined = goalKey;
  while (cursor) {
    path.push(points.get(cursor)!);
    cursor = cameFrom.get(cursor);
  }
  return path.reverse();
}

export function findPath(grid: NavigationGrid, start: GridPoint, goal: GridPoint): GridPoint[] | null {
  if (!grid.isWalkable(start) || !grid.isWalkable(goal)) return null;
  const startKey = key(start);
  const goalKey = key(goal);
  const open = new Set([startKey]);
  const points = new Map<string, GridPoint>([[startKey, start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, distance(start, goal)]]);

  while (open.size > 0) {
    const currentKey = [...open].sort((left, right) =>
      (fScore.get(left)! - fScore.get(right)!) || left.localeCompare(right),
    )[0]!;
    const current = points.get(currentKey)!;
    if (currentKey === goalKey) return reconstruct(cameFrom, points, goalKey);
    open.delete(currentKey);

    for (const direction of DIRECTIONS) {
      const neighbor = { x: current.x + direction.x, y: current.y + direction.y };
      if (!grid.isWalkable(neighbor)) continue;
      const neighborKey = key(neighbor);
      const tentative = gScore.get(currentKey)! + 1;
      if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighborKey, currentKey);
      points.set(neighborKey, neighbor);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + distance(neighbor, goal));
      open.add(neighborKey);
    }
  }
  return null;
}
```

- [ ] **Step 5: Verify navigation and commit**

Run:

```bash
cd pixelworld_mvp
npm test -- aStar.test.ts validateWorld.test.ts
npm run typecheck
```

Expected: all station anchors are reachable, blocked building tiles return null, and only cardinal steps appear.

Commit:

```bash
git add pixelworld_mvp/src/navigation/navigationGrid.ts pixelworld_mvp/src/navigation/aStar.ts pixelworld_mvp/tests/aStar.test.ts
git commit -m "feat(pixelworld): add deterministic A-star navigation"
```

---

### Task 5: Licensed asset subset and static work-village rendering

**Files:**
- Create: `pixelworld_mvp/public/assets/kenney/Tiles/*.png` (selected binary copies)
- Create: `pixelworld_mvp/public/assets/kenney/License.txt`
- Create: `pixelworld_mvp/public/assets/kenney/LICENSE-THIRD-PARTY.txt`
- Create: `pixelworld_mvp/public/assets/appledog/*.png` (selected binary copies)
- Create: `pixelworld_mvp/public/assets/appledog/ATTRIBUTION.txt`
- Create: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Create: `pixelworld_mvp/src/rendering/createVillageTextures.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Test: `pixelworld_mvp/tests/sceneryDefinition.test.ts`

**Interfaces:**
- Consumes: `WORLD_DEFINITION`, `TILE_SIZE`, and Phaser `Scene`.
- Produces: `AGENT_SKINS`, `PROP_ASSETS`, `preloadVillageAssets(scene)`, `createVillageTextures(scene)`, and a static outdoor `WorldScene` with `renderedForegrounds` available to Task 7.

- [ ] **Step 1: Write the failing scenery/collision contract**

Create `tests/sceneryDefinition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('village scenery definition', () => {
  it('contains trees, a pond, flowers, and three functionally named buildings', () => {
    expect(WORLD_DEFINITION.scenery.trees.length).toBeGreaterThanOrEqual(6);
    expect(WORLD_DEFINITION.scenery.pond).toEqual({ x: 27, y: 14, width: 4, height: 3 });
    expect(WORLD_DEFINITION.scenery.flowerBeds).toHaveLength(1);
    expect(WORLD_DEFINITION.buildings.map((item) => item.id)).toEqual([
      'knowledge-hall', 'build-workshop', 'signal-station',
    ]);
  });

  it('marks every tree trunk, pond tile, and closed flowerbed as blocked', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);
    for (const tree of WORLD_DEFINITION.scenery.trees) expect(grid.isWalkable(tree.trunk)).toBe(false);
    expect(grid.isWalkable({ x: 28, y: 15 })).toBe(false);
    expect(grid.isWalkable({ x: 3, y: 13 })).toBe(false);
    expect(grid.isWalkable({ x: 18, y: 7 })).toBe(false);
    expect(grid.isWalkable({ x: 20, y: 17 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify scenery metadata is absent**

Run:

```bash
cd pixelworld_mvp
npm test -- sceneryDefinition.test.ts
```

Expected: FAIL because `WORLD_DEFINITION.scenery` does not exist.

- [ ] **Step 3: Copy the approved binary asset subset and licenses**

Run these commands from the repository root. Binary images are copied with `install`; source files remain unchanged.

```bash
mkdir -p pixelworld_mvp/public/assets/kenney/Tiles pixelworld_mvp/public/assets/appledog
for tile_id in 0077 0078 0079 0080 0104 0105 0106 0107 0131 0132 0133 0134 0158 0159 0160 0161 0212 0213 0214 0215 0239 0240 0241 0242 0124 0149 0152 0167 0190 0222 0223 0232 0250 0251 0254; do install -m 0644 "public/assets/kenney-rpg-urban/Tiles/tile_${tile_id}.png" "pixelworld_mvp/public/assets/kenney/Tiles/tile_${tile_id}.png"; done
install -m 0644 public/assets/kenney-rpg-urban/License.txt pixelworld_mvp/public/assets/kenney/License.txt
install -m 0644 public/assets/kenney-rpg-urban/LICENSE-THIRD-PARTY.txt pixelworld_mvp/public/assets/kenney/LICENSE-THIRD-PARTY.txt
for prop_name in terminal small-terminal office-table lounge-sofa plant; do install -m 0644 "public/assets/appledog-modern-interior/32x32/${prop_name}.png" "pixelworld_mvp/public/assets/appledog/${prop_name}.png"; done
install -m 0644 public/assets/appledog-modern-interior/ATTRIBUTION.txt pixelworld_mvp/public/assets/appledog/ATTRIBUTION.txt
```

Expected: 35 selected Kenney tiles, five AppleDog props, and all three license/attribution files exist below `pixelworld_mvp/public/assets/`.

- [ ] **Step 4: Add scenery types and exact tree obstacle points**

Append to `src/world/types.ts`:

```ts
export interface WorldTree { id: string; trunk: GridPoint }
export interface WorldScenery {
  trees: WorldTree[];
  pond: GridRect;
  flowerBeds: GridRect[];
}
```

Add this property to `WorldDefinition`:

```ts
scenery: WorldScenery;
```

Add the following `scenery` property to `WORLD_DEFINITION` immediately before `obstacleRects`:

```ts
scenery: {
  trees: [
    { id: 'tree-west-path', trunk: { x: 12, y: 10 } },
    { id: 'tree-east-path', trunk: { x: 27, y: 10 } },
    { id: 'tree-garden-north', trunk: { x: 6, y: 11 } },
    { id: 'tree-garden-south', trunk: { x: 11, y: 18 } },
    { id: 'tree-lounge', trunk: { x: 15, y: 18 } },
    { id: 'tree-repair', trunk: { x: 37, y: 19 } },
  ],
  pond: { x: 27, y: 14, width: 4, height: 3 },
  flowerBeds: [{ x: 3, y: 12, width: 2, height: 4 }],
},
```

Add one 1×1 obstacle rectangle for each tree trunk to `obstacleRects`:

```ts
{ x: 12, y: 10, width: 1, height: 1 },
{ x: 27, y: 10, width: 1, height: 1 },
{ x: 6, y: 11, width: 1, height: 1 },
{ x: 11, y: 18, width: 1, height: 1 },
{ x: 15, y: 18, width: 1, height: 1 },
{ x: 37, y: 19, width: 1, height: 1 },
{ x: 5, y: 7, width: 1, height: 1 },
{ x: 8, y: 7, width: 1, height: 1 },
{ x: 18, y: 7, width: 1, height: 1 },
{ x: 22, y: 7, width: 1, height: 1 },
{ x: 31, y: 7, width: 1, height: 1 },
{ x: 34, y: 7, width: 1, height: 1 },
{ x: 20, y: 17, width: 1, height: 1 },
{ x: 34, y: 14, width: 1, height: 1 },
```

Move `lounge-1` from `{ x: 19, y: 18 }` to `{ x: 18, y: 18 }` and its first queue anchor from `{ x: 18, y: 18 }` to `{ x: 17, y: 18 }` so tree and station anchors remain unique.

- [ ] **Step 5: Define exact Agent skins, work props, and the preload function**

Create `src/rendering/assetManifest.ts`:

```ts
import type Phaser from 'phaser';
import type { Facing } from '../world/types';

type DirectionTextures = Record<Facing, string>;
export interface AgentSkin { idle: DirectionTextures; active: DirectionTextures }

const textureSet = (prefix: string, idle: number[], active: number[]): AgentSkin => {
  const directions: Facing[] = ['left', 'down', 'up', 'right'];
  return {
    idle: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-idle-${direction}-${idle[index]}`])) as DirectionTextures,
    active: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-active-${direction}-${active[index]}`])) as DirectionTextures,
  };
};

export const AGENT_SKINS = {
  main: textureSet('main', [212, 213, 214, 215], [239, 240, 241, 242]),
  subagent: textureSet('subagent', [131, 132, 133, 134], [158, 159, 160, 161]),
  branch: textureSet('branch', [77, 78, 79, 80], [104, 105, 106, 107]),
} as const;

export const PROP_ASSETS = {
  bookshelf: '/assets/kenney/Tiles/tile_0124.png',
  board: '/assets/kenney/Tiles/tile_0149.png',
  desk: '/assets/kenney/Tiles/tile_0152.png',
  terminal: '/assets/kenney/Tiles/tile_0167.png',
  lamp: '/assets/kenney/Tiles/tile_0190.png',
  sofa: '/assets/kenney/Tiles/tile_0222.png',
  chair: '/assets/kenney/Tiles/tile_0223.png',
  plant: '/assets/kenney/Tiles/tile_0232.png',
  cabinet: '/assets/kenney/Tiles/tile_0250.png',
  server: '/assets/kenney/Tiles/tile_0251.png',
  crate: '/assets/kenney/Tiles/tile_0254.png',
  appleTerminal: '/assets/appledog/terminal.png',
  appleDesk: '/assets/appledog/office-table.png',
  appleSofa: '/assets/appledog/lounge-sofa.png',
} as const;

const tilePath = (number: number) => `/assets/kenney/Tiles/tile_${String(number).padStart(4, '0')}.png`;

export function villageAssetEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const skin of Object.values(AGENT_SKINS)) {
    for (const group of [skin.idle, skin.active]) {
      for (const key of Object.values(group)) {
        const number = Number(key.slice(key.lastIndexOf('-') + 1));
        entries.push([key, tilePath(number)]);
      }
    }
  }
  for (const [key, path] of Object.entries(PROP_ASSETS)) entries.push([`prop-${key}`, path]);
  return entries;
}

export function preloadVillageAssets(scene: Phaser.Scene): void {
  villageAssetEntries().forEach(([key, path]) => scene.load.image(key, path));
}

export function ensureAssetFallbacks(scene: Phaser.Scene): void {
  for (const [key] of villageAssetEntries()) {
    if (scene.textures.exists(key)) continue;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xff2f6d).fillRect(0, 0, 16, 16);
    graphics.fillStyle(0x1b1020).fillRect(2, 2, 12, 12);
    graphics.lineStyle(2, 0xffd166).lineBetween(2, 2, 14, 14).lineBetween(14, 2, 2, 14);
    graphics.generateTexture(key, 16, 16);
    graphics.destroy();
    console.error(`[pixelworld] missing asset; placeholder installed: ${key}`);
  }
}
```

- [ ] **Step 6: Generate original pixel-safe terrain/building textures**

Create `src/rendering/createVillageTextures.ts`:

```ts
import Phaser from 'phaser';

function generate(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function createVillageTextures(scene: Phaser.Scene): void {
  generate(scene, 'terrain-grass', 16, 16, (g) => {
    g.fillStyle(0x78ad58).fillRect(0, 0, 16, 16);
    g.fillStyle(0x6c9f4f).fillRect(3, 4, 1, 2).fillRect(12, 9, 1, 2);
  });
  generate(scene, 'terrain-path', 16, 16, (g) => {
    g.fillStyle(0xd6bd7b).fillRect(0, 0, 16, 16);
    g.fillStyle(0xc4a96b).fillRect(2, 3, 2, 1).fillRect(10, 12, 3, 1);
  });
  generate(scene, 'terrain-water', 16, 16, (g) => {
    g.fillStyle(0x4f9bc4).fillRect(0, 0, 16, 16);
    g.fillStyle(0x7fc7de).fillRect(2, 4, 8, 1).fillRect(7, 11, 7, 1);
  });
  generate(scene, 'tree-trunk', 16, 16, (g) => {
    g.fillStyle(0x6e4529).fillRect(5, 0, 6, 16);
    g.fillStyle(0x9a6538).fillRect(6, 1, 2, 14);
  });
  generate(scene, 'tree-canopy', 48, 48, (g) => {
    g.fillStyle(0x245c35).fillCircle(24, 24, 22);
    g.fillStyle(0x3d8a48).fillCircle(18, 18, 16).fillCircle(31, 20, 13);
    g.fillStyle(0x62ad55).fillRect(13, 9, 12, 5).fillRect(28, 15, 7, 4);
  });
  generate(scene, 'flower-bed', 16, 16, (g) => {
    g.fillStyle(0x52783f).fillRect(0, 0, 16, 16);
    g.fillStyle(0xf6d365).fillRect(3, 4, 2, 2).fillRect(11, 10, 2, 2);
    g.fillStyle(0xf58aa6).fillRect(9, 3, 2, 2).fillRect(4, 12, 2, 2);
  });
}
```

- [ ] **Step 7: Render the complete static outdoor map and collect foreground objects**

Replace `src/scenes/WorldScene.ts` with a scene that uses four focused helpers. The exact public fields are required by Tasks 6–9:

```ts
import Phaser from 'phaser';
import { TILE_SIZE, WORLD_PIXELS } from '../game/constants';
import { NavigationGrid } from '../navigation/navigationGrid';
import { ensureAssetFallbacks, preloadVillageAssets, PROP_ASSETS } from '../rendering/assetManifest';
import { createVillageTextures } from '../rendering/createVillageTextures';
import { WORLD_DEFINITION } from '../world/worldDefinition';
import { validateWorld } from '../world/validateWorld';

export interface RenderedForeground {
  object: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Depth;
  bounds: Phaser.Geom.Rectangle;
  baselineY: number;
}

export class WorldScene extends Phaser.Scene {
  readonly worldDefinition = WORLD_DEFINITION;
  readonly navigationGrid = NavigationGrid.fromWorld(WORLD_DEFINITION);
  readonly renderedForegrounds: RenderedForeground[] = [];

  constructor() { super('world'); }
  preload(): void { preloadVillageAssets(this); }

  create(): void {
    const errors = validateWorld(this.worldDefinition);
    if (errors.length > 0) throw new Error(`Invalid world definition:\n${errors.join('\n')}`);
    ensureAssetFallbacks(this);
    createVillageTextures(this);
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height).setRoundPixels(true);
    this.renderTerrain();
    this.renderBuildings();
    this.renderScenery();
    this.renderWorkProps();
    this.game.events.emit('world-ready', this);
  }

  private renderTerrain(): void {
    for (let y = 0; y < this.worldDefinition.height; y += 1) {
      for (let x = 0; x < this.worldDefinition.width; x += 1) this.add.image(x * 16, y * 16, 'terrain-grass').setOrigin(0).setDepth(0);
    }
    const pathRects = [
      { x: 1, y: 7, width: 38, height: 3 }, { x: 18, y: 7, width: 4, height: 14 },
      { x: 5, y: 9, width: 3, height: 10 }, { x: 32, y: 9, width: 3, height: 10 },
    ];
    for (const rect of pathRects) for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      this.add.image(x * 16, y * 16, 'terrain-path').setOrigin(0).setDepth(1);
    }
  }

  private renderBuildings(): void {
    const palettes = [0x58718f, 0x8b5a47, 0x5d6f5a];
    this.worldDefinition.buildings.forEach((building, index) => {
      const { x, y, width, height } = building.bounds;
      this.add.rectangle(x * 16, y * 16, width * 16, height * 16, palettes[index]!).setOrigin(0).setDepth((y + height) * 16 - 2);
      this.add.rectangle(x * 16 - 4, y * 16 - 8, width * 16 + 8, 28, 0x343b4f).setOrigin(0).setDepth((y + height) * 16);
      this.add.rectangle((x + Math.floor(width / 2)) * 16 - 6, (y + height) * 16 - 18, 12, 18, 0x5a3828).setOrigin(0).setDepth((y + height) * 16 - 1);
      this.add.text(building.labelAnchor.x * 16, building.labelAnchor.y * 16, building.label, {
        fontFamily: 'monospace', fontSize: '8px', color: '#fff4cf', backgroundColor: '#203126', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 0).setDepth(10_000);
    });
  }

  private renderScenery(): void {
    const pond = this.worldDefinition.scenery.pond;
    for (let y = pond.y; y < pond.y + pond.height; y += 1) for (let x = pond.x; x < pond.x + pond.width; x += 1) {
      this.add.image(x * 16, y * 16, 'terrain-water').setOrigin(0).setDepth(2);
    }
    for (const bed of this.worldDefinition.scenery.flowerBeds) for (let y = bed.y; y < bed.y + bed.height; y += 1) for (let x = bed.x; x < bed.x + bed.width; x += 1) {
      this.add.image(x * 16, y * 16, 'flower-bed').setOrigin(0).setDepth(3);
    }
    for (const tree of this.worldDefinition.scenery.trees) {
      const footX = tree.trunk.x * 16 + 8;
      const footY = tree.trunk.y * 16 + 16;
      this.add.image(tree.trunk.x * 16, tree.trunk.y * 16, 'tree-trunk').setOrigin(0).setDepth(footY - 1);
      const canopy = this.add.image(footX, footY - 22, 'tree-canopy').setDepth(footY);
      this.renderedForegrounds.push({ object: canopy, bounds: canopy.getBounds(), baselineY: footY });
    }
  }

  private renderWorkProps(): void {
    const props: Array<[keyof typeof PROP_ASSETS, number, number]> = [
      ['board', 5, 7], ['bookshelf', 8, 7], ['appleDesk', 18, 7], ['appleTerminal', 22, 7],
      ['server', 31, 7], ['lamp', 34, 7], ['appleSofa', 20, 17], ['crate', 34, 14],
    ];
    for (const [key, x, y] of props) {
      const image = this.add.image(x * 16 + 8, y * 16 + 8, `prop-${key}`).setDepth(y * 16 + 15);
      if (key.startsWith('apple')) image.setScale(0.5);
    }
  }
}
```

When Task 7 registers building roofs, store the three roof rectangles in `renderedForegrounds` as well; this task only establishes the field and tree entries.

- [ ] **Step 8: Verify the scenery, navigation, typecheck, and build**

Run:

```bash
cd pixelworld_mvp
npm test -- sceneryDefinition.test.ts aStar.test.ts validateWorld.test.ts
npm run typecheck
npm run build
```

Expected: scenery and all station paths pass, no selected asset import is missing, and the production build succeeds.

- [ ] **Step 9: Commit static village rendering and copied licenses**

```bash
git add pixelworld_mvp/public/assets/kenney pixelworld_mvp/public/assets/appledog pixelworld_mvp/src/rendering/assetManifest.ts pixelworld_mvp/src/rendering/createVillageTextures.ts pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/sceneryDefinition.test.ts
git commit -m "feat(pixelworld): render licensed outdoor work village"
```

---

### Task 6: Agent path following, actions, registry, and clone lifecycle

**Files:**
- Create: `pixelworld_mvp/src/agents/pathFollower.ts`
- Create: `pixelworld_mvp/src/agents/ActionController.ts`
- Create: `pixelworld_mvp/src/agents/AgentController.ts`
- Create: `pixelworld_mvp/src/agents/AgentRegistry.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Test: `pixelworld_mvp/tests/pathFollower.test.ts`

**Interfaces:**
- Consumes: `findPath`, `NavigationGrid`, `StationAssignment`, `BehaviorRoute`, `AGENT_SKINS`, `TILE_SIZE`.
- Produces: `PathFollower.setPath(path)`, `PathFollower.update(deltaMs)`, `AgentController.dispatch(assignment, route)`, `AgentController.update(deltaMs)`, `AgentRegistry.createSubagent()`, and `WorldScene.dispatchWorldEvent(event)`.

- [ ] **Step 1: Write failing deterministic path-follower tests**

Create `tests/pathFollower.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PathFollower } from '../src/agents/pathFollower';

describe('PathFollower', () => {
  it('moves only on path segments, reports facing, and arrives exactly at the target', () => {
    const follower = new PathFollower(16, 32);
    follower.setPath([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }]);
    const first = follower.update(250);
    expect(first.facing).toBe('right');
    expect(first.arrived).toBe(false);
    let snapshot = first;
    for (let index = 0; index < 20 && !snapshot.arrived; index += 1) snapshot = follower.update(100);
    expect(snapshot.arrived).toBe(true);
    expect(snapshot.position).toEqual({ x: 40, y: 56 });
  });

  it('replaces an active route without retaining old waypoints', () => {
    const follower = new PathFollower(16, 32);
    follower.setPath([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    follower.setPath([{ x: 1, y: 1 }, { x: 1, y: 2 }]);
    expect(follower.update(100).facing).toBe('down');
  });
});
```

- [ ] **Step 2: Run the test and verify the follower is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- pathFollower.test.ts
```

Expected: FAIL because `PathFollower` does not exist.

- [ ] **Step 3: Implement delta-time waypoint following**

Create `src/agents/pathFollower.ts`:

```ts
import type { Facing, GridPoint } from '../world/types';

export interface PixelPoint { x: number; y: number }
export interface FollowerSnapshot { position: PixelPoint; facing: Facing; moving: boolean; arrived: boolean }

export class PathFollower {
  private waypoints: PixelPoint[] = [];
  private index = 0;
  private position: PixelPoint = { x: 0, y: 0 };
  private facing: Facing = 'down';

  constructor(private readonly tileSize: number, private readonly speedPixelsPerSecond: number) {}

  setPath(path: GridPoint[]): void {
    this.waypoints = path.map((point) => ({
      x: point.x * this.tileSize + this.tileSize / 2,
      y: point.y * this.tileSize + this.tileSize / 2,
    }));
    this.position = { ...this.waypoints[0]! };
    this.index = Math.min(1, this.waypoints.length);
  }

  update(deltaMs: number): FollowerSnapshot {
    let distanceLeft = this.speedPixelsPerSecond * deltaMs / 1000;
    while (distanceLeft > 0 && this.index < this.waypoints.length) {
      const target = this.waypoints[this.index]!;
      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      this.facing = Math.abs(dx) > 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (distanceLeft >= distance) {
        this.position = { ...target };
        this.index += 1;
        distanceLeft -= distance;
      } else {
        const ratio = distanceLeft / distance;
        this.position = { x: this.position.x + dx * ratio, y: this.position.y + dy * ratio };
        distanceLeft = 0;
      }
    }
    const arrived = this.index >= this.waypoints.length;
    return { position: { ...this.position }, facing: this.facing, moving: !arrived, arrived };
  }
}
```

- [ ] **Step 4: Add arrival action effects with one controller API**

Create `src/agents/ActionController.ts`:

```ts
import Phaser from 'phaser';
import type { AgentAction } from '../world/types';

const ICONS: Record<AgentAction, string> = {
  arrive: '✦', ponder: '…', plan: '▤', read: '▥', type: '⌨', terminal: '>_',
  signal: '⌁', dispatch: '◇', respond: '➤', queue: '⌛', repair: '⚒',
  rest: 'z', offline: '×', pulse: '•',
};

export class ActionController {
  private readonly icon: Phaser.GameObjects.Text;
  private tween?: Phaser.Tweens.Tween;
  private baseY = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly sprite: Phaser.GameObjects.Image) {
    this.icon = scene.add.text(sprite.x, sprite.y - 18, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#fff8d6', backgroundColor: '#24382a', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(20_000).setVisible(false);
  }

  start(action: AgentAction): void {
    this.stop();
    this.baseY = this.sprite.y;
    this.icon.setText(ICONS[action]).setVisible(action !== 'arrive');
    this.tween = this.scene.tweens.add({
      targets: this.sprite, y: this.baseY - (action === 'rest' ? 0 : 1),
      duration: action === 'ponder' ? 600 : 320, yoyo: true, repeat: -1, ease: 'Stepped',
    });
  }

  pulse(): void {
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.55, duration: 90, yoyo: true });
  }

  update(): void { this.icon.setPosition(this.sprite.x, this.sprite.y - 18); }
  stop(): void {
    if (this.tween) { this.tween.stop(); this.sprite.setY(this.baseY); }
    this.tween = undefined;
    this.sprite.setAlpha(1);
    this.icon.setVisible(false);
  }
  destroy(): void { this.stop(); this.icon.destroy(); }
}
```

- [ ] **Step 5: Implement an Agent controller that always asks A* for destination changes**

Create `src/agents/AgentController.ts`:

```ts
import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import { findPath } from '../navigation/aStar';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS, type AgentSkin } from '../rendering/assetManifest';
import type { StationAssignment } from '../stations/stationAllocator';
import type { AgentWorldEvent, BehaviorRoute, Facing, GridPoint } from '../world/types';
import { ActionController } from './ActionController';
import { PathFollower } from './pathFollower';

export class AgentController {
  readonly sprite: Phaser.GameObjects.Image;
  readonly actions: ActionController;
  readonly role: 'main' | 'subagent';
  currentEvent?: AgentWorldEvent;
  currentRoute?: BehaviorRoute;
  currentAssignment?: StationAssignment;
  currentPath: GridPoint[] = [];
  private readonly follower = new PathFollower(TILE_SIZE, 48);
  private facing: Facing = 'down';
  private moving = false;
  private arriveCallback?: () => void;
  private renderOffsetX = 0;

  constructor(
    scene: Phaser.Scene,
    readonly agentId: string,
    role: 'main' | 'subagent',
    spawn: GridPoint,
    private readonly grid: NavigationGrid,
    private readonly skin: AgentSkin = role === 'main' ? AGENT_SKINS.main : AGENT_SKINS.subagent,
  ) {
    this.role = role;
    this.sprite = scene.add.image(spawn.x * 16 + 8, spawn.y * 16 + 8, this.skin.idle.down).setOrigin(0.5, 0.82);
    this.actions = new ActionController(scene, this.sprite);
  }

  tilePosition(): GridPoint {
    return { x: Math.floor((this.sprite.x - this.renderOffsetX) / TILE_SIZE), y: Math.floor(this.sprite.y / TILE_SIZE) };
  }

  clearRenderOffset(): void {
    this.sprite.x -= this.renderOffsetX;
    this.renderOffsetX = 0;
  }

  applyRenderOffset(offsetX: number): void {
    this.renderOffsetX = Phaser.Math.Clamp(offsetX, -6, 6);
    this.sprite.x += this.renderOffsetX;
  }

  dispatch(event: AgentWorldEvent, assignment: StationAssignment, route: BehaviorRoute, onArrive?: () => void): boolean {
    const path = findPath(this.grid, this.tilePosition(), assignment.point);
    if (!path) return false;
    this.actions.stop();
    this.currentEvent = event;
    this.currentRoute = route;
    this.currentAssignment = assignment;
    this.currentPath = path;
    this.arriveCallback = onArrive;
    this.follower.setPath(path);
    this.moving = path.length > 1;
    if (!this.moving) this.arrive();
    return true;
  }

  heartbeat(): void { this.actions.pulse(); }

  update(deltaMs: number): void {
    if (this.moving) {
      const snapshot = this.follower.update(deltaMs);
      this.facing = snapshot.facing;
      this.sprite.setPosition(snapshot.position.x, snapshot.position.y).setTexture(this.skin.active[this.facing]);
      if (snapshot.arrived) this.arrive();
    }
    this.actions.update();
  }

  private arrive(): void {
    this.moving = false;
    this.currentPath = [];
    this.sprite.setTexture(this.skin.idle[this.currentAssignment?.facing ?? this.facing]);
    const action = this.currentAssignment?.kind === 'queue'
      ? 'queue'
      : (this.currentRoute?.action ?? this.currentAssignment?.action ?? 'arrive');
    this.actions.start(action);
    const callback = this.arriveCallback;
    this.arriveCallback = undefined;
    callback?.();
  }
}
```

- [ ] **Step 6: Add the Agent registry and deterministic subagent IDs**

Create `src/agents/AgentRegistry.ts`:

```ts
import Phaser from 'phaser';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS } from '../rendering/assetManifest';
import type { GridPoint } from '../world/types';
import { AgentController } from './AgentController';

export class AgentRegistry {
  private readonly agents = new Map<string, AgentController>();
  private selectedId = 'main';
  private nextSubagent = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly grid: NavigationGrid, spawn: GridPoint) {
    this.agents.set('main', new AgentController(scene, 'main', 'main', spawn, grid, AGENT_SKINS.main));
  }

  createSubagent(spawn: GridPoint): AgentController {
    const agentId = `subagent-${this.nextSubagent++}`;
    const skin = Number(agentId.split('-')[1]) % 2 === 0 ? AGENT_SKINS.branch : AGENT_SKINS.subagent;
    const agent = new AgentController(this.scene, agentId, 'subagent', spawn, this.grid, skin);
    this.agents.set(agentId, agent);
    return agent;
  }

  get(agentId: string): AgentController | undefined { return this.agents.get(agentId); }
  all(): AgentController[] { return [...this.agents.values()]; }
  selected(): AgentController { return this.agents.get(this.selectedId)!; }
  select(agentId: string): boolean {
    if (!this.agents.has(agentId)) return false;
    this.selectedId = agentId;
    return true;
  }
  update(deltaMs: number): void {
    this.agents.forEach((agent) => agent.clearRenderOffset());
    this.agents.forEach((agent) => agent.update(deltaMs));
    const groups = new Map<string, AgentController[]>();
    this.agents.forEach((agent) => {
      const key = `${Math.round(agent.sprite.x)},${Math.round(agent.sprite.y)}`;
      groups.set(key, [...(groups.get(key) ?? []), agent]);
    });
    groups.forEach((group) => group.forEach((agent, index) => {
      agent.applyRenderOffset((index - (group.length - 1) / 2) * 3);
    }));
  }
}
```

- [ ] **Step 7: Compose ingress, allocation, A*, clone-on-arrival, and route errors in WorldScene**

Add these fields and imports to `WorldScene`:

```ts
import { AgentRegistry } from '../agents/AgentRegistry';
import { EventIngress } from '../events/eventIngress';
import { StationAllocator } from '../stations/stationAllocator';
import type { AgentWorldEvent } from '../world/types';

private readonly ingress = new EventIngress();
private readonly allocator = new StationAllocator(WORLD_DEFINITION.stations);
private agents!: AgentRegistry;
private readonly listeners = new Set<() => void>();
private lastError = '';
```

At the end of `create()`, before emitting `world-ready`, create the registry:

```ts
this.agents = new AgentRegistry(this, this.navigationGrid, this.worldDefinition.spawn);
```

Add these methods and the Scene update method:

```ts
update(_time: number, delta: number): void { this.agents?.update(delta); }

dispatchWorldEvent(event: AgentWorldEvent): { ok: boolean; reason?: string } {
  const result = this.ingress.ingest(event);
  if (!result.accepted) return { ok: false, reason: result.reason };
  const agent = this.agents.get(event.agentId);
  if (!agent) return { ok: false, reason: 'unknown-agent' };
  if (result.route.preserveLocation) {
    if (event.kind === 'heartbeat') {
      agent.heartbeat();
      return { ok: true };
    }
    return { ok: false, reason: 'unknown-event' };
  }
  const previous = this.allocator.assignmentFor(event.agentId);
  const excluded = new Set<string>();
  let triedAnchor = false;
  while (true) {
    const allocation = this.allocator.assign(event.agentId, result.route.destinationId!, excluded);
    if (!allocation.ok) {
      if (previous) this.allocator.restore(previous); else this.allocator.releaseAgent(event.agentId);
      const reason = triedAnchor ? 'no-path' : allocation.reason;
      this.lastError = reason;
      return { ok: false, reason };
    }
    triedAnchor = true;
    const effectiveRoute = allocation.assignment.kind === 'queue'
      ? { ...result.route, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: '等待工作位', priority: 80 }
      : result.route;
    const onArrive = event.kind === 'clone' && allocation.assignment.kind === 'interaction'
      ? () => { this.agents.createSubagent(allocation.assignment.point); this.notifyRoster(); }
      : undefined;
    if (agent.dispatch(result.event, allocation.assignment, effectiveRoute, onArrive)) return { ok: true };
    excluded.add(allocation.assignment.anchorId);
    this.allocator.releaseAgent(event.agentId);
  }
}

agentList(): Array<{ id: string; role: 'main' | 'subagent' }> {
  return this.agents.all().map((agent) => ({ id: agent.agentId, role: agent.role }));
}
selectAgent(agentId: string): boolean { return this.agents.select(agentId); }
selectedAgentId(): string { return this.agents.selected().agentId; }
selectedAgent(): import('../agents/AgentController').AgentController { return this.agents.selected(); }
onRosterChanged(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
private notifyRoster(): void { this.listeners.forEach((listener) => listener()); }
```

- [ ] **Step 8: Verify follower logic, full typecheck, build, and commit**

Run:

```bash
cd pixelworld_mvp
npm test -- pathFollower.test.ts aStar.test.ts stationAllocator.test.ts
npm run typecheck
npm run build
```

Expected: the follower tests pass, all Phaser-facing code typechecks, and Vite builds.

Commit:

```bash
git add pixelworld_mvp/src/agents/pathFollower.ts pixelworld_mvp/src/agents/ActionController.ts pixelworld_mvp/src/agents/AgentController.ts pixelworld_mvp/src/agents/AgentRegistry.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/pathFollower.test.ts
git commit -m "feat(pixelworld): move Agents through assigned A-star routes"
```

---

### Task 7: Foot-Y depth sorting and selected-Agent foreground fading

**Files:**
- Create: `pixelworld_mvp/src/rendering/DepthOcclusionSystem.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Test: `pixelworld_mvp/tests/depthOcclusion.test.ts`

**Interfaces:**
- Consumes: `AgentRegistry` sprites and `WorldScene.renderedForegrounds`.
- Produces: `depthFromFootY(footY, tieBreaker)`, `shouldFadeForeground(agentBounds, foregroundBounds, agentFootY, baselineY)`, and `DepthOcclusionSystem.update(selectedAgent)`.

- [ ] **Step 1: Write failing depth/fade tests**

Create `tests/depthOcclusion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { depthFromFootY, shouldFadeForeground } from '../src/rendering/DepthOcclusionSystem';

describe('depth and foreground occlusion', () => {
  it('uses foot Y with a stable tie breaker', () => {
    expect(depthFromFootY(160, 2)).toBe(160.002);
    expect(depthFromFootY(160, 3)).toBeGreaterThan(depthFromFootY(160, 2));
  });

  it('fades only when the selected Agent is fully covered and behind the baseline', () => {
    const foreground = { x: 10, y: 10, width: 48, height: 48 };
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 35, 58)).toBe(true);
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 70, 58)).toBe(false);
    expect(shouldFadeForeground({ x: 0, y: 0, width: 12, height: 20 }, foreground, 20, 58)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the system is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- depthOcclusion.test.ts
```

Expected: FAIL because the depth helpers do not exist.

- [ ] **Step 3: Implement deterministic foot-Y depth and 500 ms fade timing**

Create `src/rendering/DepthOcclusionSystem.ts`:

```ts
import type Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import type { RenderedForeground } from '../scenes/WorldScene';

export const depthFromFootY = (footY: number, tieBreaker: number): number =>
  Math.round(footY) + tieBreaker / 1000;

interface Bounds { x: number; y: number; width: number; height: number }

export function shouldFadeForeground(
  agentBounds: Bounds,
  foregroundBounds: Bounds,
  agentFootY: number,
  baselineY: number,
): boolean {
  const fullyCovered = agentBounds.x >= foregroundBounds.x && agentBounds.y >= foregroundBounds.y &&
    agentBounds.x + agentBounds.width <= foregroundBounds.x + foregroundBounds.width &&
    agentBounds.y + agentBounds.height <= foregroundBounds.y + foregroundBounds.height;
  return agentFootY < baselineY && fullyCovered;
}

export class DepthOcclusionSystem {
  private readonly coveredSince = new Map<RenderedForeground, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly foregrounds: RenderedForeground[],
    private readonly agents: () => AgentController[],
  ) {}

  update(selected: AgentController): void {
    this.agents().forEach((agent, index) => agent.sprite.setDepth(depthFromFootY(agent.sprite.y, index + 1)));
    const now = this.scene.time.now;
    const selectedBounds = selected.sprite.getBounds();
    for (const foreground of this.foregrounds) {
      const covered = shouldFadeForeground(selectedBounds, foreground.bounds, selected.sprite.y, foreground.baselineY);
      if (!covered) {
        this.coveredSince.delete(foreground);
        foreground.object.setAlpha(1);
        continue;
      }
      const since = this.coveredSince.get(foreground) ?? now;
      this.coveredSince.set(foreground, since);
      foreground.object.setAlpha(now - since >= 500 ? 0.6 : 1);
    }
  }
}
```

- [ ] **Step 4: Register building roofs and update depth every frame**

In `renderBuildings()`, retain each roof rectangle and register it:

```ts
const roof = this.add.rectangle(x * 16 - 4, y * 16 - 8, width * 16 + 8, 28, 0x343b4f)
  .setOrigin(0)
  .setDepth((y + height) * 16);
this.renderedForegrounds.push({
  object: roof,
  bounds: roof.getBounds(),
  baselineY: (y + height) * 16,
});
```

Add a `DepthOcclusionSystem` field, initialize it after `AgentRegistry`, and update it after Agent movement:

```ts
import { DepthOcclusionSystem } from '../rendering/DepthOcclusionSystem';

private depthSystem!: DepthOcclusionSystem;

// in create(), after this.agents is assigned
this.depthSystem = new DepthOcclusionSystem(this, this.renderedForegrounds, () => this.agents.all());

// replace update()
update(_time: number, delta: number): void {
  this.agents?.update(delta);
  if (this.depthSystem && this.agents) this.depthSystem.update(this.agents.selected());
}
```

- [ ] **Step 5: Verify and commit depth/occlusion behavior**

Run:

```bash
cd pixelworld_mvp
npm test -- depthOcclusion.test.ts pathFollower.test.ts
npm run typecheck
npm run build
```

Expected: depth tests pass and rendering builds without fixed global z-index assumptions for Agents.

Commit:

```bash
git add pixelworld_mvp/src/rendering/DepthOcclusionSystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/depthOcclusion.test.ts
git commit -m "feat(pixelworld): add foot-Y environmental occlusion"
```

---

### Task 8: Persistent Agent chips, transient bubbles, and building activity aggregation

**Files:**
- Create: `pixelworld_mvp/src/status/buildingActivity.ts`
- Create: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Test: `pixelworld_mvp/tests/buildingActivity.test.ts`

**Interfaces:**
- Consumes: `AgentWorldEvent`, `BehaviorRoute`, `AgentController`, `WorldBuilding`, and station `buildingId`.
- Produces: `aggregateBuildingActivity(activities, buildingId, now)`, `StatusOverlaySystem.attachAgent(agent)`, `publish(agent, event, route, buildingId)`, `showError(agent, message)`, and `update()`.

- [ ] **Step 1: Write failing aggregation/priority tests**

Create `tests/buildingActivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aggregateBuildingActivity, type AgentActivity } from '../src/status/buildingActivity';

const activity = (overrides: Partial<AgentActivity>): AgentActivity => ({
  agentId: 'main', buildingId: 'build-workshop', action: 'type', label: '修改程式',
  bubbleText: '修改程式', bubblePolicy: 'transient', priority: 40, updatedAt: 1, bubbleExpiresAt: 5,
  ...overrides,
});

describe('aggregateBuildingActivity', () => {
  it('counts occupants by action and chooses persistent/high-priority copy', () => {
    const summary = aggregateBuildingActivity([
      activity({ agentId: 'main', action: 'type' }),
      activity({ agentId: 'subagent-1', action: 'terminal', updatedAt: 2 }),
      activity({ agentId: 'subagent-2', action: 'repair', bubbleText: '工作受阻', bubblePolicy: 'persistent', priority: 100, updatedAt: 3, bubbleExpiresAt: Number.POSITIVE_INFINITY }),
    ], 'build-workshop', 10);
    expect(summary).toEqual({
      count: 3,
      actionCounts: { type: 1, terminal: 1, repair: 1 },
      message: '工作受阻',
      messagePersistent: true,
    });
  });

  it('returns an empty summary when no Agent is assigned to the building', () => {
    expect(aggregateBuildingActivity([], 'knowledge-hall', 10)).toEqual({
      count: 0, actionCounts: {}, message: '', messagePersistent: false,
    });
  });

  it('keeps the occupant count but expires ordinary building copy after four seconds', () => {
    expect(aggregateBuildingActivity([activity({ bubbleExpiresAt: 5 })], 'build-workshop', 6)).toMatchObject({
      count: 1, message: '', messagePersistent: false,
    });
  });
});
```

- [ ] **Step 2: Run the test and verify aggregation is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- buildingActivity.test.ts
```

Expected: FAIL because the status aggregation module does not exist.

- [ ] **Step 3: Implement building count, action summary, and message priority**

Create `src/status/buildingActivity.ts`:

```ts
import type { AgentAction } from '../world/types';

export interface AgentActivity {
  agentId: string;
  buildingId?: string;
  action: AgentAction;
  label: string;
  bubbleText: string;
  bubblePolicy: 'none' | 'transient' | 'persistent';
  priority: number;
  updatedAt: number;
  bubbleExpiresAt: number;
}
export interface BuildingActivitySummary {
  count: number;
  actionCounts: Partial<Record<AgentAction, number>>;
  message: string;
  messagePersistent: boolean;
}

export const ACTION_ICONS: Record<AgentAction, string> = {
  arrive: '✦', ponder: '…', plan: '▤', read: '▥', type: '⌨', terminal: '>_',
  signal: '⌁', dispatch: '◇', respond: '➤', queue: '⌛', repair: '⚒',
  rest: 'z', offline: '×', pulse: '•',
};

export function aggregateBuildingActivity(
  activities: AgentActivity[],
  buildingId: string,
  now: number,
): BuildingActivitySummary {
  const occupants = activities.filter((activity) => activity.buildingId === buildingId);
  const actionCounts: Partial<Record<AgentAction, number>> = {};
  occupants.forEach((activity) => { actionCounts[activity.action] = (actionCounts[activity.action] ?? 0) + 1; });
  const message = [...occupants]
    .filter((activity) => activity.bubblePolicy === 'persistent' || activity.bubbleExpiresAt > now)
    .sort((left, right) =>
      Number(right.bubblePolicy === 'persistent') - Number(left.bubblePolicy === 'persistent') ||
      right.priority - left.priority || right.updatedAt - left.updatedAt,
    )[0];
  return {
    count: occupants.length,
    actionCounts,
    message: message?.bubbleText ?? '',
    messagePersistent: message?.bubblePolicy === 'persistent',
  };
}
```

- [ ] **Step 4: Implement Phaser status chips, four-second bubbles, and building badges**

Create `src/rendering/StatusOverlaySystem.ts`:

```ts
import Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import { ACTION_ICONS, aggregateBuildingActivity, type AgentActivity } from '../status/buildingActivity';
import type { AgentWorldEvent, BehaviorRoute, WorldBuilding } from '../world/types';

interface AgentOverlay {
  chip: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text;
  bubbleExpiresAt: number;
}

export class StatusOverlaySystem {
  private readonly overlays = new Map<string, AgentOverlay>();
  private readonly activities = new Map<string, AgentActivity>();
  private readonly buildingBadges = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene, buildings: WorldBuilding[]) {
    for (const building of buildings) {
      const badge = scene.add.text(building.labelAnchor.x * 16, building.labelAnchor.y * 16 + 11, '', {
        fontFamily: 'monospace', fontSize: '8px', color: '#f7f2d0', backgroundColor: '#263c2d', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 0).setDepth(20_001).setVisible(false);
      this.buildingBadges.set(building.id, badge);
    }
  }

  attachAgent(agent: AgentController): void {
    if (this.overlays.has(agent.agentId)) return;
    const chip = this.scene.add.text(agent.sprite.x, agent.sprite.y - 16, agent.role === 'main' ? 'main · idle' : agent.agentId, {
      fontFamily: 'monospace', fontSize: agent.role === 'main' ? '8px' : '7px', color: '#ffffff', backgroundColor: '#17281ddd', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(20_000);
    const bubble = this.scene.add.text(agent.sprite.x, agent.sprite.y - 34, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#203126', backgroundColor: '#fff8d6', padding: { x: 4, y: 3 },
    }).setOrigin(0.5, 1).setDepth(20_002).setVisible(false);
    this.overlays.set(agent.agentId, { chip, bubble, bubbleExpiresAt: 0 });
  }

  publish(agent: AgentController, event: AgentWorldEvent, route: BehaviorRoute, buildingId?: string): void {
    this.attachAgent(agent);
    const overlay = this.overlays.get(agent.agentId)!;
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    overlay.chip.setText(`${prefix} · ${ACTION_ICONS[route.action]} ${event.activityLabel}`);
    let bubbleExpiresAt = 0;
    if (route.bubblePolicy === 'none') {
      overlay.bubble.setVisible(false);
      overlay.bubbleExpiresAt = 0;
    } else {
      overlay.bubble.setText(route.bubbleText).setVisible(true);
      bubbleExpiresAt = route.bubblePolicy === 'persistent'
        ? Number.POSITIVE_INFINITY
        : this.scene.time.now + 4000;
      overlay.bubbleExpiresAt = bubbleExpiresAt;
    }
    this.activities.set(agent.agentId, {
      agentId: agent.agentId,
      ...(buildingId ? { buildingId } : {}),
      action: route.action,
      label: event.activityLabel,
      bubbleText: route.bubbleText,
      bubblePolicy: route.bubblePolicy,
      priority: route.priority,
      updatedAt: event.timestamp,
      bubbleExpiresAt,
    });
    this.refreshBuildings();
  }

  showError(agent: AgentController, message: string): void {
    this.attachAgent(agent);
    const overlay = this.overlays.get(agent.agentId)!;
    overlay.bubble.setText(message).setVisible(true);
    overlay.bubbleExpiresAt = Number.POSITIVE_INFINITY;
  }

  update(agents: AgentController[]): void {
    for (const agent of agents) {
      const overlay = this.overlays.get(agent.agentId);
      if (!overlay) continue;
      overlay.chip.setPosition(agent.sprite.x, agent.sprite.y - 16);
      overlay.bubble.setPosition(agent.sprite.x, agent.sprite.y - 31);
      if (overlay.bubbleExpiresAt !== Number.POSITIVE_INFINITY && this.scene.time.now >= overlay.bubbleExpiresAt) {
        overlay.bubble.setVisible(false);
      }
    }
    this.refreshBuildings();
  }

  private refreshBuildings(): void {
    const activities = [...this.activities.values()];
    for (const [buildingId, badge] of this.buildingBadges) {
      const summary = aggregateBuildingActivity(activities, buildingId, this.scene.time.now);
      if (summary.count === 0) { badge.setVisible(false); continue; }
      const counts = Object.entries(summary.actionCounts)
        .map(([action, count]) => `${ACTION_ICONS[action as keyof typeof ACTION_ICONS]}${count}`)
        .join(' ');
      badge.setText(`👥${summary.count} ${counts}${summary.message ? `\n${summary.message}` : ''}`).setVisible(true);
    }
  }
}
```

- [ ] **Step 5: Publish accepted events and update overlays from WorldScene**

Add the system field/import and initialize it after `AgentRegistry`:

```ts
import { StatusOverlaySystem } from '../rendering/StatusOverlaySystem';

private statusOverlay!: StatusOverlaySystem;

// in create()
this.statusOverlay = new StatusOverlaySystem(this, this.worldDefinition.buildings);
this.agents.all().forEach((agent) => this.statusOverlay.attachAgent(agent));
```

In the `dispatchWorldEvent` retry loop, replace the allocation-failure return and successful-dispatch return with these exact branches:

```ts
if (!allocation.ok) {
  if (previous) this.allocator.restore(previous); else this.allocator.releaseAgent(event.agentId);
  const reason = triedAnchor ? 'no-path' : allocation.reason;
  this.lastError = reason;
  this.statusOverlay.showError(agent, reason === 'no-path' ? '⚠ 無法抵達' : '⚠ 工作區已滿');
  return { ok: false, reason };
}

// after effectiveRoute and onArrive are created
if (agent.dispatch(result.event, allocation.assignment, effectiveRoute, onArrive)) {
  const station = this.worldDefinition.stations.find((item) => item.id === result.route.destinationId);
  this.statusOverlay.publish(agent, result.event, effectiveRoute, station?.buildingId);
  return { ok: true };
}
```

Inside the clone `onArrive` callback, attach the new subagent before notifying the roster:

```ts
const subagent = this.agents.createSubagent(allocation.assignment.point);
this.statusOverlay.attachAgent(subagent);
this.notifyRoster();
```

Update overlays after movement/depth in `update()`:

```ts
this.statusOverlay?.update(this.agents.all());
```

- [ ] **Step 6: Verify priority/status logic, typecheck, build, and commit**

Run:

```bash
cd pixelworld_mvp
npm test -- buildingActivity.test.ts behaviorRouter.test.ts
npm run typecheck
npm run build
```

Expected: persistent Blocked activity wins building copy, no raw event `detail` is rendered, and the build succeeds.

Commit:

```bash
git add pixelworld_mvp/src/status/buildingActivity.ts pixelworld_mvp/src/rendering/StatusOverlaySystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/buildingActivity.test.ts
git commit -m "feat(pixelworld): visualize Agent and building status"
```

---

### Task 9: Test panel, Agent selection, demo triggers, and debug overlays

**Files:**
- Create: `pixelworld_mvp/src/ui/demoEvents.ts`
- Create: `pixelworld_mvp/src/ui/TestPanel.ts`
- Create: `pixelworld_mvp/src/debug/DebugOverlay.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Test: `pixelworld_mvp/tests/demoEvents.test.ts`

**Interfaces:**
- Consumes: `WorldScene.dispatchWorldEvent`, `agentList`, `selectAgent`, `selectedAgentId`, `NavigationGrid`, Agent current paths, and world station anchors.
- Produces: `createDemoEvent(kind, agent, sequence, timestamp)`, the user-visible test panel, `WorldScene.dispatchDemo(kind)`, and toggleable debug layers.

- [ ] **Step 1: Write failing demo-event tests**

Create `tests/demoEvents.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDemoEvent } from '../src/ui/demoEvents';

describe('createDemoEvent', () => {
  it('creates deterministic, normalized events for the selected Agent', () => {
    expect(createDemoEvent('edit', { id: 'subagent-2', role: 'subagent' }, 7, 123)).toEqual({
      eventId: 'demo-7-edit-subagent-2', timestamp: 123, source: 'demo', agentId: 'subagent-2',
      agentRole: 'subagent', kind: 'edit', phase: 'working', activityLabel: '修改程式',
    });
  });

  it('uses preserve-phase copy for heartbeat without inventing raw detail', () => {
    const event = createDemoEvent('heartbeat', { id: 'main', role: 'main' }, 8, 124);
    expect(event.phase).toBe('preserve_phase');
    expect(event.activityLabel).toBe('仍在工作');
    expect(event.detail).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify the demo adapter is missing**

Run:

```bash
cd pixelworld_mvp
npm test -- demoEvents.test.ts
```

Expected: FAIL because `createDemoEvent` does not exist.

- [ ] **Step 3: Implement the only demo-to-domain adapter**

Create `src/ui/demoEvents.ts`:

```ts
import type { AgentWorldEvent, WorldEventKind } from '../world/types';

export interface AgentOption { id: string; role: 'main' | 'subagent' }
const COPY: Record<WorldEventKind, { phase: string; label: string }> = {
  session_start: { phase: 'initializing', label: '初始化' },
  think: { phase: 'thinking', label: '思考中' },
  plan: { phase: 'planning', label: '規劃工作' },
  read: { phase: 'reading_files', label: '查閱檔案' },
  edit: { phase: 'working', label: '修改程式' },
  tool: { phase: 'tool_using', label: '使用工具' },
  web: { phase: 'external_tool', label: '連接服務' },
  clone: { phase: 'collaborating', label: '建立 Subagent' },
  respond: { phase: 'responding', label: '輸出結果' },
  await: { phase: 'awaiting_input', label: '等待輸入' },
  blocked: { phase: 'blocked', label: '工作受阻' },
  self_heal: { phase: 'self_healing', label: '自我修復' },
  idle: { phase: 'idle', label: '休息' },
  offline: { phase: 'offline', label: '離線' },
  heartbeat: { phase: 'preserve_phase', label: '仍在工作' },
  unknown: { phase: 'unknown', label: '未知狀態' },
};

export function createDemoEvent(
  kind: WorldEventKind,
  agent: AgentOption,
  sequence: number,
  timestamp = Date.now(),
): AgentWorldEvent {
  const copy = COPY[kind];
  return {
    eventId: `demo-${sequence}-${kind}-${agent.id}`,
    timestamp,
    source: 'demo',
    agentId: agent.id,
    agentRole: agent.role,
    kind,
    phase: copy.phase,
    activityLabel: copy.label,
  };
}
```

- [ ] **Step 4: Implement exact debug layers for navigation, paths, stations, and depth**

Create `src/debug/DebugOverlay.ts`:

```ts
import Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import { TILE_SIZE } from '../game/constants';
import type { NavigationGrid } from '../navigation/navigationGrid';
import type { WorldDefinition } from '../world/types';

export type DebugLayerName = 'grid' | 'collision' | 'paths' | 'anchors' | 'depth';

export class DebugOverlay {
  private readonly layers = new Map<DebugLayerName, Phaser.GameObjects.Graphics>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: NavigationGrid,
    private readonly world: WorldDefinition,
    private readonly agents: () => AgentController[],
  ) {
    (['grid', 'collision', 'paths', 'anchors', 'depth'] as const).forEach((name) => {
      this.layers.set(name, scene.add.graphics().setDepth(30_000).setVisible(false));
    });
    this.drawStatic();
  }

  setVisible(name: DebugLayerName, visible: boolean): void { this.layers.get(name)!.setVisible(visible); }

  update(): void {
    const paths = this.layers.get('paths')!.clear().lineStyle(1, 0xfff176, 0.9);
    const depth = this.layers.get('depth')!.clear().lineStyle(1, 0xff6b8a, 0.9);
    for (const agent of this.agents()) {
      if (agent.currentPath.length > 1) {
        paths.beginPath();
        agent.currentPath.forEach((point, index) => {
          const x = point.x * TILE_SIZE + 8;
          const y = point.y * TILE_SIZE + 8;
          index === 0 ? paths.moveTo(x, y) : paths.lineTo(x, y);
        });
        paths.strokePath();
      }
      depth.lineBetween(agent.sprite.x - 7, agent.sprite.y, agent.sprite.x + 7, agent.sprite.y);
    }
  }

  private drawStatic(): void {
    const gridLayer = this.layers.get('grid')!.lineStyle(1, 0xffffff, 0.12);
    for (let x = 0; x <= this.world.width; x += 1) gridLayer.lineBetween(x * 16, 0, x * 16, this.world.height * 16);
    for (let y = 0; y <= this.world.height; y += 1) gridLayer.lineBetween(0, y * 16, this.world.width * 16, y * 16);
    const collisions = this.layers.get('collision')!.fillStyle(0xff385c, 0.28);
    this.grid.blockedPoints().forEach((point) => collisions.fillRect(point.x * 16, point.y * 16, 16, 16));
    const anchors = this.layers.get('anchors')!;
    for (const station of this.world.stations) {
      anchors.fillStyle(0x45f0a8, 0.75);
      station.interactionSlots.forEach((slot) => anchors.fillCircle(slot.point.x * 16 + 8, slot.point.y * 16 + 8, 3));
      anchors.fillStyle(0xffd166, 0.75);
      station.queueAnchors.forEach((point) => anchors.fillCircle(point.x * 16 + 8, point.y * 16 + 8, 3));
    }
  }
}
```

- [ ] **Step 5: Add demo dispatch and debug methods to WorldScene**

Add fields/imports:

```ts
import { DebugOverlay, type DebugLayerName } from '../debug/DebugOverlay';
import { createDemoEvent } from '../ui/demoEvents';
import type { WorldEventKind } from '../world/types';

private debugOverlay!: DebugOverlay;
private demoSequence = 1;
```

Initialize after the Agent registry and include the update call:

```ts
this.debugOverlay = new DebugOverlay(this, this.navigationGrid, this.worldDefinition, () => this.agents.all());
this.agents.all().forEach((agent) => this.bindAgentSelection(agent));

// in update()
this.debugOverlay?.update();
```

Add these public methods:

```ts
dispatchDemo(kind: WorldEventKind): { ok: boolean; reason?: string } {
  const selected = this.agents.selected();
  return this.dispatchWorldEvent(createDemoEvent(
    kind,
    { id: selected.agentId, role: selected.role },
    this.demoSequence++,
  ));
}
setDebugLayer(name: DebugLayerName, visible: boolean): void { this.debugOverlay.setVisible(name, visible); }

selectAgent(agentId: string): boolean {
  const selected = this.agents.select(agentId);
  if (selected) this.notifyRoster();
  return selected;
}

private bindAgentSelection(agent: import('../agents/AgentController').AgentController): void {
  agent.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectAgent(agent.agentId));
}
```

Remove the earlier one-line `selectAgent` method from Task 6 so this notifying version is the only definition. In the clone arrival callback, call `this.bindAgentSelection(subagent)` immediately after `this.statusOverlay.attachAgent(subagent)`.

- [ ] **Step 6: Build the selectable test panel with all approved buttons**

Create `src/ui/TestPanel.ts`:

```ts
import type { DebugLayerName } from '../debug/DebugOverlay';
import type { WorldScene } from '../scenes/WorldScene';
import type { WorldEventKind } from '../world/types';

const ACTIONS: Array<[WorldEventKind, string]> = [
  ['session_start', 'Session Start'], ['think', 'Thinking'], ['plan', 'Planning'],
  ['read', 'Reading'], ['edit', 'Working / Edit'], ['tool', 'Tool Using / Bash'],
  ['web', 'Web / MCP'], ['clone', 'Clone Agent'], ['respond', 'Responding'],
  ['await', 'Awaiting Input'], ['blocked', 'Blocked'], ['self_heal', 'Self-healing'],
  ['idle', 'Idle / Stop'], ['offline', 'Offline'], ['heartbeat', 'Heartbeat'],
];
const DEBUG_LAYERS: DebugLayerName[] = ['grid', 'collision', 'paths', 'anchors', 'depth'];

export class TestPanel {
  private readonly roster = document.createElement('select');
  private readonly log = document.createElement('ol');
  private unsubscribe?: () => void;

  constructor(private readonly root: HTMLElement, private readonly world: WorldScene) {
    root.dataset.expanded = 'true';
    root.replaceChildren();
    const title = document.createElement('h1');
    title.textContent = 'Agent Test Panel';
    const toggle = document.createElement('button');
    toggle.textContent = '收合 / 展開';
    toggle.addEventListener('click', () => { root.dataset.expanded = root.dataset.expanded !== 'true' ? 'true' : 'false'; });
    this.roster.addEventListener('change', () => world.selectAgent(this.roster.value));
    const actions = document.createElement('div');
    actions.className = 'panel-grid';
    ACTIONS.forEach(([kind, label]) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.dataset.kind = kind;
      button.addEventListener('click', () => this.dispatch(kind));
      actions.append(button);
    });
    const debug = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Debug overlays';
    debug.append(legend);
    DEBUG_LAYERS.forEach((name) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => world.setDebugLayer(name, input.checked));
      label.append(input, ` ${name}`);
      debug.append(label);
    });
    const reset = document.createElement('button');
    reset.textContent = 'Reset Demo';
    reset.addEventListener('click', () => window.location.reload());
    this.log.className = 'event-log';
    root.append(title, toggle, this.roster, actions, debug, reset, this.log);
    this.refreshRoster();
    this.unsubscribe = world.onRosterChanged(() => this.refreshRoster());
  }

  destroy(): void { this.unsubscribe?.(); this.root.replaceChildren(); }

  private dispatch(kind: WorldEventKind): void {
    const agentId = this.world.selectedAgentId();
    const result = this.world.dispatchDemo(kind);
    const item = document.createElement('li');
    item.textContent = result.ok ? `${agentId} → ${kind}` : `${agentId} · ${kind} · ${result.reason}`;
    this.log.prepend(item);
    while (this.log.children.length > 12) this.log.lastElementChild?.remove();
  }

  private refreshRoster(): void {
    const selected = this.world.selectedAgentId();
    this.roster.replaceChildren(...this.world.agentList().map((agent) => {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.role === 'main' ? '★' : '◇'} ${agent.id}`;
      option.selected = agent.id === selected;
      return option;
    }));
  }
}
```

- [ ] **Step 7: Bind the panel only after the world scene is ready**

Replace `src/main.ts` with:

```ts
import { createGame } from './game/createGame';
import type { WorldScene } from './scenes/WorldScene';
import { TestPanel } from './ui/TestPanel';
import './styles.css';

createGame('game-root', (world: WorldScene) => {
  const root = document.querySelector<HTMLElement>('#test-panel-root');
  if (!root) throw new Error('Missing #test-panel-root');
  new TestPanel(root, world);
});
```

Append panel styles to `src/styles.css`:

```css
#test-panel-root { padding: 10px; color: #eaf3e8; }
#test-panel-root h1 { margin: 0 0 8px; font-size: 14px; }
#test-panel-root button, #test-panel-root select { min-height: 30px; border: 1px solid #52735d; border-radius: 4px; color: #edf8ee; background: #203528; font: inherit; }
#test-panel-root button:hover { background: #31503b; }
#test-panel-root select { width: 100%; margin: 8px 0; }
.panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#test-panel-root fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 10px 0; border-color: #41604c; font-size: 11px; }
.event-log { min-height: 80px; margin: 10px 0 0; padding-left: 20px; color: #bcd4c1; font-size: 10px; }
@media (max-width: 840px) {
  #test-panel-root[data-expanded='false'] > :not(button) { display: none; }
  #test-panel-root[data-expanded='false'] { overflow: hidden; }
}
```

- [ ] **Step 8: Verify demo contracts and production build**

Run:

```bash
cd pixelworld_mvp
npm test -- demoEvents.test.ts behaviorRouter.test.ts eventIngress.test.ts
npm run typecheck
npm run build
```

Expected: demo events are normalized, Heartbeat has no detail, and the complete app builds.

- [ ] **Step 9: Commit the test/debug interface**

```bash
git add pixelworld_mvp/src/ui/demoEvents.ts pixelworld_mvp/src/ui/TestPanel.ts pixelworld_mvp/src/debug/DebugOverlay.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/src/main.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/demoEvents.test.ts
git commit -m "feat(pixelworld): add Agent behavior test panel"
```

---

### Task 10: Documentation, automated verification, browser acceptance, and CodeGraph refresh

**Files:**
- Create: `pixelworld_mvp/README.md`
- Create: `pixelworld_mvp/ATTRIBUTION.md`
- Modify only if verification reveals a defect: files created in Tasks 1–9 and their focused tests

**Interfaces:**
- Consumes: the complete standalone MVP.
- Produces: repeatable install/run/test instructions, asset attribution, browser acceptance evidence, and a CodeGraph index current with the committed MVP.

- [ ] **Step 1: Write the exact standalone README**

Create `pixelworld_mvp/README.md`:

````markdown
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
````

- [ ] **Step 2: Record all bundled asset obligations**

Create `pixelworld_mvp/ATTRIBUTION.md`:

```markdown
# Asset Attribution

## Kenney RPG Urban Pack

- Creator: Kenney
- Source: https://kenney.nl/assets/rpg-urban-pack
- License: CC0 1.0
- Local license copies: `public/assets/kenney/License.txt` and `public/assets/kenney/LICENSE-THIRD-PARTY.txt`

Selected Agent and prop tiles are copied unchanged from the repository-bundled pack.

## Modern Interior Tileset

- Creator: Apple Dog
- Source: https://apple-dog.itch.io/modern-tileset-by-appledog
- Terms recorded by the parent project: free for commercial and non-commercial use with Apple Dog credited
- Local attribution copy: `public/assets/appledog/ATTRIBUTION.txt`

Selected work furniture crops are used only for this standalone MVP.

## Original MVP graphics

Terrain, paths, pond, flowers, tree layers, and building color blocks generated by `src/rendering/createVillageTextures.ts` are original project graphics and do not reproduce protected Pokémon assets.
```

- [ ] **Step 3: Run the complete automated verification suite**

Run:

```bash
cd pixelworld_mvp
npm test
npm run typecheck
npm run build
```

Expected:

```text
Test Files  11 passed
Tests       all passed
TypeScript  exit 0
Vite build  exit 0; dist/index.html created
```

If a command fails, use the `systematic-debugging` skill, add a focused failing regression test, apply the minimal fix, rerun the focused test, then rerun all three commands before continuing.

- [ ] **Step 4: Start the app and perform browser acceptance with the browse skill**

Run in a persistent terminal:

```bash
cd pixelworld_mvp
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` with the `browse` skill and verify, in order:

1. The entire 40×22 village, all three buildings, and all four open zones are visible without moving the camera.
2. Click Working/Edit, Reading, Tool Using/Bash, Web/MCP, Awaiting, Blocked, Self-healing, Responding, and Idle/Stop; each action produces an A* path to the named zone and the matching arrival action.
3. While an Agent is moving, click another destination. The old path disappears and a new path begins from the current tile.
4. While an Agent is moving or working, click Heartbeat. Its path/action continues and only a pulse appears.
5. Enable `grid`, `collision`, `paths`, `anchors`, and `depth`; confirm paths never cross red blocked tiles and final positions match green or amber anchors.
6. Route the selected Agent around `tree-west-path`; confirm the canopy draws above the Agent behind the tree and the Agent draws above it in front.
7. Keep the selected Agent fully behind a canopy for at least 500 ms; confirm only that foreground fades to 60% opacity and restores after departure.
8. Click Clone Agent ten times, waiting for each dispatch arrival. Confirm `subagent-1` through `subagent-10` appear in the selector.
9. Assign five Agents to the two-slot/two-queue Editing Desk. Confirm distinct interaction slots are used first, the next two Agents use queue anchors, and the fifth remains at its last legal position with `⚠ 工作區已滿`.
10. Trigger Blocked for one assigned Agent and Working for another. Confirm the persistent Blocked message is not replaced by normal Working copy.
11. Resize the browser to 1280×720 and 1920×1080 proportions. The complete village remains visible, centered, sharp, and letterboxed when necessary.
12. Inspect the browser console. Expected: no unhandled exception, failed asset request, canvas warning, or missing texture error.

Save one full-village screenshot with the panel visible and one screenshot with all debug overlays enabled as acceptance evidence in the execution summary; do not add screenshots to git unless the user requests them.

- [ ] **Step 5: Fix only defects found by acceptance, with regression tests**

For each defect:

1. Name the violated acceptance item.
2. Add or extend the closest focused test (`aStar`, `stationAllocator`, `depthOcclusion`, `buildingActivity`, or `demoEvents`) so it fails for the defect.
3. Run that test and record the expected failure.
4. Apply the smallest implementation fix.
5. Run the focused test, then `npm test`, `npm run typecheck`, and `npm run build`.

Do not expand phase-one scope to interiors, backend hooks, camera following, player keyboard control, or new buildings while fixing acceptance defects.

- [ ] **Step 6: Refresh CodeGraph after all code changes**

From the repository root, run:

```bash
codegraph update
codegraph status
```

Expected: update completes successfully, index state is complete, and pending added/modified/removed files and pending references are all zero.

- [ ] **Step 7: Run final verification-before-completion and commit docs/final fixes**

Invoke the `verification-before-completion` skill, then rerun:

```bash
cd pixelworld_mvp
npm test
npm run typecheck
npm run build
```

Stage only README, attribution, and files changed to fix verified defects:

```bash
git add pixelworld_mvp/README.md pixelworld_mvp/ATTRIBUTION.md
git commit -m "docs(pixelworld): document MVP operation and assets"
```

If acceptance fixes exist, stage their exact source/test paths in a separate commit before the documentation commit, using a message that names the corrected behavior.

The final execution handoff must report the three verification command results, browser acceptance results, CodeGraph status, created commit hashes, and the local URL used for user review.

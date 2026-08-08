# Agent Animation, Modern Office, and Village Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add correct four-direction six-frame Agent walking animation, replace every interior furniture render with the privately installed Modern Office Revamped v1.2 family, and densify the fixed 48×28 village to 12 Hook-oriented buildings connected by loop roads.

**Architecture:** A pure animation-profile module will be shared by exterior and interior renderers. Purchased assets will be installed by a local-only extraction script into a gitignored private directory and exposed through one manifest. World density remains data-driven in `worldDefinition.ts`, while routing changes stay in `behaviorRouter.ts` and validation/tests prove every door remains A*-reachable.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, Bash/unzip, Python pytest, CodeGraph.

## Global Constraints

- Keep the world exactly 48×28 tiles with a fixed global camera.
- Use Adam authored frames: idle right 0, up 1, left 2, down 3; walk right 24–29, up 30–35, left 36–41, down 42–47.
- Do not horizontally mirror the Agent to synthesize a direction.
- All visible interior room tiles and furniture must come from Modern Office Revamped v1.2; Adam remains the character source.
- Purchased assets must live under `pixelworld_mvp/public/assets/private/modern-office-v1.2/` and must not be committed.
- Preserve furniture bounds, door-reservation, overlap checks, drag editing, and building-specific localStorage saves.
- Increase the village from 8 to 12 functional buildings and route Awaiting, Blocked/Self-healing, Heartbeat, and Offline to their own destinations.
- Every destination must remain reachable through outside and threshold cells using orthogonal A*.

---

### Task 1: Shared Authored Agent Animation

**Files:**
- Create: `pixelworld_mvp/src/rendering/agentAnimation.ts`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/src/agents/AgentController.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/agentAnimation.test.ts`
- Test: `pixelworld_mvp/tests/agentBuildingTransit.test.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Produces: `AgentAnimationProfile`, `ADAM_ANIMATION`, and `agentAnimationFrame(profile, facing, moving, elapsedMs): number`.
- Produces: `InteriorMotionState.walking: boolean` for the cutaway renderer.
- Consumes: existing `Facing`, `AgentSkin`, and `interiorMotionAt` data.

- [ ] **Step 1: Write failing authored-frame tests**

```ts
expect(agentAnimationFrame(ADAM_ANIMATION, 'right', false, 0)).toBe(0);
expect(agentAnimationFrame(ADAM_ANIMATION, 'left', false, 0)).toBe(2);
expect([0, 100, 200, 300, 400, 500].map((ms) =>
  agentAnimationFrame(ADAM_ANIMATION, 'right', true, ms)
)).toEqual([24, 25, 26, 27, 28, 29]);
expect(agentAnimationFrame(ADAM_ANIMATION, 'left', true, 200)).toBe(38);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run tests/agentAnimation.test.ts tests/agentBuildingTransit.test.ts tests/interiorMotion.test.ts`

Expected: FAIL because `agentAnimation.ts` and `InteriorMotionState.walking` do not exist and the current left/right mapping is reversed.

- [ ] **Step 3: Implement the pure animation profile**

```ts
export interface AgentAnimationProfile {
  idle: Readonly<Record<Facing, number>>;
  walk: Readonly<Record<Facing, readonly number[]>>;
  frameMs: number;
}

export const ADAM_ANIMATION: AgentAnimationProfile = {
  idle: { right: 0, up: 1, left: 2, down: 3 },
  walk: {
    right: [24, 25, 26, 27, 28, 29],
    up: [30, 31, 32, 33, 34, 35],
    left: [36, 37, 38, 39, 40, 41],
    down: [42, 43, 44, 45, 46, 47],
  },
  frameMs: 100,
};

export function agentAnimationFrame(
  profile: AgentAnimationProfile,
  facing: Facing,
  moving: boolean,
  elapsedMs: number,
): number {
  if (!moving) return profile.idle[facing];
  const frames = profile.walk[facing];
  return frames[Math.floor(Math.max(0, elapsedMs) / profile.frameMs) % frames.length]!;
}
```

- [ ] **Step 4: Wire the profile into exterior and interior motion**

Add `animation: ADAM_ANIMATION` to the main `AgentSkin`. Replace the main Agent's `agentFrameIndex` call during movement with `agentAnimationFrame(this.skin.animation, this.facing, true, this.walkClockMs)`. On arrival call it with `moving=false`.

Add `walking` to `InteriorMotionState`: ingress returns `true`; working returns `transition > 0 && transition < 1`. In `InteriorCutawaySystem`, choose the frame from `agentAnimationFrame` using `snapshot.interiorElapsedMs` while `motion.walking` is true.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run tests/agentAnimation.test.ts tests/agentBuildingTransit.test.ts tests/interiorMotion.test.ts tests/renderingContracts.test.ts`

Expected: all focused tests PASS; rightward movement uses frames 24–29, leftward movement uses 36–41, and stopped Agents use frame 0 or 2 correctly.

```bash
git add pixelworld_mvp/src/rendering/agentAnimation.ts pixelworld_mvp/src/rendering/assetManifest.ts pixelworld_mvp/src/agents/AgentController.ts pixelworld_mvp/src/rendering/interiorMotion.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/agentAnimation.test.ts pixelworld_mvp/tests/agentBuildingTransit.test.ts pixelworld_mvp/tests/interiorMotion.test.ts pixelworld_mvp/tests/renderingContracts.test.ts
git commit -m "fix: animate agents with authored directional frames"
```

### Task 2: Private Modern Office Asset Installation

**Files:**
- Create: `pixelworld_mvp/scripts/install-modern-office-assets.sh`
- Create: `pixelworld_mvp/src/rendering/modernOfficeManifest.ts`
- Modify: `.gitignore`
- Modify: `pixelworld_mvp/public/assets/ASSET_SOURCES.md`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Test: `pixelworld_mvp/tests/modernOfficeManifest.test.ts`

**Interfaces:**
- Produces: `MODERN_OFFICE_ASSETS`, `ModernOfficeFurnitureKind`, and `modernOfficeAsset(kind)`.
- Produces local files under `/assets/private/modern-office-v1.2/` without adding them to Git.
- Consumes `/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip`.

- [ ] **Step 1: Write failing manifest and privacy tests**

```ts
expect(MODERN_OFFICE_ASSETS.atlas.path).toBe('/assets/private/modern-office-v1.2/Modern_Office_16x16.png');
expect(MODERN_OFFICE_ASSETS.roomBuilder.path).toContain('Room_Builder_Office_16x16.png');
for (const kind of ['sofa', 'office-chair', 'computer', 'bookcase', 'whiteboard']) {
  expect(modernOfficeAsset(kind as ModernOfficeFurnitureKind).path)
    .toMatch(/^\/assets\/private\/modern-office-v1\.2\//);
}
```

Also assert `.gitignore` contains `pixelworld_mvp/public/assets/private/modern-office-v1.2/`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/modernOfficeManifest.test.ts`

Expected: FAIL because the private manifest and installer do not exist.

- [ ] **Step 3: Implement the checked extraction script**

The script must default to `/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip`, accept an optional ZIP path, verify `LICENSE.txt`, `Modern_Office_16x16.png`, `1_Room_Builder_Office/Room_Builder_Office_16x16.png`, and the selected `4_Modern_Office_singles/16x16/*.png`, then extract only the allowlisted files to the ignored private directory.

```bash
ZIP_PATH="${1:-/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip}"
TARGET_DIR="$(cd "$(dirname "$0")/.." && pwd -P)/public/assets/private/modern-office-v1.2"
test -f "$ZIP_PATH" || { echo "Modern Office archive not found: $ZIP_PATH" >&2; exit 1; }
unzip -l "$ZIP_PATH" LICENSE.txt Modern_Office_16x16.png >/dev/null
mkdir -p "$TARGET_DIR"
unzip -jo "$ZIP_PATH" Modern_Office_16x16.png LICENSE.txt -d "$TARGET_DIR"
unzip -jo "$ZIP_PATH" 1_Room_Builder_Office/Room_Builder_Office_16x16.png -d "$TARGET_DIR"
```

Extend the allowlist with the exact singles selected during atlas inspection. The script must never extract the full archive.

- [ ] **Step 4: Implement the private manifest and install assets**

Define every furniture type used by the cutaway and palette in `MODERN_OFFICE_ASSETS`. Run:

`bash scripts/install-modern-office-assets.sh /home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip`

Expected: the private target contains the atlas, room builder, license, and all allowlisted singles; `git status --short` does not list those binaries.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run tests/modernOfficeManifest.test.ts tests/renderingContracts.test.ts`

```bash
git add .gitignore pixelworld_mvp/scripts/install-modern-office-assets.sh pixelworld_mvp/src/rendering/modernOfficeManifest.ts pixelworld_mvp/src/rendering/assetManifest.ts pixelworld_mvp/public/assets/ASSET_SOURCES.md pixelworld_mvp/tests/modernOfficeManifest.test.ts pixelworld_mvp/tests/renderingContracts.test.ts
git commit -m "feat: install licensed modern office assets privately"
```

### Task 3: Modern Office-Only Interior Rendering and Palette

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Consumes: `modernOfficeAsset(kind)` from Task 2 and `agentAnimationFrame` from Task 1.
- Preserves: `moveFurniture`, `addFurniture`, `saveInteriorLayout`, `loadInteriorLayout`, and `furnitureFootprint` behavior.
- Produces: Modern Office-only furniture sprites for both placed furniture and the editor palette.

- [ ] **Step 1: Write failing source-family and palette tests**

Add assertions that every rendered furniture image key begins with `modern-office-v1.2-`, no placed furniture falls back to `drawFurnitureShape`, and the palette contains sofa, chair, office chair, display/TV, PC station, desk, meeting table, bookcase, cabinet, whiteboard, plant, and beverage station.

```ts
expect(renderedFurnitureKeys.every((key) => key.startsWith('modern-office-v1.2-'))).toBe(true);
expect(FURNITURE_PALETTE).toEqual(expect.arrayContaining([
  'sofa', 'chair', 'computer', 'bookcase', 'television', 'meeting-table', 'planning-board', 'decor',
]));
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: FAIL because current furniture keys point at `modern-interiors-free` and several kinds use procedural shapes.

- [ ] **Step 3: Replace the room and furniture render path**

Use `MODERN_OFFICE_ASSETS.roomBuilder` for wall/floor tiles and `modernOfficeAsset` for every furniture kind. Delete `drawFurnitureShape` from the production render path. Map functional aliases to office-family sprites:

```ts
const officeKindForFurniture: Record<FurnitureKind, ModernOfficeFurnitureKind> = {
  sofa: 'sofa', chair: 'office-chair', television: 'display', bed: 'sofa',
  bookcase: 'bookcase', computer: 'computer', 'map-table': 'meeting-table',
  'planning-board': 'whiteboard', 'reading-desk': 'desk', workbench: 'desk',
  'tool-wall': 'cabinet', 'repair-table': 'desk', 'dispatch-pod': 'computer',
  'radio-console': 'computer', 'response-desk': 'desk', 'meeting-table': 'meeting-table', decor: 'plant',
};
```

For rest/offline semantics, use an office lounge sofa or couch rather than importing the old bedroom furniture.

- [ ] **Step 4: Preserve editing, collision, and saves**

Keep footprints semantic rather than image-pixel based. When loading saved custom items, translate old furniture kinds through `officeKindForFurniture`; reject only invalid geometry, not old asset keys. Verify drag rejection still returns the original layout and valid placement increases the furniture count by one.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts tests/assetManifest.test.ts`

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/src/world/interiorDefinitions.ts pixelworld_mvp/src/world/types.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts pixelworld_mvp/tests/interiorMotion.test.ts pixelworld_mvp/tests/assetManifest.test.ts
git commit -m "feat: unify interiors on modern office assets"
```

### Task 4: Twelve Functional Buildings and Loop Roads

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/events/behaviorRouter.ts`
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Modify: `pixelworld_mvp/src/world/validateWorld.ts`
- Test: `pixelworld_mvp/tests/behaviorRouter.test.ts`
- Test: `pixelworld_mvp/tests/sceneryDefinition.test.ts`
- Test: `pixelworld_mvp/tests/villageRoutes.test.ts`
- Test: `pixelworld_mvp/tests/villageSystemAcceptance.test.ts`
- Test: `pixelworld_mvp/tests/validateWorld.test.ts`

**Interfaces:**
- Produces new theme IDs `awaiting-post`, `recovery-clinic`, `heartbeat-tower`, and `offline-dormitory`.
- Produces building IDs with the same names and dedicated stations.
- Changes event destinations: `await → awaiting-post`, `blocked/self_heal → recovery-clinic`, `heartbeat → heartbeat-tower`, `offline → offline-dormitory`.

- [ ] **Step 1: Write failing density, routing, and graph tests**

```ts
expect(WORLD_DEFINITION.buildings).toHaveLength(12);
expect(routeFor('await').destinationId).toBe('awaiting-post');
expect(routeFor('blocked').destinationId).toBe('recovery-clinic');
expect(routeFor('self_heal').destinationId).toBe('recovery-clinic');
expect(routeFor('heartbeat').destinationId).toBe('heartbeat-tower');
expect(routeFor('offline').destinationId).toBe('offline-dormitory');
```

For each building, assert A* returns a path from spawn through `entrance.outside` to `entrance.threshold`. Build a road adjacency graph and assert every road cell belongs to the same connected component and at least two independent cycles exist (`edges - vertices + 1 >= 2`).

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/behaviorRouter.test.ts tests/sceneryDefinition.test.ts tests/villageRoutes.test.ts tests/villageSystemAcceptance.test.ts tests/validateWorld.test.ts`

Expected: FAIL at building count, missing theme definitions, old destinations, and insufficient road cycles.

- [ ] **Step 3: Define the 12-building layout**

Use five northern houses, two middle houses, and five southern houses:

```ts
const buildings = [
  building('arrival-lodge', ..., 1, 2, 3),
  building('thinkers-cottage', ..., 9, 2, 11),
  building('archive-library', ..., 18, 2, 20),
  building('network-lab', ..., 31, 2, 33),
  building('heartbeat-tower', ..., 40, 2, 42),
  building('offline-dormitory', ..., 2, 11, 4),
  building('maker-workshop', ..., 39, 10, 41),
  building('tool-smithy', ..., 1, 20, 3),
  building('awaiting-post', ..., 9, 20, 11),
  building('collaboration-barn', ..., 18, 20, 20),
  building('recovery-clinic', ..., 31, 20, 33),
  building('rest-cabin', ..., 40, 20, 42),
];
```

Relax only the lateral aesthetic-gap validation from four tiles to two tiles; keep physical overlap forbidden.

- [ ] **Step 4: Build connected loop roads and rehome scenery**

Create northern avenue `y=7`, middle avenue `y=15`, and southern avenue `y=25`, plus vertical connectors at `x=3,11,20,25,30,33,41,44`. Preserve river columns 27–28 with bridges at y=15 and y=25. Use two-tile plaza/main-road segments where they do not overlap buildings; keep one-tile door alleys.

Move crop fields, pasture, orchard trees, decorations, and animals only when they collide with buildings or new roads. Every remaining large grass pocket must contain a field, pasture, orchard, flower bed, public prop cluster, or house.

- [ ] **Step 5: Add interiors, stations, and router destinations**

Add four Modern Office-based interior definitions with furniture supporting the routed actions. Add station slots at the corresponding building entrance/interior action points and update behavior routing exactly as specified in the interface block.

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm test -- --run tests/behaviorRouter.test.ts tests/sceneryDefinition.test.ts tests/villageRoutes.test.ts tests/villageSystemAcceptance.test.ts tests/validateWorld.test.ts tests/villageRenderer.test.ts`

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/src/world/interiorDefinitions.ts pixelworld_mvp/src/events/behaviorRouter.ts pixelworld_mvp/src/rendering/VillageRenderer.ts pixelworld_mvp/src/world/validateWorld.ts pixelworld_mvp/tests/behaviorRouter.test.ts pixelworld_mvp/tests/sceneryDefinition.test.ts pixelworld_mvp/tests/villageRoutes.test.ts pixelworld_mvp/tests/villageSystemAcceptance.test.ts pixelworld_mvp/tests/validateWorld.test.ts pixelworld_mvp/tests/villageRenderer.test.ts
git commit -m "feat: densify village with functional loop districts"
```

### Task 5: Full Verification and Visual QA

**Files:**
- Modify if required by findings: files touched in Tasks 1–4 only.
- Update: `.codegraph/` via `codegraph sync` without committing user-owned index state unless already tracked.

**Interfaces:**
- Consumes the completed animation, private office asset, interior, and world definitions.
- Produces a verified local review URL.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
cd pixelworld_mvp
npm test -- --run
npm run build
cd ..
python -m pytest -q
```

Expected: all Vitest files PASS, Vite production build exits 0, and all Python tests PASS.

- [ ] **Step 2: Browser-QA authored walking**

At `http://127.0.0.1:5173/`, dispatch actions that move right, left, up, and down. Capture at least two frames per direction and verify face direction matches travel and leg/arm pixels alternate. Open a destination immediately after entry and verify the indoor ingress also alternates frames along orthogonal segments.

- [ ] **Step 3: Browser-QA Modern Office and editor**

Open every distinct interior theme. Verify no old pink sofa, green bed, procedural PC, or non-office placeholder remains. Enable furniture edit mode, successfully add one office chair, reject one overlapping desk, save, close, reopen, and verify persistence.

- [ ] **Step 4: Browser-QA village density and routes**

Verify all 12 buildings are visible in the fixed camera, labels do not collide with the test panel, roads form readable loops, and no building/tree source pixels are clipped. Dispatch Awaiting, Blocked, Self-healing, Heartbeat, and Offline and confirm each Agent reaches the newly assigned front door before entering.

- [ ] **Step 5: Check console, URL, diff, and CodeGraph**

Run:

```bash
codegraph sync
codegraph status
curl -fsSI http://127.0.0.1:5173/
git diff --check
git status --short
```

Expected: CodeGraph reports up to date, URL returns HTTP 200, browser console has no errors, and `git diff --check` exits 0.

Do not commit the private asset directory. Preserve the worktree and running dev server for the user's next visual iteration.

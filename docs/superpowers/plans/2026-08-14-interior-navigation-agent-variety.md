# Interior Navigation and Agent Variety Implementation Plan

> Execute with test-driven development. Preserve unrelated working-tree changes and commit only scoped files.

**Goal:** Add an independently pannable/zoomable interior viewport and render stable, varied, directionally animated agents in both village and cutaway views.

**Architecture:** A pure interior viewport module owns zoom/pan math and gesture eligibility. `InteriorCutawaySystem` applies that transform to a dedicated room-content container while leaving the panel chrome fixed. A shared agent-skin resolver and frame resolver become the single identity/animation source for `AgentRegistry`, `AgentController`, and cutaway occupants.

**Tech stack:** TypeScript, Phaser 3, Vitest, Vite.

---

## Task 1: Interior viewport math and gesture contract

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorViewport.ts`
- Create: `pixelworld_mvp/tests/interiorViewport.test.ts`

1. Write failing tests for fitted state, pointer-anchored wheel zoom, pan threshold, pan bounds, resize clamping, and rejection over furniture/editor controls.
2. Run the focused test and preserve RED evidence.
3. Implement immutable viewport state helpers with finite-value guards.
4. Run the focused test and typecheck until GREEN.
5. Commit only the two scoped files.

## Task 2: Integrate room-local pan and zoom

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/gameConfig.test.ts`

1. Add failing integration tests proving wheel zoom and empty-space pan transform room content, while furniture drag, marquee, controls and village camera ownership remain isolated.
2. Put room shell, grid, furniture, occupants, debug geometry and room labels behind one room-content transform; keep modal chrome fixed.
3. Register and clean up wheel/pointer handlers and pointer capture without leaking between room switches or close/reopen.
4. Reproject DOM room labels through the same room viewport transform.
5. Verify direct room switch resets fit without an intermediate close flash, and resize reclamps the viewport.
6. Run focused tests and typecheck, then commit scoped files.

## Task 3: Shared stable agent skins and walk frames

**Files:**
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/src/rendering/agentAnimation.ts`
- Modify: `pixelworld_mvp/src/agents/AgentRegistry.ts`
- Modify: `pixelworld_mvp/src/agents/AgentController.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/agentAnimation.test.ts`
- Modify: `pixelworld_mvp/tests/renderingContracts.test.ts`
- Modify: `pixelworld_mvp/tests/agentRegistryLiveRoster.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

1. Write failing tests for deterministic ID-to-skin selection, variation across known agent IDs, consistent interior/exterior selection, authored idle frames, and changing directional walking frames.
2. Replace the private registry hash and cutaway role-only selection with one exported skin resolver.
3. Describe each bundled character sheet's real frame layout in `AgentSkin`; use one shared frame function in both render paths.
4. Confirm movement facing is applied before frame selection and arrival restores the assigned idle facing.
5. Run focused tests and typecheck, then commit scoped files.

## Task 4: Regression, browser QA, and deployment

**Files:**
- Modify only if a verified defect requires a scoped fix.
- Write report: `.superpowers/sdd/interior-navigation-agent-variety-report.md`

1. Run all Pixelworld Vitest tests, `tsc --noEmit`, and the Vite production build.
2. Run the repository Node and Python suites relevant to the deployed shell.
3. Start through ordinary `./run.sh start`; confirm image revision, health, private asset mount and HTTP resources.
4. In Chromium, open a room, wheel zoom around two pointer locations, pan empty space, drag furniture without camera motion, close and verify village pan returns.
5. Trigger several agents and verify distinct stable skins plus changing walk frames in exterior and interior routes.
6. Inspect console/network errors, update CodeGraph, and record evidence/limitations.

## Acceptance Criteria

- A zoomed room pans smoothly by dragging unused room space and cannot be lost offscreen.
- Room pan does not move the village, steal a furniture drag, or break marquee selection.
- DOM room labels remain aligned at every zoom/pan level.
- Main and subagents visibly use a deterministic pool rather than one universal character.
- Moving agents animate through direction-correct walking frames; idle agents retain a correct facing frame.
- Saved furniture layouts and authored furniture rotations remain unchanged.
- Focused and full automated suites, typecheck, build, live health, and browser smoke all pass.

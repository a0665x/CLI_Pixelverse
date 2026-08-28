# Retire Legacy Map And Localize Product Status Design

**Date:** 2026-08-28

## Objective

Make the Phaser village and its per-building second-layer interiors the only
supported visual world. Remove the hidden legacy multi-room dashboard map and
its YAML customization pipeline, while preserving the agent event bridge,
Codex hooks, Agent roster, ECG states, Agent detail, and four-locale UI.

## Product Decisions

1. The first layer is always the Phaser village rendered in
   `#pixelworld-frame`.
2. A building selection opens that building's second-layer interior cutaway.
3. Furniture editing belongs only to the active interior. The outer dashboard
   no longer offers a global `Move Furniture` command.
4. The old single-building/multi-room HTML map is not a fallback and is not a
   supported editor.
5. Runtime floorplan selection, custom YAML maps, and the browser map builder
   are retired.
6. The agent event bridge on port 4568 remains supported. Map customization
   endpoints and the event bridge are independent; only the former is removed.

## Current Root Causes

### Mixed-language status

`pixelverse_server.py` emits product-owned Chinese prose in `activity_hint`
for placeholder and stale agents. `currentAgentStatePresentation()` then treats
that field as an external task and places it directly in the top status line.
Changing the selected locale therefore translates the surrounding state and
room while leaving the Chinese activity string untouched.

### Legacy map appearing from Move Furniture

The outer `Move Furniture` button enables `furnitureEditMode`.
`applyMapLayerVisibility()` responds by hiding `#pixelworld-frame` and revealing
the hidden `.camera-stage`, whose `.district` nodes are the previous YAML-driven
multi-room map. This is intentional legacy routing, not a Phaser rendering
failure.

### Duplicate map architectures

The repository currently ships both:

- the active Phaser village, hard-coded world definition, and interior
  cutaways; and
- the retired HTML district renderer, `global_map` YAML parser, map-builder
  page, runtime map mount, floorplan selector, generator/checker scripts, and
  legacy furniture-layout API.

The second architecture adds startup choices and maintenance surface without
serving the approved product flow.

## Target Architecture

### Outer dashboard

The outer page owns only operational UI:

- top status and last-sync information;
- Agent roster, avatars, and ECG activity;
- Agent detail and mission/event panels;
- language and exposure controls; and
- the iframe bridge for snapshots, locale changes, and focus commands.

It does not render a world, rooms, furniture, doors, paths, or agents on a
second coordinate plane.

### Phaser world

The iframe owns all spatial presentation:

- village buildings and outdoor agents;
- building selection;
- interior cutaways;
- per-interior furniture editing and persistence;
- furniture alpha-mask collision; and
- interior agent navigation.

The existing `pixelverse.command.focus`, `pixelverse.world.snapshot`, and
`pixelverse.locale.update` contracts remain the boundary between dashboard and
world.

### Runtime service

The FastAPI service continues to expose world state, events, health, assets,
and agent lifecycle APIs. It no longer serves editable runtime global-map YAML
or accepts map-builder submissions. Docker Compose no longer mounts a runtime
map directory.

The port-4568 adapter bridge and project hook installation remain unchanged.

## Localization Contract

Product-owned state must cross the backend/frontend boundary as semantic data,
not display prose.

For source placeholders and stale agents, the backend supplies existing
machine-readable fields such as `connection_status`, `source_placeholder`,
`state`, and `room_key`. It must not synthesize Chinese display text in
`activity_hint` or `status_label`.

The dashboard derives localized product status from those fields for all four
supported locales:

- `en-US`
- `zh-TW`
- `ja-JP`
- `ko-KR`

External payloads remain verbatim. A task, prompt preview, tool response, or
user-authored message may naturally contain another language and must not be
machine-translated. Tests distinguish these external payloads from
Pixelverse-owned placeholder, stale, room, state, and control text.

The top status line for an awaiting English Codex source will therefore contain
only English Pixelverse copy, for example:

```text
codex · Idle · Standby Dock · Waiting for a new CLI session
```

## Legacy Removal Scope

### Outer UI and JavaScript

Remove:

- the global `Move Furniture`, save, and cancel controls;
- the outer furniture-edit banner and coordinate HUD;
- `.camera-stage`, `.house-shell`, `.district`, legacy doors, path layer, and
  legacy agents layer;
- legacy camera zoom/pan controls;
- cross-room HTML furniture drag logic and presentation switching; and
- imports and state used only by that renderer.

Retain any status, Agent detail, roster, event, or bridge module that is still
reachable from the village-first dashboard. Shared modules are split before
deletion when they contain both active and legacy responsibilities.

### Map configuration and HTTP surface

Remove:

- `run.sh floorplans`, `prepare-floorplan`, and `map-builder` commands;
- `PIXELVERSE_FLOORPLAN` and `PIXELVERSE_GLOBAL_MAP_DIR_HOST` behavior;
- startup/restart floorplan selection and saved runtime-map state;
- the Docker Compose global-map environment and bind mount;
- map-builder HTML/JavaScript and YAML submit endpoints;
- runtime `/global_map/*.yaml` customization behavior; and
- the legacy `/api/furniture-layout` endpoint when no active consumer remains.

`start` and `restart` retain agent source, exposure, port, adapter, and licensed
Modern Office asset preparation behavior.

### Files, scripts, tests, and documentation

Delete tracked map assets, generators, validators, and tests only after the
reference audit proves they are legacy-only. Replace broad architecture tests
with negative contracts asserting that retired commands, DOM layers, endpoints,
mounts, and startup prompts do not return.

README content becomes a single quickstart for the Phaser village and licensed
Modern Office assets. Historical design documents remain as project history,
but current operational instructions must not direct users to the retired map
builder or YAML workflow.

User-owned untracked maps are not silently deleted during implementation. They
will be listed separately after the tracked cleanup so the user can decide
whether to archive or remove them.

## Migration And Compatibility

This is an intentional removal, not a deprecation period.

- Existing custom YAML maps stop affecting the UI.
- Old floorplan environment variables are ignored or rejected with a concise
  migration message rather than selecting another UI architecture.
- Existing agent hooks and bridge clients continue to work.
- Existing interior layouts keep using the active interior persistence store.
- Existing language selection in local storage remains valid.

Restart should require no floorplan prompt and no generated runtime map pair.

## Error Handling

- If an obsolete floorplan command is supplied, `run.sh` exits non-zero and
  identifies that the village now uses a single built-in world.
- Unknown agent source or exposure settings retain their current validation.
- Missing Modern Office assets retain the existing fail-fast preparation
  guidance.
- Incomplete locale catalogs continue to be rejected by the locale controller.
- External task payloads are escaped and displayed verbatim; they are never
  mistaken for product-owned status copy.

## Testing Strategy

### Localization

- Backend tests assert placeholder and stale agents expose semantic status
  without Chinese product prose.
- Presenter tests cover the top state line in all four locales.
- Browser smoke switches all four locales and rejects foreign-script
  Pixelverse-owned copy in the top bar, roster status, controls, and cutaway
  chrome.
- Separate tests prove external payload text remains unchanged.

### Architecture retirement

- DOM tests assert the legacy camera stage, districts, and outer furniture
  controls are absent.
- `run.sh` tests assert start/restart never request a floorplan and retired map
  commands fail with migration guidance.
- Compose and release-integrity tests assert there is no runtime map mount.
- API tests assert map submission and legacy furniture-layout endpoints are
  absent.
- Reference scans ensure deleted map modules and assets are no longer imported
  or copied into the image.

### Preserved behavior

- Agent hook/bridge integration tests remain green.
- Agent roster, ECG, detail, and locale tests remain green.
- Phaser village and second-layer interior browser smoke remains green.
- Licensed furniture asset and alpha-collision tests remain green.
- Full Python, Vitest, production build, Docker image, health, and browser smoke
  checks run before completion.

## Completion Criteria

The cleanup is complete when:

1. English mode contains no Chinese Pixelverse-owned top-status text.
2. The global `Move Furniture` control and legacy multi-room map cannot be
   reached.
3. Furniture can still be edited inside an opened building interior.
4. Startup and restart contain no floorplan selection.
5. No supported route, command, mount, or documentation advertises YAML map
   customization.
6. Port 4568 agent bridge and Codex hooks continue to update village state.
7. The tracked repository contains no orphaned legacy-map implementation.
8. All required automated and browser verification passes.

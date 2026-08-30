# CLI_Pixelverse Village Frontend

This package is the Phaser village and interior frontend embedded by
CLI_Pixelverse. It renders backend Agent snapshots as outdoor characters,
building occupancy, room movement, speech bubbles, ECG-linked state, and
editable interior scenes.

## Requirements

- Node.js 20.19 or newer
- npm

## Run standalone

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Standalone mode is intended for frontend
development; the normal product is built and served through the repository
root `run.sh` Docker workflow.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Current behavior

- The complete outdoor village uses a fixed world with roads, buildings,
  Agent routing, A* movement, occupancy, depth occlusion, ambient animals, and
  zoom/pan controls.
- Production snapshots enter through the validated live-world adapter. Locale
  and Agent selection messages are synchronized with the parent dashboard.
- Clicking a building opens its current interior instead of switching to a
  separate legacy world.
- Interiors support furniture selection, drag placement, alpha-aware collision,
  walkability checks, undo, collection, shelf pagination, and saved layouts.
- Agent movement respects room boundaries and solid furniture while allowing
  intentional seating/sofa overlap.
- English, Traditional Chinese, Japanese, and Korean locale changes update the
  village chrome and interior controls without mixing product copy.
- Automated tests cover navigation, collision, furniture semantics, rendering,
  live snapshot ingress, locale ingress, and production build contracts.

## Integration boundary

The frontend consumes normalized Agent snapshots and lifecycle messages; it
does not invoke Agent CLIs directly. The root FastAPI service, CLI adapters,
Codex project hooks, Hermes integrations, and generic HTTP API are responsible
for producing that state.

## Art and rendering

- Outdoor and support art comes from the attributed assets under
  `public/assets/`.
- The separately purchased Modern Office pack is prepared into the
  Git-ignored `public/assets/private/modern-office-v1.2/` directory by the
  repository root asset workflow.
- Rendering uses nearest-neighbor scaling. No extracted Pokémon, Nintendo, or
  Game Freak assets are included.
- Canonical sources, license notes, selected files, and transformations are
  recorded in [`public/assets/ASSET_SOURCES.md`](public/assets/ASSET_SOURCES.md).

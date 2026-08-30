# GitHub Public Release Cleanup Design

## Purpose

Prepare `CLI_Pixelverse` for a public `origin/main` release that immediately
communicates the product, gives a portable beginner setup path, contains only
current functionality, and excludes local, licensed, generated, and historical
development artifacts.

## Approved Direction

Use the release-focused cleanup approach (option A). Preserve current runtime
features and their tests, but remove obsolete public documentation, retired map
workflows, internal planning history, machine-specific defaults, and superseded
preview media.

## Public Product Story

The repository homepage presents CLI_Pixelverse as a local pixel-village
observability dashboard for AI agent CLIs. The first screen must make these
capabilities clear:

- live Agent characters and lifecycle state;
- roster cards with project identity and ECG activity;
- click-through Agent details and recent events;
- village and editable room interiors;
- English, Traditional Chinese, Japanese, and Korean UI locales;
- Codex project binding plus documented adapter paths for other supported CLIs.

The two root screenshots `cli_pixelverse_demo_1.png` and
`cli_pixelverse_demo_2.png` replace the deleted `pixel_ui.gif` and older hero
images at the top of the README. Their captions distinguish the operational
dashboard from the interior editor.

## README Information Architecture

Replace the current duplicated 1,154-line README with one concise public guide:

1. title, one-sentence value proposition, and the two demo screenshots;
2. current feature summary;
3. prerequisites, including Docker Compose and the separately licensed Modern
   Office ZIP;
4. beginner Quick Start for cloning, placing the ZIP, and starting the village;
5. project binding and launch instructions using `$PIXELVERSE_ROOT` and
   `/path/to/your-project` placeholders;
6. a support matrix that distinguishes Codex project hooks, process-level CLI
   adapters, Hermes hooks, and the generic HTTP API without overstating test
   coverage;
7. everyday commands, configurable ports, and focused troubleshooting;
8. development verification and third-party asset/license references.

There must be only one Quick Start. Commands derive the clone location with
`pwd -P`; no documentation may contain `/home/a0665x`, `AI_AGX_WS`, or another
developer workstation assumption. Binding must explicitly explain that an
Agent appears only after a real CLI session emits an event.

## Portable Runtime Cleanup

Public runtime files must not contain developer-specific Hermes checkout or
binary defaults. Hermes discovery uses explicit environment variables,
standard executable discovery, and portable user configuration only. Remove or
replace the obsolete `pixelworld_mvp/scripts/install-modern-office-assets.sh`
path default; `run.sh` and `scripts/provision_modern_office_assets.py` remain the
canonical licensed-asset workflow.

Remove retired floorplan/map-builder command aliases and their migration-only
tests where they no longer represent supported behavior. The built-in Phaser
village and current room editor remain. Untracked `global_map/` files are user
artifacts and are ignored rather than published.

## Repository Surface And Hygiene

Keep:

- runtime Python, shell, TypeScript, HTML, and CSS sources;
- package manifests and Docker configuration;
- active automated tests and smoke scripts;
- public reference documentation, attribution, and third-party licenses;
- the two new demo screenshots.

Remove from the public tree:

- `docs/superpowers/**` design and implementation history;
- `.superpowers/sdd/**` internal execution reports;
- the superseded 18 MB `pixel_ui.gif`;
- obsolete planning/build-guide material that describes retired architecture;
- tracked compatibility code and tests whose only purpose is the retired YAML
  floorplan/map-builder workflow.

Ignore without deleting user-owned local data:

- `.cache/`, `.superpowers/`, `docs/plans/`, and `global_map/`;
- `.pixelverse-service/`, `private_assets/`, prepared licensed sprites, ZIPs,
  build output, dependency directories, test artifacts, local environment files,
  and editor/OS metadata.

The Docker build context continues to include only inputs needed at runtime.
Tests and public docs may remain excluded from the image without being excluded
from Git.

## Existing Worktree Changes

The working tree already contains current product fixes. Preserve and publish
the relevant locale-ingress, building hit-region, dependency, Modern Office
asset-reuse, and test changes after verification. Do not stage cache data,
untracked legacy maps, brainstorming output, or unrelated generated files.

## Verification And Release Gate

Before committing the release:

1. scan all tracked public files for `/home/a0665x`, `AI_AGX_WS`, private asset
   archives, generated licensed sprites, and retired floorplan terms;
2. validate README links, commands, screenshot paths, and heading structure;
3. run the complete Python test suite;
4. run the root JavaScript tests;
5. run the `pixelworld_mvp` Vitest suite and production build;
6. run shell syntax checks and project release-integrity tests;
7. build/start through `run.sh`, verify health, world snapshot, screenshots, and
   stop/restart behavior in proportion to the available licensed assets;
8. inspect the exact staged diff and ensure no secrets, local paths, paid ZIPs,
   or derived paid assets are included.

Commit the cleanup in reviewable commits, confirm `main` is based on the current
remote state, and push directly to `origin main` only after every release gate
passes. Never force-push.

## Success Criteria

- GitHub visitors understand the repository from the first viewport.
- A new user can clone anywhere and follow one portable Quick Start.
- The two requested screenshots render on GitHub.
- Current functionality and tests are retained.
- Old map workflows and internal development history are absent from the public
  tree.
- No developer-machine path, licensed ZIP, or generated licensed asset is
  committed.
- `origin/main` contains the verified release commits.

# Private Modern Office Assets and Alpha Navigation Design

Date: 2026-08-28
Status: Approved design awaiting written-spec review

## Goal

Restore the licensed Modern Office furniture sprites in local Docker builds, prevent black missing-texture blocks, and make indoor navigation use the transformed opaque-pixel silhouette instead of one rectangular opaque bound. A new user who has legally purchased the pack must be able to place one ZIP file in a documented repository directory and let `run.sh` prepare and build the complete environment.

## Product and licensing boundary

The required pack is LimeZu's **Modern Office - Revamped - RPG Tileset [16x16]**, distributed from <https://limezu.itch.io/modernoffice>. The vendor permits commercial and non-commercial use but prohibits redistributing the asset pack. Pixelverse therefore must not commit, publish, or download the paid files on a user's behalf.

The repository will contain only:

- setup and validation code;
- public instructions and the official purchase link;
- empty-directory guidance where useful;
- tests built from synthetic alpha shapes that do not reproduce paid artwork.

The following remain local and Git-ignored:

- `private_assets/modern-office/Modern_Office_Revamped_v1.zip`;
- extracted Modern Office PNG files;
- generated collision-mask data;
- any Docker image layer containing those files.

The README must warn users not to push the ZIP, extracted sprites, generated masks, or locally built image to a public registry.

## Selected approach

`run.sh` owns one automatic preparation gate before a Docker build. This was selected over runtime bind mounts because it gives one deterministic quickstart, avoids host-path coupling after startup, and verifies all required inputs before a user sees the UI.

The public quickstart is:

1. Clone Pixelverse into any path.
2. Purchase and download `Modern_Office_Revamped_v1.zip` from the official LimeZu page.
3. Create `private_assets/modern-office/` and place the ZIP there without renaming its contents.
4. Run `./run.sh start` (or `./run.sh restart` after the initial setup).

An optional `PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/file.zip` override may point to an existing legal download without copying it into the repository. Public documentation must use `$PWD` or a clone-derived root, never a developer-specific `/home/...` path.

## Asset preparation pipeline

A focused preparation program, called by `run.sh`, performs these steps:

1. Resolve the ZIP from the environment override or repository-local private-assets directory.
2. Reject a missing file with a concise error containing the official purchase URL, expected filename, destination directory, and retry command.
3. Inspect archive entries before extraction. Reject absolute paths, parent traversal, symlinks, unexpected file types, ambiguous duplicate target names, and archive entries outside the expected Modern Office structure.
4. Select the 16x16 single-sprite files under `4_Modern_Office_singles/16x16/` and normalize them into the existing runtime naming contract:
   `pixelworld_mvp/public/assets/private/modern-office-v1.2/Modern_Office_Singles_<id>.png`.
5. Require exactly the catalog IDs used by Pixelverse (1 through 339), valid PNG signatures, and the expected source dimensions. A partial or wrong-version archive fails closed.
6. Generate a versioned collision-mask manifest beside the extracted sprites. Its cache key includes the ZIP digest, extractor schema version, catalog version, and relevant generation parameters.
7. Write extracted files and the manifest through a temporary directory and atomically replace the prepared output only after validation succeeds. A failed run preserves the previously valid prepared directory.
8. Print a short success summary and continue into the existing Docker build.

The preparation step is idempotent: when the digest and schema match, `run.sh` reuses the prepared directory without extracting or regenerating masks.

## Docker build behavior

The current black blocks occur because `.dockerignore` excludes every `assets/private` directory, so the Vite build emits references to Modern Office PNGs but Docker never receives those PNGs. The corrected build contract is:

- `run.sh` invokes the preparation gate before every command path that may build or rebuild the service;
- `.dockerignore` continues to exclude arbitrary private assets but narrowly re-includes the prepared Modern Office output needed by this local image;
- the multi-stage Docker build copies the prepared PNGs and mask manifest into `/app/public/assets/private/modern-office-v1.2/`;
- a build-time verification step confirms required sprites and the mask manifest exist in the final stage;
- no paid file is added to Git or a source archive;
- missing paid assets stop before `docker compose build`, so a supported `run.sh` flow never falls through to Phaser's black missing-texture display.

`run.sh restart` keeps its non-interactive saved-setting behavior. It may rebuild automatically when the prepared-asset fingerprint, source build fingerprint, or explicit rebuild flag changes. A plain restart with matching fingerprints reuses the existing local image.

## Alpha navigation model

### Generated mask

For every single-sprite PNG, the preparation program reads the alpha channel and stores a compact opaque-pixel mask with source width, source height, opaque threshold, and row data. The manifest is generated locally and remains ignored because it is derived from paid artwork.

The runtime registers the manifest before an interior scene performs placement or pathfinding. Unit tests use synthetic masks supplied through the same interface.

### Transform and occupancy

Collision uses the same anchor, visual offset, scale, and 0/90/180/270-degree rotation as rendering. For a blocking furniture item:

1. transform the source alpha mask into room-grid coordinates;
2. project opaque pixels onto the navigation grid;
3. dilate the projected shape by the Agent feet clearance;
4. block only navigation cells whose Agent-feet sample intersects the dilated opaque shape.

Transparent corners and gaps remain walkable when they provide enough clearance. The implementation must not replace the transformed mask with its rectangular bounding box during navigation.

The existing opaque bounds remain useful for editor containment, broad-phase placement checks, selection outlines, and render geometry. Fine collision and route blocking use the alpha mask after a cheap bounding-box rejection.

### Semantic exceptions

- Floor-layer items and elevated items with `supportedByIds` do not add independent blockers.
- Chairs, office chairs, and sofas remain solid during ordinary walking and become passable only for an eligible seat/rest route.
- Beds remain solid except for the assigned offline/sleep route.
- A station interaction point may open only the explicitly eligible final access cell; it must not remove unrelated furniture blockers.
- Missing or invalid mask data is a hard preparation/build error in supported `run.sh` flows, not a silent rectangular fallback.

### Path safety

Route planning continues to fail closed: if the transformed masks and required clearance leave no route, the Agent stops at the last legal point and the localized blocked state is shown. It must not teleport or cross opaque pixels. Route invalidation continues to include furniture movement, scale, rotation, prefab changes, undo/redo, and reload; the mask/catalog schema version also participates in the navigation signature.

## User-facing errors

Errors must be actionable and must not mix product locales in one message. Shell/README setup instructions may use English as the repository documentation language, while WebUI blocked diagnostics continue to follow the selected `en-US`, `zh-TW`, `ja-JP`, or `ko-KR` locale.

Preparation errors distinguish at least:

- ZIP missing;
- unsafe archive;
- unsupported layout/version;
- missing or duplicate sprite IDs;
- corrupt or unexpected PNG;
- mask generation failure;
- prepared assets excluded from or missing in the final Docker image.

Each error reports what was checked and the exact corrective action. It must not print or upload proprietary file contents.

## README changes

The top-level Quickstart will place the paid-asset prerequisite before the first `run.sh` command and include:

- the official LimeZu purchase link;
- the license boundary and no-redistribution warning;
- `mkdir -p private_assets/modern-office`;
- the expected ZIP path and environment override;
- one `./run.sh start` command that prepares and builds the environment;
- a short `./run.sh doctor` or asset-status command for troubleshooting;
- restart/rebuild behavior;
- a note that direct `docker compose build` is unsupported until preparation has completed.

## Verification

Automated verification must cover:

- safe ZIP entry validation and traversal rejection;
- correct extraction and exact ID coverage from a synthetic archive;
- idempotent cache reuse and atomic failure behavior;
- clear fail-fast output when the ZIP is missing or invalid;
- Docker-context and final-image presence checks without committing paid fixtures;
- synthetic non-rectangular masks whose transparent corners remain walkable;
- rotation and scale transformations;
- Agent-clearance dilation;
- supported surface, seating, bed, and station exceptions;
- mask-driven route invalidation after furniture edits;
- README and `run.sh --help` portability contracts.

End-to-end verification uses the developer's locally purchased ZIP to build a disposable local image, confirms representative PNG requests return HTTP 200 instead of 404, visually checks that furniture sprites render, and runs a route through a transparent mask corner that the prior rectangular blocker would have closed. The paid inputs and generated mask artifact remain untracked.

## Merge condition

The existing feature branch must not merge to `main` until the preparation pipeline, alpha navigation, README quickstart, Docker build, unit suites, and real-browser smoke all pass. After those checks, merge locally into `main`, rerun the required verification on the merged tree, and remove the owned worktree only after the merge succeeds.

# Private Modern Office Assets and Alpha Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Make `./run.sh start` and `restart` reliably prepare the user's licensed Modern Office ZIP, render the real furniture instead of black placeholders, and route Agents around the transformed opaque pixels rather than rectangular furniture bounds.

**Architecture:** Extend the existing Python provisioner into an atomic, content-addressed preparation gate that extracts the required local-only PNGs and generates an alpha-run manifest under the ignored WebUI private-assets directory. Narrowly include that prepared output in the local Docker build, include its digest in image reuse decisions, preload the manifest through Phaser, and use one pure TypeScript mask-transform module for fine navigation while retaining canonical bounds for editing and broad-phase checks.

**Tech Stack:** Bash, Python 3 standard library, Docker Compose, TypeScript 7, Phaser 3.90, Vitest, Pytest, Playwright/Chromium.

## Global Constraints

- Never commit, redistribute, print, or upload the paid ZIP, extracted sprites, generated alpha data, or a local image containing them.
- Resolve all documented paths from the clone root; no `/home/a0665x/...` examples may enter public docs.
- `run.sh start/restart` must fail before Compose when preparation is incomplete. Direct unit tests and source builds may use synthetic manifests only.
- Preserve the existing floor/surface, seating, bed/offline, station-access, and supported-object navigation semantics.
- Preserve rectangular canonical bounds for selection, containment, stacking, and broad-phase placement; only fine route occupancy becomes alpha-driven.
- Preserve untracked user files in `global_map/` and `tmp/`; stage only files named in each task.
- Use synthetic PNG fixtures in tests. Do not copy real Modern Office pixels into snapshots or fixtures.

---

## Task 1: Make licensed-asset preparation atomic and self-describing

**Files:**

- Modify: `scripts/provision_modern_office_assets.py`
- Modify: `tests/test_modern_office_asset_provisioning.py`

- [ ] **Step 1: Add failing tests for the public input contract**

Add tests that expect the default archive to be repository-relative and the override to be portable:

```python
def test_default_archive_is_repo_local_and_error_links_official_vendor(tmp_path, monkeypatch):
    result = _run_with_env(
        {"PIXELVERSE_PROJECT_ROOT": str(tmp_path)},
        "--destination", str(tmp_path / "prepared"),
    )
    assert result.returncode == 2
    assert "private_assets/modern-office/Modern_Office_Revamped_v1.zip" in result.stderr
    assert "https://limezu.itch.io/modernoffice" in result.stderr

def test_zip_override_accepts_an_absolute_clone_independent_path(tmp_path):
    # Build the synthetic archive outside the synthetic project root and assert success.
```

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py -k 'default_archive or zip_override'
```

Expected: FAIL because the current default uses `~/Downloads` and the old `PIXELVERSE_MODERN_OFFICE_ARCHIVE` name.

- [ ] **Step 2: Add failing archive-layout and exact-ID tests**

Generate synthetic RGBA PNGs containing a known L-shaped alpha silhouette. Add cases for:

- required singles exactly `1..339` under `4_Modern_Office_singles/16x16/`, plus the exact atlas and room-builder paths already used by `modernOfficeManifest.ts`;
- an absolute member, `../` traversal, symlink, duplicate normalized ID, missing ID, and unexpected dimensions;
- a wrong archive layout that happens to contain matching basenames elsewhere;
- preserving a previously valid prepared directory when a later archive fails.

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py -k 'layout or traversal or symlink or exact or atomic'
```

Expected: at least the layout, exact-ID, and atomic cases FAIL.

- [ ] **Step 3: Add failing generated-manifest tests**

Require `collision-masks.json` and `.prepared-assets.json` beside the extracted PNGs. Assert a collision asset has this stable schema:

```json
{
  "schemaVersion": 1,
  "alphaThreshold": 1,
  "assets": {
    "1": {
      "width": 32,
      "height": 48,
      "runs": [[0, 0, 2], [1, 0, 1]]
    }
  }
}
```

Each run is `[sourceY, startX, endXExclusive]`. Assert the prepared metadata records the source ZIP SHA-256, schema version, required-ID digest, and collision-manifest SHA-256. Assert a second invocation with matching metadata leaves every output mtime unchanged.

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py -k 'manifest or idempotent'
```

Expected: FAIL because no alpha manifest or preparation metadata exists.

- [ ] **Step 4: Implement strict PNG decoding and alpha-run generation**

In `scripts/provision_modern_office_assets.py`:

- set the default to `ROOT/private_assets/modern-office/Modern_Office_Revamped_v1.zip`;
- set the prepared destination to `ROOT/pixelworld_mvp/public/assets/private/modern-office-v1.2`;
- accept `PIXELVERSE_MODERN_OFFICE_ZIP`, retaining the old variable only as a documented deprecation alias for compatibility;
- validate canonical ZIP member paths and expected directory prefixes before reading content;
- decode non-interlaced 8-bit RGBA PNG scanlines with PNG filters 0–4 using only the standard library;
- reject unsupported color/interlace modes and single-sprite dimensions other than the verified `32x48` catalog contract;
- convert alpha `>= 1` into contiguous row runs;
- prepare all outputs in a sibling temporary directory, validate the complete set, then atomically swap it into place;
- emit concise missing/invalid errors with the vendor URL, expected path, override, and retry command.

Use constants rather than scattered literals:

```python
OFFICIAL_URL = "https://limezu.itch.io/modernoffice"
PREPARATION_SCHEMA_VERSION = 1
COLLISION_MANIFEST = "collision-masks.json"
PREPARATION_METADATA = ".prepared-assets.json"
REQUIRED_SINGLE_IDS = frozenset(range(1, 340))
```

- [ ] **Step 5: Run the focused suite and commit**

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py
git status --short
git add scripts/provision_modern_office_assets.py tests/test_modern_office_asset_provisioning.py
git commit -m "feat: prepare licensed office assets atomically"
```

Expected: all focused tests pass; no real PNG/ZIP/manifest is staged.

---

## Task 2: Wire preparation, local-image reuse, diagnostics, and licensing boundaries

**Files:**

- Modify: `.gitignore`
- Modify: `.dockerignore`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `run.sh`
- Modify: `scripts/docker_build_metadata.py`
- Modify: `tests/test_modern_office_asset_provisioning.py`
- Modify: `tests/test_docker_release_integrity.py`

- [ ] **Step 1: Add failing ignore and local-build-contract tests**

Assert:

- `private_assets/` and `pixelworld_mvp/public/assets/private/` are Git-ignored;
- `.dockerignore` excludes arbitrary private assets but narrowly re-includes only `pixelworld_mvp/public/assets/private/modern-office-v1.2/`;
- Dockerfile verifies the prepared PNG set and `collision-masks.json` during the builder stage, then copies them to `/app/public/assets/private/modern-office-v1.2/`;
- Compose no longer relies on a host bind mount that can silently shadow an absent/empty prepared directory;
- the final image inspection test requires representative prepared assets when a locally built `PIXELVERSE_TEST_IMAGE` is supplied.

This implements the approved one-command local build. The image is deliberately local-only and the README must warn that it contains licensed data and must not be pushed to a public registry.

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py -k 'ignore or mount or private'
```

Expected: FAIL until ignore rules and assertions use the new public contract.

- [ ] **Step 2: Add failing fingerprint and command tests**

Add a public `assets-status` command and test that:

```bash
./run.sh assets-status
```

reports `missing`, `invalid`, or `ready` without printing proprietary content. Extend build metadata to accept the prepared metadata path as an explicit digest input, and assert changing that file changes `PIXELVERSE_BUILD_FINGERPRINT` while raw private PNG bytes remain excluded from the general tree walk.

Add source-only shell tests confirming:

- `start_service` provisions before fingerprinting and Compose;
- `restart` retains saved non-interactive choices;
- preparation failure propagates nonzero and prevents Compose;
- help documents `PIXELVERSE_MODERN_OFFICE_ZIP` and `assets-status`.

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py -k 'fingerprint or assets_status or help or before'
```

Expected: FAIL because status and the prepared digest are absent.

- [ ] **Step 3: Implement the shell and metadata contract**

Update `run.sh` so `provision_modern_office_assets` writes to the canonical ignored WebUI directory, `assets-status` invokes the provisioner in read-only status mode, and `prepare_docker_build_metadata` incorporates `.prepared-assets.json` after successful preparation.

Update `.dockerignore`, `Dockerfile`, and Compose so the prepared directory is the sole private build-context exception, is verified during build, and is copied into the final local image without a runtime bind mount.

Update `scripts/docker_build_metadata.py` with an explicit optional private-metadata input:

```python
def build_fingerprint(root=ROOT, inputs=BUILD_INPUTS, prepared_metadata: Path | None = None) -> str:
    # Hash normal public inputs, then hash only the small local metadata file when supplied.
```

Do not hash or print raw proprietary PNG data.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py
bash -n run.sh
git check-ignore private_assets/modern-office/Modern_Office_Revamped_v1.zip
git status --short
git add .gitignore .dockerignore Dockerfile docker-compose.yml run.sh scripts/docker_build_metadata.py tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py
git commit -m "feat: gate startup on private office assets"
```

Expected: tests pass; `git check-ignore` succeeds; no private assets are staged.

---

## Task 3: Load and validate alpha masks in the WebUI

**Files:**

- Create: `pixelworld_mvp/src/rendering/furnitureAlphaMasks.ts`
- Create: `pixelworld_mvp/tests/furnitureAlphaMasks.test.ts`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Modify: `pixelworld_mvp/tests/assetManifest.test.ts`

- [ ] **Step 1: Add failing manifest-parser tests**

Test a pure parser/registry API with synthetic data:

```ts
const manifest = parseFurnitureAlphaMaskManifest({
  schemaVersion: 1,
  alphaThreshold: 1,
  assets: { '1': { width: 4, height: 3, runs: [[0, 0, 2], [1, 0, 1]] } },
}, { requiredAssetIds: [1] });
expect(manifest.assets.get(1)?.runs).toEqual([[0, 0, 2], [1, 0, 1]]);
```

Reject wrong schema, missing caller-required catalog IDs, invalid dimensions, unsorted/overlapping/out-of-range runs, and empty masks. Runtime installation passes IDs `1..339`; focused tests pass their synthetic subset. Include `installFurnitureAlphaMasks`, `furnitureAlphaMask`, and `clearFurnitureAlphaMasksForTests` so tests never depend on paid files.

Run:

```bash
cd pixelworld_mvp && npm test -- --run tests/furnitureAlphaMasks.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the parser and registry**

Keep runtime types explicit:

```ts
export type AlphaRun = readonly [y: number, startX: number, endXExclusive: number];
export interface FurnitureAlphaMask { width: number; height: number; runs: readonly AlphaRun[] }
export interface FurnitureAlphaMaskManifest {
  schemaVersion: 1;
  alphaThreshold: 1;
  assets: ReadonlyMap<number, FurnitureAlphaMask>;
}
```

Parsing must copy/freeze validated data and produce actionable errors without exposing mask contents.

- [ ] **Step 3: Preload and install before world/interior construction**

Export a stable key/path from `assetManifest.ts`:

```ts
export const MODERN_OFFICE_COLLISION_MASKS = {
  key: 'modern-office-v1.2-collision-masks',
  path: '/assets/private/modern-office-v1.2/collision-masks.json',
} as const;
```

Call `scene.load.json(...)` in `preloadVillageAssets`. At the start of `WorldScene.create()`, read the JSON cache, validate/install it, and throw a clear essential-asset error when absent or invalid. Add manifest and scene tests that prove installation occurs before `InteriorCutawaySystem` can plan a path.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
cd pixelworld_mvp
npm test -- --run tests/furnitureAlphaMasks.test.ts tests/assetManifest.test.ts
npm run typecheck
git add src/rendering/furnitureAlphaMasks.ts src/rendering/assetManifest.ts src/scenes/WorldScene.ts tests/furnitureAlphaMasks.test.ts tests/assetManifest.test.ts
git commit -m "feat: load office alpha collision masks"
```

Expected: focused tests and typecheck pass.

---

## Task 4: Replace rectangular route occupancy with transformed alpha occupancy

**Files:**

- Modify: `pixelworld_mvp/src/rendering/furnitureAlphaMasks.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/tests/furnitureAlphaMasks.test.ts`
- Modify: `pixelworld_mvp/tests/interiorPlacement.test.ts`
- Modify: `pixelworld_mvp/tests/interiorNavigationPolicy.test.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts`

- [ ] **Step 1: Add failing transform and transparent-gap tests**

Install a synthetic L-shaped mask and verify a blocking furniture item:

- blocks cells intersecting opaque runs;
- leaves its transparent rectangular corner traversable;
- rotates correctly at 90/180/270 degrees;
- scales correctly at 0.75/1/2/3;
- honors catalog `opaqueBounds`, item anchor, `visualOffset`, and the existing 16-pixel world unit;
- dilates by `{x, y}` Agent foot clearance without filling unrelated transparent gaps.

Use one exported pure function:

```ts
transformedFurnitureMaskCells(item, mask, clearance): GridPoint[]
```

Run:

```bash
cd pixelworld_mvp && npm test -- --run tests/furnitureAlphaMasks.test.ts tests/interiorPlacement.test.ts
```

Expected: FAIL because route occupancy is still a rectangle.

- [ ] **Step 2: Implement transformed occupancy**

For each opaque source pixel rectangle:

1. express its corners relative to the catalog opaque-bound center;
2. convert source pixels to room units using `scale / 16`;
3. rotate with the same normalized clockwise quarter-turn used by render geometry;
4. translate to `furnitureRenderGeometry(item).center`;
5. broad-phase reject navigation cells outside transformed canonical bounds plus clearance;
6. block a navigation cell only when its feet-center clearance box intersects at least one transformed opaque-pixel rectangle.

Deduplicate and sort returned cells by `y`, then `x`. Cache invariant per-asset run rectangles but not placed/transformed results.

- [ ] **Step 3: Switch only fine path blockers to the mask**

Change private `navigationObstacleCells` in `interiorPlacement.ts` to use `transformedFurnitureMaskCells`. Keep `transformedAlphaBounds`, `fineFootprintCells`, `furnitureCollidesWithLayout`, and editor `navigationCells` rectangular unless an existing route consumer specifically requires fine blockers.

When a manifest has been installed but lacks the resolved paid asset mask, throw an explicit error in route planning. If no manifest is installed at all, pure headless/unit consumers retain geometry occupancy; the supported WebUI cannot enter that state because `WorldScene.create()` fails before interior construction. Assets outside the paid catalog always retain their existing geometry-based occupancy.

- [ ] **Step 4: Prove semantic exceptions still work**

Extend `interiorNavigationPolicy.test.ts` to cover:

- floor and supported surface objects add no blockers;
- chairs/sofas open only for eligible rest/seat access;
- beds open only for offline access;
- a station opens only its own final access cell;
- another item's opaque pixel at that cell remains blocking.

Add the installed manifest's stable collision version/digest to `interiorNavigationSignature` in `interiorNavigationPolicy.ts`, with a regression test proving that a version change invalidates the cached route.

- [ ] **Step 5: Run navigation suites and commit**

Run:

```bash
cd pixelworld_mvp
npm test -- --run tests/furnitureAlphaMasks.test.ts tests/interiorPlacement.test.ts tests/interiorNavigationPolicy.test.ts tests/interiorMotion.test.ts tests/interiorAssignment.test.ts
npm run typecheck
git add src/rendering/furnitureAlphaMasks.ts src/rendering/interiorPlacement.ts tests/furnitureAlphaMasks.test.ts tests/interiorPlacement.test.ts tests/interiorNavigationPolicy.test.ts
git add src/rendering/interiorNavigationPolicy.ts
git commit -m "fix: navigate around furniture alpha silhouettes"
```

Expected: all focused navigation tests and typecheck pass.

---

## Task 5: Document one-command setup and add release guards

**Files:**

- Modify: `README.md`
- Modify: `run.sh`
- Modify: `tests/test_modern_office_asset_provisioning.py`
- Modify: `tests/test_docker_release_integrity.py`
- Modify: `scripts/furniture_drag_browser_smoke.py`

- [ ] **Step 1: Add failing documentation-contract tests**

Assert README and help include:

- official purchase link;
- `mkdir -p private_assets/modern-office`;
- `private_assets/modern-office/Modern_Office_Revamped_v1.zip`;
- `PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/...`;
- `./run.sh start`, `restart`, and `assets-status` behavior;
- no-redistribution and public-image warning;
- direct `docker compose build` caveat;
- no developer-specific home path.

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py -k 'readme or help or portable'
```

Expected: FAIL until the Quickstart is updated.

- [ ] **Step 2: Rewrite the Quickstart prerequisite and troubleshooting section**

Place the paid-asset prerequisite before the first start command and use clone-relative commands:

```bash
mkdir -p private_assets/modern-office
# Place your legally purchased Modern_Office_Revamped_v1.zip in that directory.
./run.sh assets-status
./run.sh start
```

Explain that preparation is automatic and local, `restart` rebuilds only when source or prepared-asset metadata changes, and a user must never push the local ZIP, prepared directory, or local image to a public registry.

- [ ] **Step 3: Extend browser smoke with essential-asset assertions**

Before dragging furniture, request:

```text
/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png
/assets/private/modern-office-v1.2/collision-masks.json
```

Require HTTP 200 and fail on Phaser texture-load errors, missing essential asset console messages, or black missing-texture diagnostics. Do not store response bodies in artifacts.

- [ ] **Step 4: Run docs/release tests and commit**

Run:

```bash
pytest -q tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py
bash -n run.sh
git diff --check
git add README.md run.sh scripts/furniture_drag_browser_smoke.py tests/test_modern_office_asset_provisioning.py tests/test_docker_release_integrity.py
git commit -m "docs: add licensed office asset quickstart"
```

Expected: documentation/release tests pass and only public text/code is committed.

---

## Task 6: Full local build, visual QA, and merge to `main`

**Files:**

- Verify only; fix the smallest owning files if a regression is found.

- [ ] **Step 1: Confirm the real ZIP locally without staging it**

Either copy the legally purchased ZIP to the ignored location or use the override:

```bash
PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/Modern_Office_Revamped_v1.zip ./run.sh assets-status
git status --short
```

Expected: status is ready after preparation; no proprietary output appears as trackable.

- [ ] **Step 2: Run all automated suites**

```bash
pytest -q
cd pixelworld_mvp && npm test && npm run build
cd ..
git diff --check
```

Expected: Python, Vitest, typecheck, and production build all pass.

- [ ] **Step 3: Rebuild and verify the service**

Use the saved port/settings and the legal local ZIP:

```bash
PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/Modern_Office_Revamped_v1.zip PIXELVERSE_REBUILD=1 ./run.sh restart
curl -fsSI http://127.0.0.1:5661/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png
curl -fsSI http://127.0.0.1:5661/assets/private/modern-office-v1.2/collision-masks.json
PIXELVERSE_SMOKE_BASE_URL=http://127.0.0.1:5661 ./run.sh smoke-furniture-drag
```

Expected: both assets return 200; browser smoke passes; screenshot shows real pixel furniture and no black blocks.

- [ ] **Step 4: Inspect Git and request final code review**

```bash
git status --short
git diff main...HEAD --stat
git ls-files | rg 'Modern_Office_.*\.png|collision-masks\.json|Modern_Office_Revamped.*\.zip' && exit 1 || true
```

Expected: only the known user-owned `global_map/` and `tmp/` paths may remain untracked; no paid or derived files are tracked.

- [ ] **Step 5: Merge locally and reverify the merged tree**

After all checks pass:

```bash
git -C /path/to/main-worktree merge --no-ff codex/portable-navigation-agent-detail
git -C /path/to/main-worktree status --short
```

Run the Python suite, Vitest suite, production build, representative HTTP checks, and browser smoke once more from `main`. Remove the feature worktree only after the merged verification succeeds and only if its remaining untracked files are confirmed disposable or preserved elsewhere.

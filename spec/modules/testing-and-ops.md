# Testing and Ops

## Test layers

Python contracts cover the service, Docker release inputs, portable onboarding,
hook delivery, dashboard embedding, and the command-deck browser acceptance:

- `tests/test_legacy_map_retirement.py`
- `tests/test_dashboard_layout.py`
- `tests/test_docker_release_integrity.py`
- `tests/test_run_architecture.py`
- `tests/test_portable_onboarding.py`
- `tests/test_command_deck_browser_smoke.py`
- `tests/test_furniture_drag_browser_smoke.py`

Node contracts cover current dashboard state and event presentation, including
`tests/test_command_deck_model.mjs`, `tests/test_mission_trace.mjs`, and the
live-agent rail suites. Phaser unit tests in `pixelworld_mvp/tests/` cover the
village, per-building interiors, canonical furniture geometry, placement,
collision masks, navigation, and persisted layouts.

## Village and interior verification

The production world is the built-in Phaser village. Verify navigation and
collision through the current interior systems rather than a retired external
world definition:

- agents enter the building assigned to their lifecycle event and return to
  the village without crossing building boundaries;
- interior movement respects opaque furniture bounds, doors, Hook furniture,
  and the navigation policy;
- furniture move, rotate, scale, prefab placement, undo, and reload recalculate
  routes immediately; invalid placement restores a legal position;
- browser checks open a building interior, use **Move furniture**, and save a
  per-building layout with **Save layout**.

Run the scoped contracts after documentation or release changes:

```bash
python3 -m pytest -q \
  tests/test_legacy_map_retirement.py \
  tests/test_dashboard_layout.py \
  tests/test_docker_release_integrity.py \
  tests/test_run_architecture.py \
  tests/test_portable_onboarding.py
```

Run the JavaScript contracts after dashboard or Phaser changes:

```bash
node --test tests/*.mjs
```

## Local operations

- `./run.sh start` starts the Docker Compose service and selects an agent when
  `PIXELVERSE_AGENT_KIND` is not supplied.
- `./run.sh restart` and `./run.sh down_up` reuse the saved agent and exposure
  settings; explicit environment variables override those settings.
- `./run.sh status`, `./run.sh bridge-status`, and `./run.sh doctor` report
  service, bridge, and adapter health.
- `./run.sh test-hook` sends a synthetic lifecycle and verifies fresh route
  evidence.
- `./run.sh smoke-furniture-drag` opens a real Phaser interior with Chromium
  and checks furniture rendering, collision, and screenshot output.

The UI host port defaults to `5660` and the bridge host port defaults to
`4567`. To publish the bridge on another host port while leaving the container
bridge port unchanged, start with:

```bash
PIXELVERSE_BRIDGE_PORT=4568 PIXELVERSE_AGENT_KIND=codex ./run.sh start
curl -fsS http://127.0.0.1:4568/health
```

`run.sh` saves configured ports in `.pixelverse-service/compose.env`, and its
runtime commands load them on later shells. An explicit environment variable
still wins.

## Synthetic hook evidence

`./run.sh test-hook` overwrites only these route-evidence files:

- `tmp/latest_test_hook_route.json`: scenario, target building, tool sequence,
  event sequence, and expected agent plan.
- `tmp/latest_world_snapshot.json`: the `/api/world` snapshot after the
  synthetic events settle.

The command fails when the bridge cannot deliver events, expected agents are
missing, route evidence lacks a new event id or positive displacement, or the
final return-to-idle state does not settle. `clone_bay` also requires the
synthetic subagent evidence; a room-label change alone is insufficient.

The bridge endpoint acknowledges queue receipt before the world snapshot is
fully projected. `test-hook` polls within a bounded deadline; tune that with
`PIXELVERSE_TEST_HOOK_EVIDENCE_TIMEOUT` and
`PIXELVERSE_TEST_HOOK_EVIDENCE_INTERVAL` when diagnosing a slow host.

## Browser acceptance

Start a local service, create a reproducible lifecycle, then run the browser
acceptance script against the actual UI port:

```bash
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=localhost ./run.sh down_up
PIXELVERSE_TEST_HOOK_DELAY=5 PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661 --allow-mutation
```

Change the last port if `.pixelverse-service/compose.env` records another UI
port. The browser acceptance checks desktop and narrow viewports, live roster
selection synchronized with the village, busy/offline state, four locales,
agent displacement, an occupied Starting Cabin, saved furniture layouts and
assemblies, and zero console or page errors.

Its machine-readable result is `tmp/command_deck_browser_smoke.json`. Passing
candidate screenshots are promoted to the repository-owned village and cabin
images in `docs/assets/`.

## Change gates

- Run `bash -n run.sh` after changing the command surface.
- Run the scoped Python contracts after documentation, onboarding, Compose, or
  release-input changes.
- Run `node --test tests/*.mjs` after dashboard state, event, or localization
  changes.
- Run the relevant Phaser tests after interior rendering, placement, collision,
  navigation, or furniture persistence changes.
- Do not claim a browser change is accepted without the corresponding browser
  evidence.

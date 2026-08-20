---
name: CLI_Pixelverse
description: >
  Bootstrap a freshly cloned CLI_Pixelverse repo end to end. Use when a new
  user or agent wants automatic initialization: start the service, install
  Codex/agent adapters, create hooks, enable shell activation, check Tailscale
  availability, verify hook status and adapter resolution, and prepare steps
  for connecting Codex from other working directories.
version: 1.0.0
tags: [pixelverse, bootstrap, init, setup, codex, hooks, tailscale]
triggers:
  - CLI_Pixelverse
  - pixelverse bootstrap
  - pixelverse init
  - init CLI_Pixelverse
  - setup CLI_Pixelverse
  - install pixelverse hooks
---

# CLI_Pixelverse Bootstrap

Use this skill when asked to initialize a fresh CLI_Pixelverse checkout or make
another working directory connect to an existing Pixelverse service.

Default assumptions:

- Project root is the current directory unless another path is provided.
- Default agent kind is `codex`.
- Do not edit user shell files manually; use `./run.sh enable-shell-adapter`.
- If commands fail because Docker, Tailscale, or dependencies are missing,
  report exact missing pieces and the next install command, then continue with
  checks that can still run.

## Fresh Repo Init

From the CLI_Pixelverse repo root:

```bash
test -x ./run.sh || chmod +x ./run.sh
PIXELVERSE_AGENT_KIND=codex ./run.sh down_up
source .pixelverse-service/activate.sh
./run.sh status
./run.sh bridge-status
```

`down_up` in Codex mode should:

- start the Docker Compose service
- install the Codex CLI shim
- install repo-local `.codex/hooks.json`
- enable the managed Bash activation line for new terminals
- write `.pixelverse-service/activate.sh`

If the user asks for a non-Codex agent, set `PIXELVERSE_AGENT_KIND` to one of:

```text
codex, gemini-cli, claude-code, antigravity, ollama, hermes, generic
```

## Verify Local Hooking

Run these checks after init:

```bash
./run.sh bridge-status
bash -lc 'source .pixelverse-service/activate.sh && command -v codex'
curl -fsS http://127.0.0.1:5660/health
curl -fsS http://127.0.0.1:4567/health
curl -fsS http://127.0.0.1:5660/api/world
./run.sh test-hook
```

Expected:

- `command -v codex` resolves to `.pixelverse-service/bin/codex`
- `5660/health` is available
- `4567/health` is available
- `test-hook` moves an agent in the UI
- first Codex session should run `/hooks` and trust the project hook

## Tailscale Check

Check Tailscale without assuming it is installed:

```bash
command -v tailscale
tailscale status
tailscale serve status
```

If `tailscale` is missing, tell the user:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

If Tailscale exists but is not authenticated, tell the user to run:

```bash
sudo tailscale up
```

If Tailscale is available and the user wants remote UI exposure:

```bash
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=tailscale ./run.sh down_up
```

Then re-run:

```bash
./run.sh status
./run.sh bridge-status
```

## Other Directory Connection

For process-level Codex visibility from any new terminal, the shell adapter is
enough:

```bash
codex
```

For an already-open shell:

```bash
source /path/to/CLI_Pixelverse/.pixelverse-service/activate.sh && codex
```

For high-fidelity Codex tool/subagent events in another repo:

```bash
cd /path/to/other-repo
/path/to/CLI_Pixelverse/run.sh install-codex-hook
codex
```

After launching Codex in that repo, run `/hooks` once and trust the project hook
definition.

## Custom Global Map

Use this when the user wants their own room shape, PNG, or furniture layout
without editing the built-in map files.

Preferred user override path:

```text
<CLI_Pixelverse>/tmp/global_map/default.yaml
<CLI_Pixelverse>/tmp/global_map/default.png
```

Then restart:

```bash
PIXELVERSE_AGENT_KIND=codex ./run.sh down_up
```

If the user wants a different host directory, use:

```bash
PIXELVERSE_GLOBAL_MAP_DIR_HOST=/path/to/global_map PIXELVERSE_AGENT_KIND=codex ./run.sh down_up
```

Validate the YAML before reporting success:

- `corridors` is non-empty and each item has `left/top/width/height`
- every active room has `rect`, `center`, `portal`, `aisle`, and `hub`
- `portal` touches a corridor, `hub` is inside a corridor, and `aisle` is inside the room
- each furniture item has `type`, `x`, `y`, `w`, and `h`
- optional furniture `scale` stays between `0.55` and `1.8`
- furniture does not cover door approach points

Run these checks after a custom map change:

```bash
node --test tests/test_house_layout_connected.mjs tests/test_world_motion.mjs tests/test_furniture_editing.mjs
python3 -m pytest -q tests/test_fastapi_service.py tests/test_dashboard_layout.py
```

## Report Format

End with a concise status report:

- service: running / unavailable
- UI: local URL and Tailscale URL if configured
- adapter: shim path for selected agent
- Codex project hook: installed path or missing
- shell activation: enabled or manual source command
- Tailscale: installed/authenticated/exposure status
- custom map: built-in fallback / `tmp/global_map` / `PIXELVERSE_GLOBAL_MAP_DIR_HOST`
- next action: `/hooks` trust, install missing dependency, or open UI

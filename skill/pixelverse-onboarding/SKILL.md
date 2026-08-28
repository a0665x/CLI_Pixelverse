---
name: pixelverse-onboarding
description: >
  Onboard a new contributor or agent to CLI_Pixelverse. Use when setting up
  the local UI, attaching a Codex CLI, verifying hooks, understanding lifecycle
  routing, or locating the project architecture documentation.
version: 2.0.0
tags: [pixelverse, onboarding, codex, hooks, observability]
triggers:
  - pixelverse onboarding
  - attach codex
  - pixelverse hooks
  - pixelverse status
---

# CLI_Pixelverse Onboarding

CLI_Pixelverse is a standalone local observability UI for agent CLIs. Hermes
is one optional integration source. The UI translates lifecycle events into
room movement, timeline events, and per-agent heartbeat waveforms.

## Start Here

Read these files in order:

1. `README.md` for the licensed asset prerequisite, portable quick start, and
   supported user workflow.
2. `spec/modules/integration-and-events.md` for hook, bridge, adapter, and
   lifecycle contracts.
3. `spec/modules/testing-and-ops.md` for current Phaser village/interior,
   runtime, browser, and verification guidance.

Then inspect the relevant tracked source for the question at hand: `run.sh` and
`docker-compose.yml` for startup or ports, `scripts/codex_pixelverse_hook.py`
for Codex hook behavior, `public/` for dashboard state, and `pixelworld_mvp/src/`
for village and interior behavior.

## First Codex Setup

```bash
cd /path/to/CLI_Pixelverse
export PIXELVERSE_ROOT="$(pwd -P)"
PIXELVERSE_AGENT_KIND=codex "$PIXELVERSE_ROOT/run.sh" start
source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"
"$PIXELVERSE_ROOT/run.sh" status
"$PIXELVERSE_ROOT/run.sh" bridge-status
command -v codex
codex
```

`command -v codex` must resolve to:

```text
<repo>/.pixelverse-service/bin/codex
```

Inside the first Codex session, run `/hooks`, review the project hook
definition, and trust it. Start a new Codex process after activation; an
already-running process cannot be attached retroactively.

Codex mode automatically installs the local shim, repo-local Codex hook, and
new Bash shell activation. In an already-open shell, this one-liner attaches the
wrapper before launching Codex:

```bash
source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh" && codex
```

For another repo that needs high-fidelity Codex tool/subagent hook events:

```bash
cd /path/to/other-repo
"$PIXELVERSE_ROOT/run.sh" install-codex-hook "$PWD"
codex
```

## Verify The Connection

```bash
"$PIXELVERSE_ROOT/run.sh" status
"$PIXELVERSE_ROOT/run.sh" bridge-status
command -v codex
curl -fsS http://localhost:5660/health
curl -fsS http://localhost:4567/health
curl -fsS http://localhost:5660/api/world
"$PIXELVERSE_ROOT/run.sh" test-hook
```

Expected results: both health endpoints report `ok`, `command -v codex` resolves to
`<repo>/.pixelverse-service/bin/codex`, and `test-hook` moves a character
through lifecycle rooms in the browser UI.

The expected data flow is:

```text
Codex CLI wrapper heartbeat
  -> POST /api/heartbeat
Codex project hook lifecycle
  -> scripts/codex_pixelverse_hook.py
  -> POST /api/event
Pixelverse world state
  -> GET /api/world and SSE /api/world/stream
  -> browser UI
```

## Hook Routing Summary

| Codex hook | Pixelverse state | Room |
| --- | --- | --- |
| `SessionStart` | `initializing` | `clone_bay` |
| `UserPromptSubmit` | `thinking` | `think_lab` |
| Explicit `$skill` or `/skill` prompt | `invoking_skill` | `tool_forge` |
| `PreToolUse` / `PostToolUse` | `tool_call` or `executing` | `tool_forge` |
| `SubagentStart` / `SubagentStop` | `collaborating` | `clone_bay` |
| `Stop` | `idle` | `standby_dock` |
| Missing heartbeat past stale timeout | `offline` | `offline_corner` |

## Development Checks

```bash
bash -n run.sh
python3 -m py_compile bridge.py scripts/*.py agent_bridges/*.py
python3 -m pytest -q tests/test_portable_onboarding.py tests/test_legacy_map_retirement.py
node --test tests/*.mjs
```

When lifecycle behavior, API fields, or room routing changes, update the
tracked `spec/modules/integration-and-events.md` or
`spec/modules/testing-and-ops.md` documentation alongside the implementation.

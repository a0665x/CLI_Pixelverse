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

1. `spec/PROJECT_MAP.md`
2. `spec/architecture/system-overview.md`
3. `spec/modules/integration-and-events.md`
4. `README.md`

## First Codex Setup

```bash
cd /path/to/CLI_Pixelverse
PIXELVERSE_AGENT_KIND=codex ./run.sh down_up
./run.sh install-adapter codex
./run.sh enable-shell-adapter
source .pixelverse-service/activate.sh
./run.sh status
./run.sh bridge-status
which codex
codex
```

`which codex` must resolve to:

```text
<repo>/.pixelverse-service/bin/codex
```

Inside the first Codex session, run `/hooks`, review the project hook
definition, and trust it. Start a new Codex process after activation; an
already-running process cannot be attached retroactively.

## Verify The Connection

```bash
./run.sh status
./run.sh bridge-status
which codex
curl -fsS http://localhost:5660/health
curl -fsS http://localhost:4567/health
curl -fsS http://localhost:5660/api/world
./run.sh test-hook
```

Expected results: both health endpoints report `ok`, `which codex` resolves to
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
python3 -m pytest -q -o faulthandler_timeout=10
node --test tests/*.mjs
```

When lifecycle behavior, API fields, or room routing changes, update `spec/`
alongside the implementation.

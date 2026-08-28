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
mkdir -p private_assets/modern-office
# Purchase Modern_Office_Revamped_v1.zip and place it in the directory above.
PIXELVERSE_AGENT_KIND=codex ./run.sh start
source "$(pwd -P)/.pixelverse-service/activate.sh"
codex
```

The [Modern Office - Revamped - RPG Tileset](https://limezu.itch.io/modernoffice)
is licensed content. The user must purchase and download it; do not commit,
redistribute, or publish the ZIP, prepared sprites, or a local image that
contains them. The expected path is:

```text
private_assets/modern-office/Modern_Office_Revamped_v1.zip
```

For portable commands from another directory, set the clone root in the
current shell:

```bash
export PIXELVERSE_ROOT="$(pwd -P)"
```

`start` in Codex mode should:

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
bash -lc 'source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh" && command -v codex'
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
source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh" && codex
```

For high-fidelity Codex tool/subagent events in another repo:

```bash
cd /path/to/other-repo
"$PIXELVERSE_ROOT/run.sh" install-codex-hook "$PWD"
codex
```

After launching Codex in that repo, run `/hooks` once and trust the project hook
definition.

## Village Interior Editing

The supported world is the built-in Phaser village. To customize a room, open
a village building, use **Move furniture**, drag furniture or shelf items, and
choose **Save layout**. Layouts are saved per building. Do not describe or
offer an alternate world-authoring workflow.

## Report Format

End with a concise status report:

- service: running / unavailable
- UI: local URL and Tailscale URL if configured
- adapter: shim path for selected agent
- Codex project hook: installed path or missing
- shell activation: enabled or manual source command
- Tailscale: installed/authenticated/exposure status
- village interior: selected building and saved-layout status
- next action: `/hooks` trust, install missing dependency, or open UI

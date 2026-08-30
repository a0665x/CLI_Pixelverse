# CLI_Pixelverse

Local pixel-village observability for AI agent CLIs.

CLI_Pixelverse turns real CLI lifecycle events into characters, rooms, ECG
activity, project-aware roster cards, and inspectable event timelines. It runs
locally with Docker and does not replace your original Agent executables.

![CLI_Pixelverse live Agent roster, ECG, village, and detail panel](./cli_pixelverse_demo_1.png)

*Live Agent roster, activity ECG, project state, village routing, and recent events.*

![CLI_Pixelverse editable room interior](./cli_pixelverse_demo_2.png)

*Open a building to inspect an Agent and arrange its room with licensed furniture.*

## What You Get

- A 2D pixel village where Agent state determines room movement.
- Agent portraits, project names, live/idle/offline state, and animated ECG.
- Clickable roster cards with the current task, process, hook, project path, and
  recent events.
- Editable building interiors with furniture collision, placement validation,
  undo, and per-room saved layouts.
- A settings panel for English, Traditional Chinese, Japanese, and Korean UI
  locales, help, connection information, and version details.
- CLI adapters for Codex, Gemini CLI, Claude Code, Antigravity, Ollama, and
  Hermes, plus a generic HTTP event API.
- Localhost, Tailscale, and ngrok exposure modes.

## Quick Start

### 1. Clone and prepare the licensed asset

Prerequisites:

- Docker Engine or Docker Desktop with Docker Compose
- Git
- At least one supported Agent CLI installed on the host
- The separately purchased
  [Modern Office - Revamped](https://limezu.itch.io/modernoffice) ZIP

Clone Pixelverse from any location and derive its path from the current shell:

```bash
git clone https://github.com/a0665x/CLI_Pixelverse.git
cd CLI_Pixelverse
export PIXELVERSE_ROOT="$(pwd -P)"
mkdir -p private_assets/modern-office
```

Place the original archive here without renaming it:

```text
private_assets/modern-office/Modern_Office_Revamped_v1.zip
```

The paid archive and prepared sprites are intentionally Git-ignored and are not
included in this repository. If the ZIP is stored elsewhere, provide it only
for the start command:

```bash
PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/Modern_Office_Revamped_v1.zip \
  PIXELVERSE_AGENT_KIND=codex ./run.sh --start
```

### 2. Start Pixelverse

From the clone root:

```bash
PIXELVERSE_AGENT_KIND=codex ./run.sh --start
```

The first start validates the archive, prepares the furniture and alpha
collision masks, builds the local image, and starts the service. Later starts
reuse valid prepared assets even if the original ZIP is no longer present.

Open [http://localhost:5660](http://localhost:5660), or inspect the resolved
address and saved ports:

```bash
./run.sh status
./run.sh bridge-status
```

### 3. Bind and launch an Agent project

Open a second terminal. Derive the Pixelverse clone path, switch to the project
you want the Agent to manage, then bind and launch:

```bash
cd /path/to/CLI_Pixelverse
export PIXELVERSE_ROOT="$(pwd -P)"
cd /path/to/your-project
"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch
```

For Codex, run `/hooks` in the first session and trust the generated
project-local hook definition. Binding installs the integration, but it does
not create a fake online Agent: the character appears only after a real CLI session
starts and emits lifecycle activity.

For later shells, either launch through `hook_bridge.sh` again or activate the
repo-local wrappers before using normal CLI commands:

```bash
source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"
codex
```

To bind without launching, omit `--launch`:

```bash
cd /path/to/your-project
"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex
```

## Agent Integration Coverage

| Agent | `--agent` value | Integration level |
| --- | --- | --- |
| Codex | `codex` | CLI lifecycle adapter plus project hooks for prompts, tools, subagents, and stop events |
| Gemini CLI | `gemini-cli` | Process start, heartbeat, completion, and error through the CLI adapter |
| Claude Code | `claude-code` | Process start, heartbeat, completion, and error through the CLI adapter |
| Antigravity | `antigravity` | Process start, heartbeat, completion, and error through the CLI adapter |
| Ollama | `ollama` | CLI lifecycle adapter plus selected-model polling |
| Hermes | `hermes` | CLI adapter plus optional Hermes hook, user plugin, and gateway relay |
| Custom Agent | `generic` | Generic HTTP events and heartbeats |

The repository has automated adapter-generation, event-routing, and API
contract tests. Codex has the deepest project-hook integration. Process-level
adapters cannot expose vendor tool calls unless that CLI or another integration
also sends `POST /api/event`.

Launch another installed CLI by changing only the Agent value:

```bash
cd /path/to/your-project
"$PIXELVERSE_ROOT/hook_bridge.sh" --agent claude-code --launch
```

Supported values are `codex`, `gemini-cli`, `claude-code`,
`antigravity`, `ollama`, `hermes`, and `generic`.

### Generic HTTP event

Swagger and the OpenAPI schema are available at
[http://localhost:5660/docs](http://localhost:5660/docs). A minimal tool event:

```bash
curl -X POST http://localhost:5660/api/event \
  -H 'Content-Type: application/json' \
  -d '{"agent_type":"generic","agent":"local-agent","name":"Local Agent","event":"tool.started","tool_name":"terminal","message":"running a command","project_name":"my-project"}'
```

## Everyday Commands

```bash
./run.sh --start          # First start or explicit interactive start
./run.sh restart          # Restart with saved Agent, exposure, and ports
./run.sh stop             # Stop the service
./run.sh status           # Show UI, API, and container status
./run.sh bridge-status    # Check Agent event relay health
./run.sh doctor           # Run connection diagnostics
./run.sh assets-status    # Validate prepared Modern Office assets
./run.sh test-hook        # Send a synthetic lifecycle route
./run.sh logs             # Follow service logs
./run.sh --help
```

Install or refresh adapters explicitly:

```bash
./run.sh adapter codex
./run.sh adapter gemini-cli
./run.sh adapter claude-code
./run.sh adapter antigravity
./run.sh adapter ollama
./run.sh adapter hermes
```

The wrappers live only under `.pixelverse-service/bin/`. They locate and
execute the original CLI, and they still launch it with a warning if Pixelverse
is temporarily unavailable.

## Ports And Remote Access

Defaults:

| Service | Address |
| --- | --- |
| Web UI and API | `http://localhost:5660` |
| API documentation | `http://localhost:5660/docs` |
| World snapshot | `http://localhost:5660/api/world` |
| Hook bridge | `http://localhost:4567/hook` |

Override occupied host ports on first start:

```bash
PIXELVERSE_PORT=5661 \
PIXELVERSE_BRIDGE_PORT=4568 \
PIXELVERSE_AGENT_KIND=codex \
  ./run.sh --start

curl -fsS http://127.0.0.1:4568/health
```

Pixelverse saves successful port choices. `restart`, `hook_bridge.sh`, and
generated activation files reuse them automatically.

For private remote access, set `PIXELVERSE_EXPOSURE_MODE=tailscale` or provide
`PIXELVERSE_NGROK_URL`, then use `./run.sh status` to obtain the published
address. Do not expose the event API publicly without an access-control layer.

## Troubleshooting

### The page does not open

```bash
"$PIXELVERSE_ROOT/run.sh" status
"$PIXELVERSE_ROOT/run.sh" doctor
docker logs --tail 120 cli-pixelverse
```

### The service runs but no Agent appears

1. Start a new CLI process after binding; an already-running process cannot be
   attached retroactively.
2. Confirm the wrapper and bridge:

   ```bash
   source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"
   command -v codex
   "$PIXELVERSE_ROOT/run.sh" bridge-status
   ```

3. For Codex, run `/hooks` once in that project and trust the hook.
4. Confirm events arrive:

   ```bash
   "$PIXELVERSE_ROOT/run.sh" test-hook
   curl -fsS http://localhost:5660/api/world
   ```

### Furniture is missing or black

```bash
"$PIXELVERSE_ROOT/run.sh" assets-status
```

If validation fails, restore the purchased ZIP at the documented
`private_assets/modern-office/` path and restart. Do not copy prepared paid
assets into Git.

### A custom Agent CLI is not found

Set the matching executable override before launching, for example:

```bash
PIXELVERSE_CLAUDE_COMMAND=/absolute/path/to/claude \
  "$PIXELVERSE_ROOT/hook_bridge.sh" --agent claude-code --launch
```

Equivalent variables exist for Codex, Gemini, Antigravity, Ollama, and Hermes.

## Development

```bash
PYTHONPATH=. pytest -q
node --test tests/*.mjs
cd pixelworld_mvp
npm ci
npm test
npm run build
```

Useful release checks:

```bash
bash -n run.sh hook_bridge.sh
./run.sh --test
```

The main components are:

- `run.sh`: service lifecycle, assets, adapters, and diagnostics
- `hook_bridge.sh`: bind a target project and optionally launch its Agent
- `pixelverse_fastapi.py`: API and Swagger application
- `pixelverse_server.py`: world and lifecycle state
- `agent_bridges/`: generic event client and CLI adapter implementation
- `public/`: dashboard shell
- `pixelworld_mvp/`: Phaser village, interiors, movement, and editor
- `tests/`: Python and Node release contracts

## Assets And Licenses

The paid Modern Office pack is not redistributable through this repository.
Purchase it from the
[official LimeZu page](https://limezu.itch.io/modernoffice), keep its original
ZIP private, and build the prepared assets locally.

Bundled redistributable assets retain their license and attribution files under
`pixelworld_mvp/public/assets/`. See
[office asset provisioning](./docs/reference/office-assets.md),
[Pixelworld attribution](./pixelworld_mvp/ATTRIBUTION.md), and
[asset sources](./pixelworld_mvp/public/assets/ASSET_SOURCES.md) before
redistributing a modified build.

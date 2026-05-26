#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${PIXELVERSE_STATE_DIR:-$ROOT/.pixelverse-service}"
ENV_FILE="$STATE_DIR/compose.env"
COMMAND="${1:-start}"

PIXELVERSE_PORT="${PIXELVERSE_PORT:-4321}"
BRIDGE_PORT="${MINIVERSE_BRIDGE_PORT:-4567}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-hermes-pixelverse}"
PIXELVERSE_TAILSCALE_ENABLE="${PIXELVERSE_TAILSCALE_ENABLE:-1}"
PIXELVERSE_TAILSCALE_PORT="${PIXELVERSE_TAILSCALE_PORT:-10000}"

mkdir -p "$STATE_DIR"

usage() {
  cat <<EOF
Usage: ./run.sh [start|stop|restart|down_up|status|log|logs|doctor|bridge-status|adapter|install-adapter|install-hermes-hook|hermes-chat|test-hook|down]

Commands:
  start      Select agent source and start Docker Compose service.
  stop       Stop Docker Compose service and legacy local processes.
  restart    Stop, then start and re-select agent source.
  down_up    Alias for restart.
  status     Show container status and API endpoints.
  log/logs   Follow Docker Compose logs.
  doctor     Diagnose ports, legacy processes, Docker, Compose, and API health.
  bridge-status
             Show Pixelverse API, bridge hook, Hermes hook, and local adapter status.
  adapter [codex|gemini-cli|claude-code|ollama|hermes|generic|all]
             Install the adapter for the selected/native CLI without modifying the original CLI code.
  install-adapter [codex|gemini-cli|claude-code|ollama|hermes|generic|all|hermes-hook|hermes-plugin]
             Install local agent CLI shims/hooks. Default: current selected agent or hermes.
  install-hermes-hook
             Install/update the Hermes gateway hook that relays agent lifecycle events.
  hermes-chat
             Launch Hermes chat through the Pixelverse wrapper.
  test-hook  Send a synthetic lifecycle sequence and refresh tmp trajectory/debug files.
  down       Alias for stop.

Non-interactive agent selection:
  PIXELVERSE_AGENT_KIND=ollama ./run.sh start
  PIXELVERSE_AGENT_KIND=codex ./run.sh down_up

Common service flows:
  PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up
  PIXELVERSE_REBUILD=1 PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up
  ./run.sh status
  ./run.sh log
  ./run.sh doctor

Universal bridge client:
  python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex
  python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file
  python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main

Agent CLI adapters:
  ./run.sh adapter
  ./run.sh adapter codex
  ./run.sh install-adapter codex
  ./run.sh install-adapter gemini-cli
  ./run.sh install-adapter claude-code
  ./run.sh install-adapter hermes
  source "$STATE_DIR/activate.sh"
  codex
  gemini
  claude
  hermes chat

Hermes adapters:
  ./run.sh adapter hermes
  ./run.sh install-adapter hermes
  ./.pixelverse-service/bin/pixelverse-hermes chat
  ./run.sh install-adapter hermes-hook
  ./run.sh install-adapter hermes-plugin
  ./run.sh hermes-chat

Tailscale exposure (enabled by default when tailscaled is running):
  PIXELVERSE_TAILSCALE_ENABLE=1 PIXELVERSE_TAILSCALE_PORT=10000 ./run.sh start
  PIXELVERSE_TAILSCALE_ENABLE=0 ./run.sh start

Synthetic test routes:
  ./run.sh test-hook
  PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
  PIXELVERSE_TEST_HOOK_TARGET=tool_forge PIXELVERSE_TEST_HOOK_DELAY=5 ./run.sh test-hook

Supported PIXELVERSE_TEST_HOOK_TARGET values:
  blueprint_lab, tool_forge, response_studio, clone_bay, session_archive

Test-hook debug artifacts are overwritten on each run:
  tmp/latest_test_hook_route.json   Planned scenario, event sequence, and agent plan.
  tmp/latest_world_snapshot.json    /api/world snapshot after synthetic events.
  tmp/pixelverse_debug_log.json     Per-agent routes, room anchors, blockers, walkable checks.
  tmp/local_ui_trajectory.jpg       Visual route overlay for the latest task.

Subagent test behavior:
  clone_bay creates synthetic-subagent-1. Local agents are not deleted automatically;
  completed subagents remain visible as idle, and unfinished/stale subagents remain
  represented in /api/world instead of disappearing.
EOF
}

compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$ENV_FILE" \
    -f "$ROOT/docker-compose.yml" \
    "$@"
}

select_agent_kind() {
  if [[ -n "${PIXELVERSE_AGENT_KIND:-}" ]]; then
    printf '%s\n' "$PIXELVERSE_AGENT_KIND"
    return 0
  fi
  python3 "$ROOT/scripts/select_agent.py"
}

normalize_agent_kind() {
  local value="$1"
  value="$(
    printf '%s\n' "$value" \
      | tr -d '\r' \
      | sed -E 's/\x1B\[[0-9;?]*[[:alpha:]]//g' \
      | grep -Eo 'codex|gemini-cli|claude-code|ollama|hermes|generic|[1-6]' \
      | head -n 1 \
      || true
  )"
  case "$value" in
    1) value="codex" ;;
    2) value="gemini-cli" ;;
    3) value="claude-code" ;;
    4) value="ollama" ;;
    5) value="hermes" ;;
    6) value="generic" ;;
  esac
  printf '%s\n' "$value"
}

validate_agent_kind() {
  if [[ -z "$1" ]]; then
    echo "No agent source was selected." >&2
    echo "If the arrow-key menu cannot open, run non-interactively, for example:" >&2
    echo "  PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up" >&2
    echo "  PIXELVERSE_AGENT_KIND=codex ./run.sh down_up" >&2
    exit 2
  fi
  case "$1" in
    codex|gemini-cli|claude-code|ollama|hermes|generic) return 0 ;;
  esac
  printf 'Unknown PIXELVERSE_AGENT_KIND after normalization: %q\n' "$1" >&2
  echo "Use one of: codex, gemini-cli, claude-code, ollama, hermes, generic" >&2
  exit 2
}

current_agent_kind() {
  if [[ -n "${PIXELVERSE_AGENT_KIND:-}" ]]; then
    normalize_agent_kind "$PIXELVERSE_AGENT_KIND"
    return 0
  fi
  if [[ -f "$ENV_FILE" ]]; then
    local value
    value="$(grep -E '^PIXELVERSE_AGENT_KIND=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
    if [[ -n "$value" ]]; then
      normalize_agent_kind "$value"
      return 0
    fi
  fi
  return 1
}

select_adapter_target() {
  local requested="${1:-}"
  if [[ -n "$requested" ]]; then
    if [[ "$requested" == "all" ]]; then
      printf 'all\n'
      return 0
    fi
    normalize_agent_kind "$requested"
    return 0
  fi
  if current_agent_kind >/dev/null 2>&1; then
    current_agent_kind
    return 0
  fi
  echo "Select agent adapter to install. Use arrow keys + Enter, or pass ./run.sh adapter codex/hermes/etc." >&2
  normalize_agent_kind "$(select_agent_kind)"
}

write_env_file() {
  local agent_kind="$1"
  cat > "$ENV_FILE" <<EOF
PIXELVERSE_AGENT_KIND=$agent_kind
PIXELVERSE_PORT=$PIXELVERSE_PORT
MINIVERSE_BRIDGE_PORT=$BRIDGE_PORT
MINIVERSE_AGENT_ID=${MINIVERSE_AGENT_ID:-henry-main}
MINIVERSE_AGENT_NAME=${MINIVERSE_AGENT_NAME:-Henry}
MINIVERSE_AGENT_COLOR=${MINIVERSE_AGENT_COLOR:-#8b5cf6}
PIXELVERSE_NOTIFY_TO=${PIXELVERSE_NOTIFY_TO:-henry.cos.allen@gmail.com}
PIXELVERSE_NOTIFY_CMD=${PIXELVERSE_NOTIFY_CMD:-henry-notify}
PIXELVERSE_HERMES_WEB_BASE=${PIXELVERSE_HERMES_WEB_BASE:-http://host.docker.internal:9119}
PIXELVERSE_HERMES_GATEWAY_HEALTH=${PIXELVERSE_HERMES_GATEWAY_HEALTH:-http://host.docker.internal:8642/health/detailed}
PIXELVERSE_HERMES_REPO_HOST=${PIXELVERSE_HERMES_REPO_HOST:-/home/a0665x/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent}
PIXELVERSE_OLLAMA_BASE=${PIXELVERSE_OLLAMA_BASE:-http://host.docker.internal:11434}
PIXELVERSE_TAILSCALE_ENABLE=$PIXELVERSE_TAILSCALE_ENABLE
PIXELVERSE_TAILSCALE_PORT=$PIXELVERSE_TAILSCALE_PORT
EOF
}

agent_command_name() {
  case "$1" in
    codex) printf 'codex\n' ;;
    gemini-cli) printf 'gemini\n' ;;
    claude-code) printf 'claude\n' ;;
    ollama) printf 'ollama\n' ;;
    hermes) printf 'hermes\n' ;;
    generic) printf 'sh\n' ;;
  esac
}

agent_display_name() {
  case "$1" in
    codex) printf 'Codex CLI\n' ;;
    gemini-cli) printf 'Gemini CLI\n' ;;
    claude-code) printf 'Claude Code\n' ;;
    ollama) printf 'Ollama\n' ;;
    hermes) printf 'Hermes CLI\n' ;;
    generic) printf 'Generic Agent\n' ;;
  esac
}

agent_color() {
  case "$1" in
    codex) printf '#2563eb\n' ;;
    gemini-cli) printf '#16a34a\n' ;;
    claude-code) printf '#d97706\n' ;;
    ollama) printf '#0f766e\n' ;;
    hermes) printf '#8b5cf6\n' ;;
    generic) printf '#64748b\n' ;;
  esac
}

agent_env_prefix() {
  case "$1" in
    codex) printf 'CODEX\n' ;;
    gemini-cli) printf 'GEMINI\n' ;;
    claude-code) printf 'CLAUDE\n' ;;
    ollama) printf 'OLLAMA\n' ;;
    hermes) printf 'HERMES\n' ;;
    generic) printf 'GENERIC\n' ;;
  esac
}

detect_agent_roots() {
  local kind="$1"
  local cmd discovered
  cmd="$(agent_command_name "$kind")"
  discovered="$(discover_agent_command "$kind" || true)"
  echo "Detected adapter context for $kind:"
  if [[ -n "$discovered" ]]; then
    echo "- command: $discovered"
  else
    echo "- command: not found in PATH ($cmd)"
  fi
  case "$kind" in
    codex)
      [[ -d "$HOME/.codex" ]] && echo "- config: $HOME/.codex" || echo "- config: $HOME/.codex not found"
      ;;
    gemini-cli)
      [[ -d "$HOME/.gemini" ]] && echo "- config: $HOME/.gemini" || echo "- config: $HOME/.gemini not found"
      ;;
    claude-code)
      [[ -d "$HOME/.claude" ]] && echo "- config: $HOME/.claude" || echo "- config: $HOME/.claude not found"
      ;;
    ollama)
      [[ -d "$HOME/.ollama" ]] && echo "- config: $HOME/.ollama" || echo "- config: $HOME/.ollama not found"
      ;;
    hermes)
      local candidate
      for candidate in \
        "${HERMES_REPO:-}" \
        "$HOME/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent" \
        "$HOME/Desktop/AI_AGX_WS/hermes-agent" \
        "$HOME/.hermes"; do
        [[ -n "$candidate" && -e "$candidate" ]] && echo "- root: $candidate"
      done
      ;;
  esac
}

path_without_adapter_bin() {
  local bin_dir="$STATE_DIR/bin"
  python3 - "$bin_dir" "${PATH:-}" <<'PY'
import os
import sys
adapter_bin = os.path.realpath(sys.argv[1])
parts = []
for part in sys.argv[2].split(os.pathsep):
    if part and os.path.realpath(part) != adapter_bin:
        parts.append(part)
print(os.pathsep.join(parts))
PY
}

discover_agent_command() {
  local kind="$1"
  local cmd candidate search_path
  cmd="$(agent_command_name "$kind")"
  search_path="$(path_without_adapter_bin)"
  if PATH="$search_path" command -v "$cmd" >/dev/null 2>&1; then
    PATH="$search_path" command -v "$cmd"
    return 0
  fi

  local candidates=(
    "$HOME/.local/bin/$cmd"
    "$HOME/bin/$cmd"
    "$HOME/.npm-global/bin/$cmd"
    "$HOME/.yarn/bin/$cmd"
    "$HOME/.bun/bin/$cmd"
    "/usr/local/bin/$cmd"
    "/usr/bin/$cmd"
  )

  case "$kind" in
    hermes)
      candidates+=(
        "${HERMES_REPO:-}/venv/bin/hermes"
        "$HOME/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent/venv/bin/hermes"
        "$HOME/Desktop/AI_AGX_WS/hermes-agent/venv/bin/hermes"
      )
      ;;
  esac

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  if [[ -d "$HOME/.nvm/versions/node" ]]; then
    candidate="$(
      find "$HOME/.nvm/versions/node" -path "*/bin/$cmd" -type f -perm -u+x 2>/dev/null \
        | sort -V \
        | tail -n 1
    )"
    if [[ -n "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  return 1
}

stop_legacy_local_processes() {
  local patterns=(
    "python3 .*pixelverse_server.py"
    "uvicorn pixelverse_fastapi:app"
    "bridge.py .*--port ${BRIDGE_PORT}"
  )
  local pattern pids
  for pattern in "${patterns[@]}"; do
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    [[ -n "$pids" ]] || continue
    echo "Stopping legacy local process(es) for pattern [$pattern]: $pids"
    while read -r pid; do
      [[ -n "$pid" ]] || continue
      [[ "$pid" != "$$" ]] || continue
      kill "$pid" >/dev/null 2>&1 || true
    done <<< "$pids"
  done
}

wait_for_openapi() {
  for _ in {1..80}; do
    if curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/openapi.json" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "Pixelverse container started, but /openapi.json was not reachable yet." >&2
  echo "Check logs with: ./run.sh log" >&2
  return 1
}

tailscale_url() {
  local domain
  domain="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Self",{}).get("DNSName","").rstrip("."))' 2>/dev/null || true)"
  [[ -n "$domain" ]] || return 1
  printf 'https://%s:%s/\n' "$domain" "$PIXELVERSE_TAILSCALE_PORT"
}

ensure_tailscale_exposure() {
  if [[ "$PIXELVERSE_TAILSCALE_ENABLE" == "0" ]]; then
    return 0
  fi
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "Warning: tailscale CLI not found; skipping Tailscale exposure." >&2
    return 0
  fi
  if ! tailscale status >/dev/null 2>&1; then
    echo "Warning: tailscale is not running; skipping Tailscale exposure." >&2
    return 0
  fi
  local target="http://127.0.0.1:${PIXELVERSE_PORT}"
  echo "Exposing Pixelverse to Tailscale on HTTPS port ${PIXELVERSE_TAILSCALE_PORT}..."
  tailscale serve --bg --https="${PIXELVERSE_TAILSCALE_PORT}" "$target" >/dev/null
}

print_tailscale_status() {
  if [[ "$PIXELVERSE_TAILSCALE_ENABLE" == "0" ]]; then
    return 0
  fi
  local url
  url="$(tailscale_url || true)"
  [[ -n "$url" ]] || return 0
  echo "- Tailscale:   $url"
}

start_service() {
  local agent_kind
  echo "Select agent source for Pixelverse. Use arrow keys + Enter, or set PIXELVERSE_AGENT_KIND=codex/gemini-cli/claude-code/ollama/hermes/generic." >&2
  agent_kind="$(normalize_agent_kind "$(select_agent_kind)")"
  validate_agent_kind "$agent_kind"
  write_env_file "$agent_kind"
  install_agent_adapter "$agent_kind"

  stop_legacy_local_processes
  echo "Starting Pixelverse Docker service for $agent_kind..."
  if [[ "${PIXELVERSE_REBUILD:-0}" == "1" ]]; then
    echo "Rebuilding Docker image because PIXELVERSE_REBUILD=1."
    compose up -d --build
  elif docker image inspect hermes-pixelverse:local >/dev/null 2>&1; then
    echo "Using existing Docker image hermes-pixelverse:local. Set PIXELVERSE_REBUILD=1 to rebuild."
    compose up -d --no-build
  else
    echo "Docker image hermes-pixelverse:local not found; building it once."
    compose up -d --build
  fi
  wait_for_openapi || doctor_service
  ensure_tailscale_exposure

  cat <<EOF
Pixelverse Docker service started
- Agent source: $agent_kind
- UI:          http://localhost:${PIXELVERSE_PORT}
- Swagger API: http://localhost:${PIXELVERSE_PORT}/docs
- OpenAPI:     http://localhost:${PIXELVERSE_PORT}/openapi.json
- World API:   http://localhost:${PIXELVERSE_PORT}/api/world
- Bridge hook: http://localhost:${BRIDGE_PORT}/hook
EOF
  print_tailscale_status
  cat <<EOF

Minimal event test:
  curl -X POST http://localhost:${PIXELVERSE_PORT}/api/event \\
    -H 'Content-Type: application/json' \\
    -d '{"agent_type":"$agent_kind","agent":"$agent_kind-main","event":"tool.started","tool_name":"terminal","message":"running a command"}'
EOF
}

stop_service() {
  if [[ ! -f "$ENV_FILE" ]]; then
    write_env_file "${PIXELVERSE_AGENT_KIND:-generic}"
  fi
  compose down --remove-orphans || true
  stop_legacy_local_processes
  echo "Pixelverse service stopped."
}

status_service() {
  if [[ ! -f "$ENV_FILE" ]]; then
    write_env_file "${PIXELVERSE_AGENT_KIND:-generic}"
  fi
  compose ps
  echo
  echo "Endpoints:"
  echo "- UI:          http://localhost:${PIXELVERSE_PORT}"
  echo "- Swagger API: http://localhost:${PIXELVERSE_PORT}/docs"
  echo "- OpenAPI:     http://localhost:${PIXELVERSE_PORT}/openapi.json"
  echo "- World API:   http://localhost:${PIXELVERSE_PORT}/api/world"
  print_tailscale_status
}

doctor_service() {
  if [[ ! -f "$ENV_FILE" ]]; then
    write_env_file "${PIXELVERSE_AGENT_KIND:-generic}"
  fi

  echo "Pixelverse Doctor"
  echo "== Config =="
  echo "- Root: $ROOT"
  echo "- Compose project: $COMPOSE_PROJECT_NAME"
  echo "- Env file: $ENV_FILE"
  sed -n '1,80p' "$ENV_FILE" 2>/dev/null || true
  local configured_agent
  configured_agent="$(sed -n 's/^PIXELVERSE_AGENT_KIND=//p' "$ENV_FILE" 2>/dev/null | tail -1)"
  if [[ "${configured_agent:-}" != "hermes" ]]; then
    echo
    echo "!! Hermes alignment warning:"
    echo "   Current PIXELVERSE_AGENT_KIND=${configured_agent:-unknown}. Hermes state polling is enabled only when this is 'hermes'."
    echo "   Fix: PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up"
  fi

  echo
  echo "== Docker =="
  docker --version 2>/dev/null || true
  docker compose version 2>/dev/null || true
  docker info --format 'ServerVersion={{.ServerVersion}} Driver={{.Driver}} CgroupDriver={{.CgroupDriver}}' 2>/dev/null || true

  echo
  echo "== Compose Config =="
  compose config --quiet && echo "compose config: ok" || echo "compose config: failed"

  echo
  echo "== Containers =="
  compose ps || true
  docker ps -a --filter name=hermes-pixelverse --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true

  echo
  echo "== Port Owners =="
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -E ":(${PIXELVERSE_PORT}|${BRIDGE_PORT})[[:space:]]" || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PIXELVERSE_PORT" -sTCP:LISTEN 2>/dev/null || true
    lsof -nP -iTCP:"$BRIDGE_PORT" -sTCP:LISTEN 2>/dev/null || true
  fi

  echo
  echo "== Legacy Processes =="
  pgrep -af "python3 .*pixelverse_server.py|uvicorn pixelverse_fastapi:app|bridge.py .*--port ${BRIDGE_PORT}" 2>/dev/null || true

  echo
  echo "== API Probes =="
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/health" 2>/dev/null || echo "health: unavailable"
  echo
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/openapi.json" >/dev/null 2>&1 && echo "openapi: ok" || echo "openapi: unavailable"
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/api/world" >/dev/null 2>&1 && echo "world api: ok" || echo "world api: unavailable"
  echo
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/api/sources" 2>/dev/null || echo "sources api: unavailable"

  echo
  echo "== Hermes Host Probes =="
  curl -fsS "${PIXELVERSE_HERMES_WEB_BASE:-http://127.0.0.1:9119}/api/status" 2>/dev/null || echo "Hermes web status unavailable on host"
  echo
  curl -fsS "${PIXELVERSE_HERMES_GATEWAY_HEALTH:-http://127.0.0.1:8642/health/detailed}" 2>/dev/null || echo "Hermes gateway health unavailable on host"
  echo
  curl -fsS "http://127.0.0.1:${BRIDGE_PORT}/health" 2>/dev/null || echo "Pixelverse bridge health unavailable on host"

  echo
  echo "== Tailscale =="
  if command -v tailscale >/dev/null 2>&1; then
    tailscale status --json 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); running = data.get("BackendState") == "Running"; dns = data.get("Self", {}).get("DNSName", "").rstrip("."); print(f"running={running} dns={dns}")' || true
    tailscale serve status 2>/dev/null || true
  else
    echo "tailscale CLI not installed"
  fi

  echo
  echo "== Recent Logs =="
  compose logs --tail 120 || true
}

logs_service() {
  if [[ ! -f "$ENV_FILE" ]]; then
    write_env_file "${PIXELVERSE_AGENT_KIND:-generic}"
  fi
  compose logs -f --tail "${PIXELVERSE_LOG_LINES:-160}"
}

install_hermes_hook() {
  local hermes_home="${HERMES_HOME:-$HOME/.hermes}"
  local target="$hermes_home/hooks/pixelverse"
  mkdir -p "$target"
  cp "$ROOT/hooks/miniverse/HOOK.yaml" "$target/HOOK.yaml"
  cp "$ROOT/hooks/miniverse/handler.py" "$target/handler.py"
  echo "Installed Pixelverse Hermes hook:"
  echo "- $target/HOOK.yaml"
  echo "- $target/handler.py"
  echo
  echo "Restart Hermes gateway/OpenWebUI bootstrap so gateway.hooks reloads this hook:"
  echo "  ~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/run.sh restart"
  echo
  echo "The hook posts Hermes agent lifecycle events to:"
  echo "  ${MINIVERSE_BRIDGE_URL:-http://localhost:${BRIDGE_PORT}}/hook"
}

install_hermes_plugin() {
  local hermes_home="${HERMES_HOME:-$HOME/.hermes}"
  local target="$hermes_home/plugins/pixelverse"
  mkdir -p "$target"
  cp "$ROOT/hermes_plugin/pixelverse/plugin.yaml" "$target/plugin.yaml"
  cp "$ROOT/hermes_plugin/pixelverse/__init__.py" "$target/__init__.py"
  echo "Installed Pixelverse Hermes user plugin:"
  echo "- $target/plugin.yaml"
  echo "- $target/__init__.py"
  echo
  echo "This plugin mirrors direct 'hermes chat' LLM/tool hooks to:"
  echo "  ${PIXELVERSE_URL:-http://127.0.0.1:${PIXELVERSE_PORT}}/api/event"
  echo
  echo "Restart any already-running Hermes chat session so plugins are reloaded."
}

write_cli_shim() {
  local kind="$1"
  local shim_name="$2"
  local command_name="$3"
  local env_prefix="$4"
  local agent_id="$5"
  local display_name="$6"
  local color="$7"
  local fallback_command="${8:-}"
  local bin_dir="$STATE_DIR/bin"
  local shim="$bin_dir/$shim_name"
  local fallback_quoted
  printf -v fallback_quoted '%q' "$fallback_command"
  mkdir -p "$bin_dir"
  cat > "$shim" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SELF_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PATH_WITHOUT_SELF="\$(python3 - "\$SELF_DIR" "\${PATH:-}" <<'PY'
import os
import sys
self_dir = os.path.realpath(sys.argv[1])
parts = []
for part in sys.argv[2].split(os.pathsep):
    if part and os.path.realpath(part) != self_dir:
        parts.append(part)
print(os.pathsep.join(parts))
PY
)"
ORIG="\${PIXELVERSE_${env_prefix}_COMMAND:-}"
FALLBACK_ORIG=$fallback_quoted
if [[ -z "\$ORIG" ]]; then
  ORIG="\$(PATH="\$PATH_WITHOUT_SELF" command -v "$command_name" || true)"
fi
if [[ -z "\$ORIG" && -n "\$FALLBACK_ORIG" && -x "\$FALLBACK_ORIG" ]]; then
  ORIG="\$FALLBACK_ORIG"
fi
if [[ -z "\$ORIG" ]]; then
  echo "Pixelverse adapter could not find original command: $command_name" >&2
  echo "Set PIXELVERSE_${env_prefix}_COMMAND=/absolute/path/to/$command_name" >&2
  exit 127
fi
exec python3 "$ROOT/agent_bridges/cli_adapter.py" \\
  --agent-type "$kind" \\
  --agent "$agent_id" \\
  --name "$display_name" \\
  --color "$color" \\
  -- "\$ORIG" "\$@"
EOF
  chmod +x "$shim"
}

install_cli_adapter_for_kind() {
  local kind="$1"
  local command_name display_name color env_prefix agent_id bin_dir fallback_command
  command_name="$(agent_command_name "$kind")"
  display_name="$(agent_display_name "$kind")"
  color="$(agent_color "$kind")"
  env_prefix="$(agent_env_prefix "$kind")"
  agent_id="${kind}-cli"
  bin_dir="$STATE_DIR/bin"
  fallback_command="$(discover_agent_command "$kind" || true)"
  write_cli_shim "$kind" "$command_name" "$command_name" "$env_prefix" "$agent_id" "$display_name" "$color" "$fallback_command"
  write_cli_shim "$kind" "pixelverse-$command_name" "$command_name" "$env_prefix" "$agent_id" "$display_name" "$color" "$fallback_command"
  echo "Installed Pixelverse CLI adapter for $kind:"
  echo "- $bin_dir/$command_name"
  echo "- $bin_dir/pixelverse-$command_name"
  detect_agent_roots "$kind"
  echo
  echo "To make direct '$command_name ...' commands observable in this shell:"
  echo "  source \"$STATE_DIR/activate.sh\""
  echo
  echo "Without changing PATH, use:"
  echo "  $bin_dir/pixelverse-$command_name --help"
}

write_adapter_activation() {
  local bin_dir="$STATE_DIR/bin"
  local activation="$STATE_DIR/activate.sh"
  mkdir -p "$STATE_DIR"
  cat > "$activation" <<EOF
# Source this file to make native agent CLI commands observable by Pixelverse.
# It prepends local shim commands only; it does not modify or overwrite the original CLIs.
export PIXELVERSE_URL="\${PIXELVERSE_URL:-http://127.0.0.1:${PIXELVERSE_PORT}}"
case ":\${PATH:-}:" in
  *":$bin_dir:"*) ;;
  *) export PATH="$bin_dir:\${PATH:-}" ;;
esac
EOF
  echo
  echo "Adapter activation file:"
  echo "- $activation"
  echo
  echo "Enable native CLI command interception in the current shell with:"
  echo "  source \"$activation\""
  echo
  echo "This only changes PATH for your current shell. It does not edit the original agent CLI."
}

install_agent_adapter() {
  local target="${1:-${PIXELVERSE_AGENT_KIND:-hermes}}"
  case "$target" in
    hermes-cli) target="hermes" ;;
    codex|gemini-cli|claude-code|ollama|hermes|generic|hermes-hook|hermes-plugin|all) ;;
    *)
      echo "Unknown adapter target: $target" >&2
      echo "Use one of: codex, gemini-cli, claude-code, ollama, hermes, generic, hermes-hook, hermes-plugin, all" >&2
      exit 2
      ;;
  esac

  if [[ "$target" == "all" ]]; then
    for kind in codex gemini-cli claude-code ollama hermes generic; do
      install_cli_adapter_for_kind "$kind"
    done
    install_hermes_hook
    install_hermes_plugin
    write_adapter_activation
    return 0
  fi

  if [[ "$target" == "hermes-hook" ]]; then
    install_hermes_hook
    return 0
  fi

  if [[ "$target" == "hermes-plugin" ]]; then
    install_hermes_plugin
    return 0
  fi

  install_cli_adapter_for_kind "$target"
  if [[ "$target" == "hermes" ]]; then
    install_hermes_hook
    install_hermes_plugin
  fi
  write_adapter_activation
}

adapter_command() {
  local target
  target="$(select_adapter_target "${1:-}")"
  if [[ "$target" != "all" ]]; then
    validate_agent_kind "$target"
  fi
  install_agent_adapter "$target"
}

bridge_status() {
  local bin_dir="$STATE_DIR/bin"
  echo "Pixelverse Bridge Status"
  echo "== Local API =="
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/health" 2>/dev/null || echo "health: unavailable"
  echo
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/openapi.json" >/dev/null 2>&1 && echo "openapi: ok" || echo "openapi: unavailable"
  curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/api/world" >/dev/null 2>&1 && echo "world api: ok" || echo "world api: unavailable"
  echo
  echo "== Bridge Hook =="
  curl -fsS "http://127.0.0.1:${BRIDGE_PORT}/health" 2>/dev/null || echo "bridge hook health: unavailable"
  echo
  echo "== Adapter Files =="
  [[ -f "$ROOT/agent_bridges/pixelverse_client.py" ]] && echo "universal client: ok" || echo "universal client: missing"
  [[ -f "$ROOT/agent_bridges/hermes_adapter.py" ]] && echo "Hermes adapter: ok" || echo "Hermes adapter: missing"
  [[ -f "$ROOT/agent_bridges/cli_adapter.py" ]] && echo "generic CLI adapter: ok" || echo "generic CLI adapter: missing"
  for shim in codex gemini claude ollama hermes; do
    [[ -x "$bin_dir/$shim" ]] && echo "$shim shim: $bin_dir/$shim" || echo "$shim shim: not installed"
  done
  if [[ -f "${HERMES_HOME:-$HOME/.hermes}/hooks/pixelverse/HOOK.yaml" ]]; then
    echo "Hermes hook: ${HERMES_HOME:-$HOME/.hermes}/hooks/pixelverse"
  else
    echo "Hermes hook: not installed"
  fi
  if [[ -f "${HERMES_HOME:-$HOME/.hermes}/plugins/pixelverse/plugin.yaml" ]]; then
    echo "Hermes plugin: ${HERMES_HOME:-$HOME/.hermes}/plugins/pixelverse"
  else
    echo "Hermes plugin: not installed"
  fi
  echo
  echo "== Minimal Commands =="
  echo "export PATH=\"$bin_dir:\$PATH\""
  echo "python3 -m agent_bridges.pixelverse_client tool --agent-type codex --agent codex-main --tool-names terminal"
  echo "./run.sh install-adapter all"
  echo "$bin_dir/pixelverse-hermes chat"
  echo "./run.sh hermes-chat"
}

hermes_chat() {
  install_agent_adapter hermes
  exec "$STATE_DIR/bin/pixelverse-hermes" chat "$@"
}

render_latest_trajectory() {
  local output
  if output="$(python3 "$ROOT/scripts/render_local_ui_trajectory.py" 2>&1)"; then
    echo "Trajectory image: $output"
  else
    echo "Warning: failed to render trajectory image:" >&2
    echo "$output" >&2
  fi
}

capture_world_snapshot() {
  local snapshot_url="http://127.0.0.1:${PIXELVERSE_PORT}/api/world"
  local output="$ROOT/tmp/latest_world_snapshot.json"
  if curl -fsS "$snapshot_url" > "$output"; then
    return 0
  fi
  docker exec hermes-pixelverse curl -fsS "$snapshot_url" > "$output"
}

post_json() {
  local url="$1"
  local payload="$2"
  if curl -fsS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null; then
    return 0
  fi
  docker exec hermes-pixelverse curl -fsS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null
}

test_hook() {
  local bridge_url="${MINIVERSE_BRIDGE_URL:-http://127.0.0.1:${BRIDGE_PORT}}"
  local delay="${PIXELVERSE_TEST_HOOK_DELAY:-3}"
  local scenarios=(
    "blueprint_lab|search_files,read_file|搜尋與讀檔測試"
    "tool_forge|patch,terminal|修改檔案與終端機測試"
    "response_studio|reply,draft_response|回覆工坊測試"
    "clone_bay|delegate_task|分身派遣測試"
    "session_archive|session_search,history|工作階段檔案庫測試"
  )
  local selected=""
  local requested_target="${PIXELVERSE_TEST_HOOK_TARGET:-}"
  if [[ -n "$requested_target" ]]; then
    for scenario in "${scenarios[@]}"; do
      if [[ "${scenario%%|*}" == "$requested_target" ]]; then
        selected="$scenario"
        break
      fi
    done
    if [[ -z "$selected" ]]; then
      echo "Unknown PIXELVERSE_TEST_HOOK_TARGET: $requested_target" >&2
      echo "Use one of: blueprint_lab, tool_forge, response_studio, clone_bay, session_archive" >&2
      exit 2
    fi
  else
    selected="${scenarios[$((RANDOM % ${#scenarios[@]}))]}"
  fi
  local target_room="${selected%%|*}"
  local rest="${selected#*|}"
  local tool_csv="${rest%%|*}"
  local label="${rest#*|}"
  local tools_json
  IFS=',' read -r -a tools <<< "$tool_csv"
  tools_json="["
  for tool in "${tools[@]}"; do
    if [[ "$tools_json" != "[" ]]; then
      tools_json+=","
    fi
    tools_json+="\"$tool\""
  done
  tools_json+="]"

  echo "Sending synthetic Hermes events to $bridge_url/hook ..."
  echo "Random test route: think_lab -> ${target_room} -> standby_dock (${label})"
  mkdir -p "$ROOT/tmp"
  local agents_json
  if [[ "$target_room" == "clone_bay" ]]; then
    agents_json=",\"agents\":[{\"agent\":\"henry-main\",\"name\":\"Henry\",\"role\":\"main_agent\",\"start_room\":\"think_lab\",\"target_room\":\"clone_bay\",\"return_room\":\"standby_dock\",\"state\":\"working\",\"tool_csv\":\"delegate_task\"},{\"agent\":\"synthetic-subagent-1\",\"name\":\"Test Subagent\",\"role\":\"subagent\",\"start_room\":\"clone_bay\",\"target_room\":\"tool_forge\",\"return_room\":\"clone_bay\",\"state\":\"working\",\"tool_csv\":\"patch,terminal\"}]"
  else
    agents_json=",\"agents\":[{\"agent\":\"henry-main\",\"name\":\"Henry\",\"role\":\"main_agent\",\"start_room\":\"think_lab\",\"target_room\":\"${target_room}\",\"return_room\":\"standby_dock\",\"state\":\"working\",\"tool_csv\":\"${tool_csv}\"}]"
  fi
  printf '{"target_room":"%s","tool_csv":"%s","label":"%s","start_room":"think_lab","return_room":"standby_dock","created_at":"%s","event_sequence":["main:start","main:step","subagent:step-if-clone","subagent:end-if-clone","main:end"]%s}\n' \
    "$target_room" "$tool_csv" "$label" "$(date -Iseconds)" "$agents_json" > "$ROOT/tmp/latest_test_hook_route.json"

  local start_json="{\"event\":\"agent:start\",\"context\":{\"message\":\"Pixelverse random route test started\",\"target_room\":\"think_lab\"}}"
  local step_json="{\"event\":\"agent:step\",\"context\":{\"tool_names\":${tools_json},\"target_room\":\"${target_room}\"}}"
  local end_json="{\"event\":\"agent:end\",\"context\":{\"response\":\"Synthetic hook test completed: ${label}.\"}}"

  if ! post_json "$bridge_url/hook" "$start_json"; then
    echo "Host bridge URL was unavailable; retrying inside Docker container..."
    bridge_url="http://127.0.0.1:${BRIDGE_PORT}"
  fi
  sleep "$delay"
  post_json "$bridge_url/hook" "$step_json"
  if [[ "$target_room" == "clone_bay" ]]; then
    post_json "http://127.0.0.1:${PIXELVERSE_PORT}/api/event" \
      '{"agent_type":"hermes","agent":"synthetic-subagent-1","name":"Test Subagent","role":"subagent","event":"tool.started","tool_names":["patch","terminal"],"target_room":"tool_forge","message":"Synthetic subagent is patching from delegated task.","color":"#a78bfa"}'
  fi
  sleep "$delay"
  if [[ "$target_room" == "clone_bay" ]]; then
    post_json "http://127.0.0.1:${PIXELVERSE_PORT}/api/event" \
      '{"agent_type":"hermes","agent":"synthetic-subagent-1","name":"Test Subagent","role":"subagent","event":"completed","state":"idle","target_room":"clone_bay","message":"Synthetic subagent completed delegated patch work.","color":"#a78bfa"}'
  fi
  post_json "$bridge_url/hook" "$end_json"
  capture_world_snapshot || true
  render_latest_trajectory
  echo "Synthetic hook sequence sent. Check UI or /api/world events."
}

case "$COMMAND" in
  start)
    start_service
    ;;
  stop|down)
    stop_service
    ;;
  restart|down_up)
    stop_service
    start_service
    ;;
  status)
    status_service
    ;;
  log|logs)
    logs_service
    ;;
  doctor)
    doctor_service
    ;;
  bridge-status)
    bridge_status
    ;;
  adapter)
    adapter_command "${2:-}"
    ;;
  install-adapter)
    if [[ -n "${2:-}" ]]; then
      install_agent_adapter "$2"
    elif current_agent_kind >/dev/null 2>&1; then
      install_agent_adapter "$(current_agent_kind)"
    else
      install_agent_adapter hermes
    fi
    ;;
  install-hermes-hook)
    install_hermes_hook
    ;;
  hermes-chat)
    shift
    hermes_chat "$@"
    ;;
  test-hook)
    test_hook
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    usage
    exit 2
    ;;
esac

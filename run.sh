#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${PIXELVERSE_STATE_DIR:-$ROOT/.pixelverse-service}"
ENV_FILE="$STATE_DIR/compose.env"
RUNTIME_DIR="$STATE_DIR/runtime"
COMMAND="${1:-start}"

normalized_host_arch() {
  local machine="${PIXELVERSE_UNAME_M:-$(uname -m)}"
  case "$machine" in
    x86_64|amd64) printf 'amd64\n' ;;
    aarch64|arm64) printf 'arm64\n' ;;
    *)
      echo "Unsupported host architecture: $machine" >&2
      echo "CLI_Pixelverse supports x86_64/amd64 and aarch64/arm64 hosts." >&2
      echo "Set PIXELVERSE_DOCKER_PLATFORM only when Docker emulation is intentionally configured." >&2
      return 2
      ;;
  esac
}

native_docker_platform() {
  case "$(normalized_host_arch)" in
    amd64) printf 'linux/amd64\n' ;;
    arm64) printf 'linux/arm64\n' ;;
  esac
}

ensure_platform_env() {
  local platform="${PIXELVERSE_DOCKER_PLATFORM:-}"
  if [[ -z "$platform" ]]; then
    platform="$(native_docker_platform)"
  fi
  case "$platform" in
    linux/amd64|linux/arm64) ;;
    *)
      echo "Unsupported Docker platform: $platform" >&2
      echo "Use linux/amd64 or linux/arm64." >&2
      return 2
      ;;
  esac
  PIXELVERSE_DOCKER_PLATFORM="$platform"
  export PIXELVERSE_DOCKER_PLATFORM
}

platform_command() {
  local host_arch platform suffix=""
  host_arch="$(normalized_host_arch)"
  if [[ -n "${PIXELVERSE_DOCKER_PLATFORM:-}" ]]; then suffix=" (override)"; fi
  ensure_platform_env
  platform="$PIXELVERSE_DOCKER_PLATFORM"
  printf 'Host architecture: %s\n' "$host_arch"
  printf 'Docker platform:  %s%s\n' "$platform" "$suffix"
}

SAVED_PIXELVERSE_PORT=""
SAVED_BRIDGE_PORT=""
case "$COMMAND" in
  start|stop|restart|down_up|status|log|logs|doctor|bridge-status|test-hook|smoke-furniture-drag|assets-status|down)
    load_saved_port=1
    ;;
  *) load_saved_port=0 ;;
esac
if [[ "$load_saved_port" == "1" && -f "$ENV_FILE" ]]; then
  SAVED_PIXELVERSE_PORT="$(sed -n 's/^PIXELVERSE_PORT=//p' "$ENV_FILE" | tail -n 1)"
  SAVED_BRIDGE_PORT="$(sed -n 's/^PIXELVERSE_BRIDGE_PORT=//p' "$ENV_FILE" | tail -n 1)"
fi
PIXELVERSE_PORT="${PIXELVERSE_PORT:-${SAVED_PIXELVERSE_PORT:-5660}}"
BRIDGE_PORT="${PIXELVERSE_BRIDGE_PORT:-${SAVED_BRIDGE_PORT:-4567}}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cli-pixelverse}"
PIXELVERSE_TAILSCALE_ENABLE="${PIXELVERSE_TAILSCALE_ENABLE:-1}"
PIXELVERSE_TAILSCALE_PORT="${PIXELVERSE_TAILSCALE_PORT:-10000}"
PIXELVERSE_EXPOSURE_MODE="${PIXELVERSE_EXPOSURE_MODE:-}"

mkdir -p "$STATE_DIR" "$RUNTIME_DIR"

usage() {
  cat <<EOF
Usage: ./run.sh [start|stop|restart|down_up|status|log|logs|doctor|assets-status|platform|bridge-status|floorplans|prepare-floorplan|map-builder|adapter|install-adapter|install-codex-hook|enable-shell-adapter|install-hermes-hook|hermes-chat|test-hook|smoke-furniture-drag|down]

Commands:
  start      Start Docker Compose and ask for interactive service choices.
  stop       Stop Docker Compose service and legacy local processes.
  restart    Restart with saved agent, exposure, and runtime floorplan settings.
  down_up    Alias for restart.
  status     Show container status and API endpoints.
  log/logs   Follow Docker Compose logs.
  doctor     Diagnose ports, legacy processes, Docker, Compose, and API health.
  assets-status
             Validate locally prepared Modern Office assets without starting Docker.
  platform   Show normalized host architecture and Docker target platform.
  bridge-status
             Show Pixelverse API, bridge hook, Hermes hook, and local adapter status.
  floorplans List complete global_map/*.yaml + *.png floorplan pairs.
  prepare-floorplan
             Copy the selected floorplan pair to tmp/global_map/default.yaml/png.
  map-builder
             Print the PNG/YAML alignment builder URL and export validation flow.
  adapter [codex|gemini-cli|claude-code|antigravity|ollama|hermes|generic|all]
             Install the adapter for the selected/native CLI without modifying the original CLI code.
  install-adapter [codex|gemini-cli|claude-code|antigravity|ollama|hermes|generic|all|hermes-hook|hermes-plugin]
             Install local agent CLI shims/hooks. Default: current selected agent or hermes.
  install-codex-hook [project-root]
             Install only the Codex project hook into the current directory or project-root.
  enable-shell-adapter
             Add a managed Bash startup line so new terminals automatically load local CLI shims.
  install-hermes-hook
             Install/update the Hermes gateway hook that relays agent lifecycle events.
  hermes-chat
             Launch Hermes chat through the Pixelverse wrapper.
  test-hook  Send a synthetic lifecycle sequence and refresh tmp trajectory/debug files.
  smoke-furniture-drag
             Run repeatable Chromium smoke for cross-room furniture drag/clipping.
  down       Alias for stop.

Non-interactive agent selection:
  PIXELVERSE_AGENT_KIND=ollama ./run.sh start
  PIXELVERSE_AGENT_KIND=codex ./run.sh down_up
  PIXELVERSE_AGENT_KIND=antigravity ./run.sh down_up

Non-interactive floorplan selection:
  PIXELVERSE_FLOORPLAN=default ./run.sh down_up
  PIXELVERSE_FLOORPLAN=custom ./run.sh prepare-floorplan
  PIXELVERSE_GLOBAL_MAP_DIR_HOST=/path/to/runtime-map PIXELVERSE_FLOORPLAN=custom ./run.sh down_up

Common service flows:
  PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up
  PIXELVERSE_REBUILD=1 PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up
  ./run.sh status
  ./run.sh log
  ./run.sh doctor

Licensed Modern Office assets:
  Place Modern_Office_Revamped_v1.zip at:
    private_assets/modern-office/Modern_Office_Revamped_v1.zip
  Or set PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/Modern_Office_Revamped_v1.zip
  ./run.sh assets-status

Universal bridge client:
  python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex
  python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file
  python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main

MCP onboarding server:
  python3 scripts/pixelverse_mcp_server.py
  Tools: pixelverse_onboard, pixelverse_install_adapter, pixelverse_bridge_status, pixelverse_emit_event

Agent CLI adapters:
  ./run.sh adapter
  ./run.sh adapter codex
  ./run.sh adapter antigravity
  ./run.sh install-adapter codex
  ./run.sh install-codex-hook /path/to/other-repo
  ./run.sh install-adapter gemini-cli
  ./run.sh install-adapter claude-code
  ./run.sh install-adapter antigravity
  ./run.sh install-adapter hermes
  source "$STATE_DIR/activate.sh"
  codex
  gemini
  claude
  antigravity
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
  tmp/global_map_walkability_mask.png  Planner occupancy mask: black=blocked, white=free, gray=door.

Repeatable browser smoke tests:
  ./run.sh smoke-furniture-drag
  PIXELVERSE_SMOKE_BASE_URL=http://127.0.0.1:5660 ./run.sh smoke-furniture-drag
  PIXELVERSE_SMOKE_HEADED=1 PIXELVERSE_SMOKE_SLOW_MO_MS=150 ./run.sh smoke-furniture-drag

Furniture drag smoke artifacts:
  tmp/furniture_drag_browser_smoke.json  Structured PASS/FAIL result.
  tmp/furniture_drag_browser_smoke.png   Full-page browser screenshot after drag.

Subagent test behavior:
  clone_bay creates synthetic-subagent-1. Local agents are not deleted automatically;
  completed subagents remain visible as idle, and unfinished/stale subagents remain
  represented in /api/world instead of disappearing.
EOF
}

compose() {
  ensure_platform_env
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$ENV_FILE" \
    -f "$ROOT/docker-compose.yml" \
    "$@"
}

provision_modern_office_assets() {
  python3 "$ROOT/scripts/provision_modern_office_assets.py"
}

select_agent_kind() {
  if [[ -n "${PIXELVERSE_AGENT_KIND:-}" ]]; then
    printf '%s\n' "$PIXELVERSE_AGENT_KIND"
    return 0
  fi
  python3 "$ROOT/scripts/select_agent.py"
}

select_exposure_mode() {
  if [[ -n "${PIXELVERSE_EXPOSURE_MODE:-}" ]]; then
    printf '%s\n' "$PIXELVERSE_EXPOSURE_MODE"
    return 0
  fi
  if [[ ! -t 0 ]]; then
    printf 'localhost\n'
    return 0
  fi
  python3 "$ROOT/scripts/select_exposure.py"
}

normalize_exposure_mode() {
  case "$1" in
    tailscale|2) printf 'tailscale\n' ;;
    ngrok|3) printf 'ngrok\n' ;;
    localhost|local|1|"") printf 'localhost\n' ;;
    *) printf 'localhost\n' ;;
  esac
}

normalize_agent_kind() {
  local value="$1"
  value="$(
    printf '%s\n' "$value" \
      | tr -d '\r' \
      | sed -E 's/\x1B\[[0-9;?]*[[:alpha:]]//g' \
      | grep -Eo 'codex|gemini-cli|claude-code|antigravity|antugravity|ollama|hermes|generic|[1-7]' \
      | head -n 1 \
      || true
  )"
  case "$value" in
    1) value="codex" ;;
    2) value="gemini-cli" ;;
    3) value="claude-code" ;;
    4) value="antigravity" ;;
    5) value="ollama" ;;
    6) value="hermes" ;;
    7) value="generic" ;;
    antugravity) value="antigravity" ;;
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
    codex|gemini-cli|claude-code|antigravity|ollama|hermes|generic) return 0 ;;
  esac
  printf 'Unknown PIXELVERSE_AGENT_KIND after normalization: %q\n' "$1" >&2
  echo "Use one of: codex, gemini-cli, claude-code, antigravity, ollama, hermes, generic" >&2
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

saved_env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
}

resolve_agent_kind() {
  local mode="${1:-interactive}" saved=""
  if [[ -n "${PIXELVERSE_AGENT_KIND:-}" ]]; then
    normalize_agent_kind "$PIXELVERSE_AGENT_KIND"
    return 0
  fi
  if [[ "$mode" == "reuse" ]]; then
    saved="$(saved_env_value PIXELVERSE_AGENT_KIND || true)"
    if [[ -n "$saved" ]]; then
      normalize_agent_kind "$saved"
      return 0
    fi
  fi
  normalize_agent_kind "$(select_agent_kind)"
}

resolve_exposure_mode() {
  local mode="${1:-interactive}" saved=""
  if [[ -n "${PIXELVERSE_EXPOSURE_MODE:-}" ]]; then
    normalize_exposure_mode "$PIXELVERSE_EXPOSURE_MODE"
    return 0
  fi
  if [[ "$mode" == "reuse" ]]; then
    saved="$(saved_env_value PIXELVERSE_EXPOSURE_MODE || true)"
    if [[ -n "$saved" ]]; then
      normalize_exposure_mode "$saved"
      return 0
    fi
  fi
  normalize_exposure_mode "$(select_exposure_mode)"
}

select_adapter_target() {
  local requested="${1:-}"
  if [[ -n "$requested" ]]; then
    if [[ "$requested" == "all" ]]; then
      printf 'all\n'
      return 0
    fi
    case "$requested" in
      gemini) requested="gemini-cli" ;;
      claude) requested="claude-code" ;;
      antugravity) requested="antigravity" ;;
    esac
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
  local exposure_mode="${2:-${PIXELVERSE_EXPOSURE_MODE:-localhost}}"
  local tailscale_public_url="${PIXELVERSE_TAILSCALE_URL:-}"
  local hermes_repo_host="${PIXELVERSE_HERMES_REPO_HOST:-}"
  if [[ -z "$hermes_repo_host" && -n "${PIXELVERSE_HERMES_ROOT:-}" ]]; then
    hermes_repo_host="${PIXELVERSE_HERMES_ROOT%/}/hermes-agent"
  fi
  if [[ -z "$hermes_repo_host" ]]; then
    hermes_repo_host="$STATE_DIR/hermes-agent-placeholder"
  fi
  mkdir -p "$hermes_repo_host"
  ensure_platform_env
  if [[ -z "$tailscale_public_url" ]]; then
    tailscale_public_url="$(tailscale_url 2>/dev/null || true)"
    tailscale_public_url="${tailscale_public_url%/}"
  fi
  cat > "$ENV_FILE" <<EOF
PIXELVERSE_AGENT_KIND=$agent_kind
PIXELVERSE_DOCKER_PLATFORM=$PIXELVERSE_DOCKER_PLATFORM
PIXELVERSE_PORT=$PIXELVERSE_PORT
PIXELVERSE_PUBLIC_PORT=$PIXELVERSE_PORT
PIXELVERSE_BRIDGE_PORT=$BRIDGE_PORT
PIXELVERSE_AGENT_ID=${PIXELVERSE_AGENT_ID:-henry-main}
PIXELVERSE_AGENT_NAME=${PIXELVERSE_AGENT_NAME:-Henry}
PIXELVERSE_AGENT_COLOR=${PIXELVERSE_AGENT_COLOR:-#8b5cf6}
PIXELVERSE_BRIDGE_AGENT_ID=${PIXELVERSE_BRIDGE_AGENT_ID:-henry-main}
PIXELVERSE_BRIDGE_AGENT_NAME=${PIXELVERSE_BRIDGE_AGENT_NAME:-Henry}
PIXELVERSE_BRIDGE_AGENT_COLOR=${PIXELVERSE_BRIDGE_AGENT_COLOR:-#8b5cf6}
PIXELVERSE_NOTIFY_TO=${PIXELVERSE_NOTIFY_TO:-henry.cos.allen@gmail.com}
PIXELVERSE_NOTIFY_CMD=${PIXELVERSE_NOTIFY_CMD:-henry-notify}
PIXELVERSE_HERMES_ENABLE=${PIXELVERSE_HERMES_ENABLE:-auto}
PIXELVERSE_HERMES_WEB_BASE=${PIXELVERSE_HERMES_WEB_BASE:-http://host.docker.internal:9119}
PIXELVERSE_HERMES_GATEWAY_HEALTH=${PIXELVERSE_HERMES_GATEWAY_HEALTH:-http://host.docker.internal:8642/health/detailed}
PIXELVERSE_HERMES_REPO_HOST=$hermes_repo_host
PIXELVERSE_RUNTIME_DIR_HOST=${PIXELVERSE_RUNTIME_DIR_HOST:-$RUNTIME_DIR}
PIXELVERSE_OLLAMA_BASE=${PIXELVERSE_OLLAMA_BASE:-http://host.docker.internal:11434}
PIXELVERSE_TAILSCALE_ENABLE=$PIXELVERSE_TAILSCALE_ENABLE
PIXELVERSE_TAILSCALE_PORT=$PIXELVERSE_TAILSCALE_PORT
PIXELVERSE_TAILSCALE_URL=$tailscale_public_url
PIXELVERSE_NGROK_URL=${PIXELVERSE_NGROK_URL:-}
PIXELVERSE_EXPOSURE_MODE=$exposure_mode
PIXELVERSE_GLOBAL_MAP_DIR_HOST=${PIXELVERSE_GLOBAL_MAP_DIR_HOST:-./tmp/global_map}
EOF
}

floorplan_output_dir_host() {
  printf '%s\n' "${PIXELVERSE_GLOBAL_MAP_DIR_HOST:-./tmp/global_map}"
}

floorplan_output_dir_abs() {
  local output_dir
  output_dir="$(floorplan_output_dir_host)"
  case "$output_dir" in
    /*) printf '%s\n' "$output_dir" ;;
    ./*) printf '%s/%s\n' "$ROOT" "${output_dir#./}" ;;
    *) printf '%s/%s\n' "$ROOT" "$output_dir" ;;
  esac
}

list_floorplan_keys() {
  local yaml png key
  for yaml in "$ROOT"/global_map/*.yaml; do
    [[ -f "$yaml" ]] || continue
    key="$(basename "$yaml" .yaml)"
    png="$ROOT/global_map/$key.png"
    [[ -f "$png" ]] || continue
    printf '%s\n' "$key"
  done | sort
}

floorplans_command() {
  local key count=0
  echo "Available CLI_Pixelverse floorplans:"
  while IFS= read -r key; do
    [[ -n "$key" ]] || continue
    count=$((count + 1))
    printf '  %s\n' "$key"
  done < <(list_floorplan_keys)
  if [[ "$count" -eq 0 ]]; then
    echo "  (none)"
    echo "No complete global_map/*.yaml + *.png floorplan pairs were found." >&2
    return 1
  fi
}

validate_floorplan_key() {
  local key="$1"
  case "$key" in
    ""|*/*|*..*|*[!A-Za-z0-9_.-]*)
      printf 'Invalid PIXELVERSE_FLOORPLAN: %q\n' "$key" >&2
      echo "Use a basename from ./run.sh floorplans, for example: default" >&2
      return 2
      ;;
  esac
}

select_floorplan_key() {
  local mode="${1:-interactive}"
  local requested="${PIXELVERSE_FLOORPLAN:-}"
  local keys=()
  local key index choice
  mapfile -t keys < <(list_floorplan_keys)
  if [[ "${#keys[@]}" -eq 0 ]]; then
    echo "No complete global_map/*.yaml + *.png floorplan pairs were found." >&2
    return 1
  fi

  if [[ -n "$requested" ]]; then
    validate_floorplan_key "$requested"
    for key in "${keys[@]}"; do
      if [[ "$key" == "$requested" ]]; then
        printf '%s\n' "$requested"
        return 0
      fi
    done
    printf 'Unknown PIXELVERSE_FLOORPLAN: %q\n' "$requested" >&2
    echo "Available floorplans:" >&2
    printf '  %s\n' "${keys[@]}" >&2
    return 2
  fi

  if [[ "$mode" == "reuse" || ! -t 0 ]]; then
    if printf '%s\n' "${keys[@]}" | grep -qx 'default'; then
      printf 'default\n'
    else
      printf '%s\n' "${keys[0]}"
    fi
    return 0
  fi

  echo "Select visual floorplan from CLI_Pixelverse/global_map/:" >&2
  select choice in "${keys[@]}"; do
    if [[ -n "$choice" ]]; then
      printf '%s\n' "$choice"
      return 0
    fi
    echo "Invalid floorplan selection." >&2
  done
}

prepare_floorplan() {
  local mode="${1:-interactive}"
  local selected source_yaml source_png output_dir
  output_dir="$(floorplan_output_dir_abs)"
  if [[ -z "${PIXELVERSE_FLOORPLAN:-}" && ( "$mode" == "reuse" || ! -t 0 ) && -f "$output_dir/default.yaml" && -f "$output_dir/default.png" ]]; then
    PIXELVERSE_GLOBAL_MAP_DIR_HOST="$(floorplan_output_dir_host)"
    export PIXELVERSE_GLOBAL_MAP_DIR_HOST
    echo "Using existing floorplan override: $output_dir/default.yaml + $output_dir/default.png"
    return 0
  fi

  selected="$(select_floorplan_key "$mode")"
  source_yaml="$ROOT/global_map/$selected.yaml"
  source_png="$ROOT/global_map/$selected.png"
  if [[ ! -f "$source_yaml" || ! -f "$source_png" ]]; then
    echo "Floorplan '$selected' must have both YAML and PNG:" >&2
    echo "- $source_yaml" >&2
    echo "- $source_png" >&2
    return 2
  fi

  PIXELVERSE_GLOBAL_MAP_DIR_HOST="$(floorplan_output_dir_host)"
  export PIXELVERSE_GLOBAL_MAP_DIR_HOST
  mkdir -p "$output_dir"
  cp "$source_yaml" "$output_dir/default.yaml"
  cp "$source_png" "$output_dir/default.png"
  echo "Selected floorplan: $selected"
  echo "- YAML: $source_yaml -> $output_dir/default.yaml"
  echo "- PNG:  $source_png -> $output_dir/default.png"
}

map_builder_command() {
  local host_url="http://localhost:${PIXELVERSE_PORT}/map_builder.html"
  cat <<EOF
CLI_Pixelverse PNG/YAML map builder:
- URL: $host_url

Start or refresh the service first:
  PIXELVERSE_AGENT_KIND=codex ./run.sh down_up

Builder workflow:
  1. Open $host_url
  2. Load a PNG floorplan.
  3. Draw rooms, corridors, doors, and furniture on top of the PNG.
  4. Export YAML.
  5. Save the exported YAML to tmp/global_map/default.yaml.
  6. Put the matching PNG at tmp/global_map/default.png.

Validate before restart:
  python3 scripts/check_global_map_alignment.py \\
    --yaml tmp/global_map/default.yaml \\
    --png tmp/global_map/default.png

Then restart with the runtime override:
  ./run.sh down_up
EOF
}

agent_command_name() {
  case "$1" in
    codex) printf 'codex\n' ;;
    gemini-cli) printf 'gemini\n' ;;
    claude-code) printf 'claude\n' ;;
    antigravity) printf 'antigravity\n' ;;
    ollama) printf 'ollama\n' ;;
    hermes) printf 'hermes\n' ;;
    generic) printf 'generic\n' ;;
  esac
}

agent_display_name() {
  case "$1" in
    codex) printf 'Codex CLI\n' ;;
    gemini-cli) printf 'Gemini CLI\n' ;;
    claude-code) printf 'Claude Code\n' ;;
    antigravity) printf 'Antigravity\n' ;;
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
    antigravity) printf '#7c3aed\n' ;;
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
    antigravity) printf 'ANTIGRAVITY\n' ;;
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
    antigravity)
      [[ -d "$HOME/.antigravity" ]] && echo "- config: $HOME/.antigravity" || echo "- config: $HOME/.antigravity not found"
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

docker_image_is_stale() {
  local built_revision built_fingerprint
  built_revision="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' cli-pixelverse:local 2>/dev/null || true)"
  built_fingerprint="$(docker image inspect -f '{{index .Config.Labels "io.pixelverse.build-fingerprint"}}' cli-pixelverse:local 2>/dev/null || true)"
  [[ -n "$built_revision" && "$built_revision" == "$PIXELVERSE_BUILD_REVISION" ]] || return 0
  [[ -n "$built_fingerprint" && "$built_fingerprint" == "$PIXELVERSE_BUILD_FINGERPRINT" ]] || return 0
  return 1
}

prepare_docker_build_metadata() {
  PIXELVERSE_BUILD_REVISION="$(python3 "$ROOT/scripts/docker_build_metadata.py" revision)"
  PIXELVERSE_BUILD_FINGERPRINT="$(python3 "$ROOT/scripts/docker_build_metadata.py" fingerprint \
    --prepared-metadata "$ROOT/pixelworld_mvp/public/assets/private/modern-office-v1.2/.prepared-assets.json")"
  export PIXELVERSE_BUILD_REVISION PIXELVERSE_BUILD_FINGERPRINT
}

start_service() {
  local mode="${1:-interactive}"
  local agent_kind exposure_mode agent_command
  if [[ "$mode" == "interactive" ]]; then
    echo "Select agent source for Pixelverse. Use arrow keys + Enter, or set PIXELVERSE_AGENT_KIND=codex/gemini-cli/claude-code/antigravity/ollama/hermes/generic." >&2
  fi
  agent_kind="$(resolve_agent_kind "$mode")"
  validate_agent_kind "$agent_kind"
  exposure_mode="$(resolve_exposure_mode "$mode")"
  if [[ "$exposure_mode" != "tailscale" && -z "${PIXELVERSE_TAILSCALE_ENABLE_SET:-}" ]]; then
    PIXELVERSE_TAILSCALE_ENABLE=0
  fi
  prepare_floorplan "$mode"
  write_env_file "$agent_kind" "$exposure_mode"
  install_agent_adapter "$agent_kind" "$ROOT" optional
  if [[ "$agent_kind" != "generic" && "${PIXELVERSE_AUTO_ENABLE_SHELL_ADAPTER:-1}" != "0" ]]; then
    enable_shell_adapter
  fi
  agent_command="$(agent_command_name "$agent_kind")"

  provision_modern_office_assets
  prepare_docker_build_metadata
  stop_legacy_local_processes
  echo "Starting CLI_Pixelverse Docker service for $agent_kind..."
  if [[ "${PIXELVERSE_REBUILD:-0}" == "1" ]] || docker_image_is_stale; then
    echo "Rebuilding Docker image because workspace sources changed or PIXELVERSE_REBUILD=1."
    compose up -d --build
  elif docker image inspect cli-pixelverse:local >/dev/null 2>&1; then
    echo "Using existing Docker image cli-pixelverse:local. Set PIXELVERSE_REBUILD=1 to rebuild."
    compose up -d --no-build
  else
    echo "Docker image cli-pixelverse:local not found; building it once."
    compose up -d --build
  fi
  wait_for_openapi || doctor_service
  if [[ "$exposure_mode" == "tailscale" ]]; then
    ensure_tailscale_exposure
    write_env_file "$agent_kind" "$exposure_mode"
  fi

  cat <<EOF
CLI_Pixelverse Docker service started
- Agent source: $agent_kind
- UI:          http://localhost:${PIXELVERSE_PORT}
- Swagger API: http://localhost:${PIXELVERSE_PORT}/docs
- OpenAPI:     http://localhost:${PIXELVERSE_PORT}/openapi.json
- World API:   http://localhost:${PIXELVERSE_PORT}/api/world
- Bridge hook: http://localhost:${BRIDGE_PORT}/hook
- UI exposure: $exposure_mode
EOF
  print_tailscale_status
  if [[ -n "${PIXELVERSE_NGROK_URL:-}" ]]; then
    echo "- ngrok:       ${PIXELVERSE_NGROK_URL%/}/"
  fi
  cat <<EOF

Minimal event test:
  curl -X POST http://localhost:${PIXELVERSE_PORT}/api/event \\
    -H 'Content-Type: application/json' \\
    -d '{"agent_type":"$agent_kind","agent":"$agent_kind-main","event":"tool.started","tool_name":"terminal","message":"running a command"}'

Attach native CLI commands in this shell:
  source "$STATE_DIR/activate.sh"
  $agent_command
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
  if [[ -n "${PIXELVERSE_NGROK_URL:-}" ]]; then
    echo "- ngrok:       ${PIXELVERSE_NGROK_URL%/}/"
  fi
}

doctor_service() {
  if [[ ! -f "$ENV_FILE" ]]; then
    write_env_file "${PIXELVERSE_AGENT_KIND:-generic}"
  fi

  echo "CLI_Pixelverse Doctor"
  echo "== Config =="
  echo "- Root: $ROOT"
  echo "- Compose project: $COMPOSE_PROJECT_NAME"
  echo "- Env file: $ENV_FILE"
  sed -n '1,80p' "$ENV_FILE" 2>/dev/null || true
  local configured_agent hermes_enabled
  configured_agent="$(sed -n 's/^PIXELVERSE_AGENT_KIND=//p' "$ENV_FILE" 2>/dev/null | tail -1)"
  hermes_enabled="$(sed -n 's/^PIXELVERSE_HERMES_ENABLE=//p' "$ENV_FILE" 2>/dev/null | tail -1)"
  if [[ "${hermes_enabled:-auto}" == "0" ]]; then
    echo
    echo "!! Hermes source warning:"
    echo "   Current PIXELVERSE_HERMES_ENABLE=0. Hermes gateway/session polling is disabled."
    echo "   Fix: PIXELVERSE_HERMES_ENABLE=auto ./run.sh down_up"
  else
    echo "- Hermes source polling: ${hermes_enabled:-auto} (independent of PIXELVERSE_AGENT_KIND=${configured_agent:-unknown})"
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
  docker ps -a --filter name=cli-pixelverse --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true

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
  cp "$ROOT/hooks/pixelverse/HOOK.yaml" "$target/HOOK.yaml"
  cp "$ROOT/hooks/pixelverse/handler.py" "$target/handler.py"
  echo "Installed Pixelverse Hermes hook:"
  echo "- $target/HOOK.yaml"
  echo "- $target/handler.py"
  echo
  echo "Restart Hermes gateway/OpenWebUI bootstrap so gateway.hooks reloads this hook:"
  echo "  ~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/run.sh restart"
  echo
  echo "The hook posts Hermes agent lifecycle events to:"
  echo "  ${PIXELVERSE_BRIDGE_URL:-http://localhost:${BRIDGE_PORT}}/hook"
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
  local display_name="$5"
  local color="$6"
  local fallback_command="${7:-}"
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
  --name "$display_name" \\
  --color "$color" \\
  -- "\$ORIG" "\$@"
EOF
  chmod +x "$shim"
}

install_cli_adapter_for_kind() {
  local kind="$1"
  local command_name display_name color env_prefix bin_dir fallback_command
  command_name="$(agent_command_name "$kind")"
  display_name="$(agent_display_name "$kind")"
  color="$(agent_color "$kind")"
  env_prefix="$(agent_env_prefix "$kind")"
  bin_dir="$STATE_DIR/bin"
  fallback_command="$(discover_agent_command "$kind" || true)"
  write_cli_shim "$kind" "$command_name" "$command_name" "$env_prefix" "$display_name" "$color" "$fallback_command"
  write_cli_shim "$kind" "pixelverse-$command_name" "$command_name" "$env_prefix" "$display_name" "$color" "$fallback_command"
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

write_codex_hooks_json() {
  local target="$1"
  local hook_script="$ROOT/scripts/codex_pixelverse_hook.py"
  cat > "$target" <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5,
            "statusMessage": "Syncing Pixelverse session"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5,
            "statusMessage": "Syncing Pixelverse tool call"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 \\"$hook_script\\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
EOF
}

install_codex_project_hooks() {
  local project_root="${1:-${PIXELVERSE_CODEX_PROJECT_ROOT:-$PWD}}"
  local hook_script="$ROOT/scripts/codex_pixelverse_hook.py"
  local installer="$ROOT/scripts/codex_hook_installer.py"
  if ! /usr/bin/env python3 "$installer" "$project_root" "$hook_script"; then
    return 1
  fi
  echo
  echo "Inside the first Codex session, run /hooks and trust the project hook definition."
}

write_adapter_activation() {
  local bin_dir="$STATE_DIR/bin"
  local activation="$STATE_DIR/activate.sh"
  mkdir -p "$STATE_DIR"
cat > "$activation" <<EOF
# Source this file to make native agent CLI commands observable by Pixelverse.
# It prepends local shim commands only; it does not modify or overwrite the original CLIs.
case "\${PIXELVERSE_URL:-}" in
  ""|"http://127.0.0.1:4321"|"http://localhost:4321")
    export PIXELVERSE_URL="http://127.0.0.1:${PIXELVERSE_PORT}"
    ;;
esac
case "\${PIXELVERSE_BRIDGE_URL:-}" in
  ""|"http://127.0.0.1:4567"|"http://localhost:4567")
    export PIXELVERSE_BRIDGE_URL="http://127.0.0.1:${BRIDGE_PORT}"
    ;;
esac
export PIXELVERSE_STATE_DIR="${STATE_DIR}"
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
  local codex_project_root="${2:-${PIXELVERSE_CODEX_PROJECT_ROOT:-$PWD}}"
  local hook_policy="${3:-required}"
  case "$target" in
    gemini) target="gemini-cli" ;;
    claude) target="claude-code" ;;
    antugravity) target="antigravity" ;;
  esac
  case "$target" in
    hermes-cli) target="hermes" ;;
    codex|gemini-cli|claude-code|antigravity|ollama|hermes|generic|hermes-hook|hermes-plugin|all) ;;
    *)
      echo "Unknown adapter target: $target" >&2
      echo "Use one of: codex, gemini-cli, claude-code, antigravity, ollama, hermes, generic, hermes-hook, hermes-plugin, all" >&2
      exit 2
      ;;
  esac

  if [[ "$target" == "all" ]]; then
    for kind in codex gemini-cli claude-code antigravity ollama hermes; do
      install_cli_adapter_for_kind "$kind"
    done
    install_codex_project_hooks
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

  if [[ "$target" == "generic" ]]; then
    echo "Generic agents use the universal HTTP client; no shell command shim is installed."
    echo "Example:"
    echo "  python3 -m agent_bridges.pixelverse_client start --agent-type generic --agent generic-main --name Generic"
    write_adapter_activation
    return 0
  fi

  install_cli_adapter_for_kind "$target"
  if [[ "$target" == "codex" ]]; then
    if ! install_codex_project_hooks "$codex_project_root"; then
      if [[ "$hook_policy" == "optional" ]]; then
        echo "Warning: Continuing without project-local Codex hooks; the CLI adapter is still available." >&2
      else
        return 1
      fi
    fi
  fi
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

enable_shell_adapter() {
  local bashrc="${HOME}/.bashrc"
  local activation="$STATE_DIR/activate.sh"
  local marker="# cli-pixelverse shell adapter"
  local source_line="[ -f \"$activation\" ] && source \"$activation\""
  write_adapter_activation
  touch "$bashrc"
  if grep -Fq "$marker" "$bashrc"; then
    echo "Pixelverse shell adapter is already enabled in $bashrc"
    return 0
  fi
  {
    echo
    echo "$marker"
    echo "$source_line"
  } >> "$bashrc"
  echo "Enabled Pixelverse CLI interception for new Bash terminals:"
  echo "- $bashrc"
  echo "- $source_line"
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
  for shim in codex gemini claude antigravity ollama hermes; do
    [[ -x "$bin_dir/$shim" ]] && echo "$shim shim: $bin_dir/$shim" || echo "$shim shim: not installed"
  done
  echo
  echo "== Current Shell CLI Resolution =="
  for shim in codex gemini claude antigravity ollama hermes; do
    local resolved
    resolved="$(command -v "$shim" 2>/dev/null || true)"
    if [[ "$resolved" == "$bin_dir/$shim" ]]; then
      echo "$shim: attached through Pixelverse shim"
    elif [[ -n "$resolved" ]]; then
      echo "$shim: native CLI ($resolved); run: source \"$STATE_DIR/activate.sh\""
    else
      echo "$shim: command not found"
    fi
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
  local target_room="${1:-}"
  local output
  local -a renderer_cmd=(python3 "$ROOT/scripts/render_local_ui_trajectory.py")
  if ! python3 -c 'import PIL' >/dev/null 2>&1 && command -v uv >/dev/null 2>&1; then
    renderer_cmd=(uv run --with Pillow python "$ROOT/scripts/render_local_ui_trajectory.py")
  fi
  if [[ -n "$target_room" ]]; then
    renderer_cmd+=(--require-hook-evidence "$target_room")
  fi
  if output="$("${renderer_cmd[@]}" 2>&1)"; then
    echo "Trajectory image: $output"
  else
    echo "Failed to render or validate trajectory evidence:" >&2
    echo "$output" >&2
    return 1
  fi
}

capture_world_snapshot() {
  local snapshot_url="http://127.0.0.1:${PIXELVERSE_PORT}/api/world"
  local output="$ROOT/tmp/latest_world_snapshot.json"
  local connect_timeout="${PIXELVERSE_TEST_HOOK_CONNECT_TIMEOUT:-2}"
  local max_time="${PIXELVERSE_TEST_HOOK_MAX_TIME:-10}"
  if curl -fsS --connect-timeout "$connect_timeout" --max-time "$max_time" "$snapshot_url" > "$output"; then
    return 0
  fi
  timeout "${max_time}s" docker exec cli-pixelverse \
    curl -fsS --connect-timeout "$connect_timeout" --max-time "$max_time" "$snapshot_url" > "$output"
}

world_snapshot_has_route_evidence() {
  local agent_id="$1"
  local from_room="$2"
  local to_room="$3"
  local minimum_event_id="$4"
  python3 -c '
import json, math, sys

snapshot_path, agent_id, from_room, to_room, minimum_event_id = sys.argv[1:]
with open(snapshot_path, encoding="utf-8") as handle:
    snapshot = json.load(handle)

def matches(event):
    payload = event.get("payload") or {}
    if payload.get("agent") != agent_id:
        return False
    evidence = payload.get("route_evidence") or (payload.get("action") or {}).get("route_evidence") or {}
    start = evidence.get("from_position") or {}
    end = evidence.get("to_position") or {}
    displacement = math.dist((start.get("x", 0), start.get("y", 0)), (end.get("x", 0), end.get("y", 0)))
    return (
        int(evidence.get("event_id") or 0) >= int(minimum_event_id)
        and evidence.get("from_room") == from_room
        and evidence.get("to_room") == to_room
        and evidence.get("position_changed") is True
        and displacement > 0
    )

raise SystemExit(0 if any(matches(event) for event in snapshot.get("events", [])) else 1)
' "$ROOT/tmp/latest_world_snapshot.json" "$agent_id" "$from_room" "$to_room" "$minimum_event_id"
}

wait_for_route_evidence() {
  local agent_id="$1"
  local from_room="$2"
  local to_room="$3"
  local minimum_event_id="$4"
  local timeout_seconds="${PIXELVERSE_TEST_HOOK_EVIDENCE_TIMEOUT:-15}"
  local interval_seconds="${PIXELVERSE_TEST_HOOK_EVIDENCE_INTERVAL:-0.25}"
  local deadline
  deadline="$(python3 -c 'import sys, time; print(time.monotonic() + float(sys.argv[1]))' "$timeout_seconds")"

  while true; do
    if ! capture_world_snapshot; then
      echo "Transport error while waiting for current main-agent route evidence: ${from_room} -> ${to_room}" >&2
      return 1
    fi
    if world_snapshot_has_route_evidence "$agent_id" "$from_room" "$to_room" "$minimum_event_id"; then
      return 0
    fi
    if ! python3 -c 'import sys, time; raise SystemExit(0 if time.monotonic() < float(sys.argv[1]) else 1)' "$deadline"; then
      echo "Timed out waiting for current main-agent route evidence: ${from_room} -> ${to_room}" >&2
      return 1
    fi
    sleep "$interval_seconds"
  done
}

post_json() {
  local url="$1"
  local payload="$2"
  local connect_timeout="${PIXELVERSE_TEST_HOOK_CONNECT_TIMEOUT:-2}"
  local max_time="${PIXELVERSE_TEST_HOOK_MAX_TIME:-10}"
  if curl -fsS --connect-timeout "$connect_timeout" --max-time "$max_time" -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null; then
    return 0
  fi
  timeout "${max_time}s" docker exec cli-pixelverse \
    curl -fsS --connect-timeout "$connect_timeout" --max-time "$max_time" -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null
}

test_hook() {
  local bridge_url="${PIXELVERSE_BRIDGE_URL:-http://127.0.0.1:${BRIDGE_PORT}}"
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
  if ! capture_world_snapshot; then
    echo "Unable to capture the pre-run world event sequence." >&2
    return 1
  fi
  local baseline_event_id
  baseline_event_id="$(python3 -c 'import json, sys; data=json.load(open(sys.argv[1], encoding="utf-8")); print(max((int(item.get("id") or 0) for item in data.get("events", [])), default=0))' "$ROOT/tmp/latest_world_snapshot.json")"
  local minimum_event_id=$((baseline_event_id + 1))
  local agents_json
  if [[ "$target_room" == "clone_bay" ]]; then
    agents_json=",\"agents\":[{\"agent\":\"henry-main\",\"name\":\"Henry\",\"role\":\"main_agent\",\"start_room\":\"think_lab\",\"target_room\":\"clone_bay\",\"return_room\":\"standby_dock\",\"state\":\"working\",\"tool_csv\":\"delegate_task\"},{\"agent\":\"synthetic-subagent-1\",\"name\":\"Test Subagent\",\"role\":\"subagent\",\"start_room\":\"clone_bay\",\"target_room\":\"tool_forge\",\"return_room\":\"clone_bay\",\"state\":\"working\",\"tool_csv\":\"patch,terminal\"}]"
  else
    agents_json=",\"agents\":[{\"agent\":\"henry-main\",\"name\":\"Henry\",\"role\":\"main_agent\",\"start_room\":\"think_lab\",\"target_room\":\"${target_room}\",\"return_room\":\"standby_dock\",\"state\":\"working\",\"tool_csv\":\"${tool_csv}\"}]"
  fi
  printf '{"target_room":"%s","tool_csv":"%s","label":"%s","start_room":"think_lab","return_room":"standby_dock","created_at":"%s","minimum_event_id":%s,"event_sequence":["main:start","main:step","subagent:step-if-clone","subagent:end-if-clone","main:end"]%s}\n' \
    "$target_room" "$tool_csv" "$label" "$(date -Iseconds)" "$minimum_event_id" "$agents_json" > "$ROOT/tmp/latest_test_hook_route.json"

  local start_json="{\"event\":\"agent:start\",\"context\":{\"message\":\"Pixelverse random route test started\",\"target_room\":\"think_lab\"}}"
  local step_json="{\"event\":\"agent:step\",\"context\":{\"tool_names\":${tools_json},\"target_room\":\"${target_room}\"}}"
  local end_json="{\"event\":\"agent:end\",\"context\":{\"response\":\"Synthetic hook test completed: ${label}.\"}}"

  if ! post_json "$bridge_url/hook" "$start_json"; then
    echo "Unable to deliver synthetic hook start event to the bridge or service container." >&2
    return 1
  fi
  sleep "$delay"
  if ! post_json "$bridge_url/hook" "$step_json"; then
    echo "Unable to deliver synthetic hook step event." >&2
    return 1
  fi
  if [[ "$target_room" == "clone_bay" ]]; then
    if ! post_json "http://127.0.0.1:${PIXELVERSE_PORT}/api/event" \
      '{"agent_type":"hermes","agent":"synthetic-subagent-1","name":"Test Subagent","role":"subagent","event":"subagent.started","state":"working","target_room":"clone_bay","message":"Synthetic subagent spawned in clone bay.","color":"#a78bfa"}'; then
      echo "Unable to deliver synthetic subagent start event." >&2
      return 1
    fi
    sleep "$delay"
    if ! post_json "http://127.0.0.1:${PIXELVERSE_PORT}/api/event" \
      '{"agent_type":"hermes","agent":"synthetic-subagent-1","name":"Test Subagent","role":"subagent","event":"tool.started","tool_names":["patch","terminal"],"target_room":"tool_forge","message":"Synthetic subagent is patching from delegated task.","color":"#a78bfa"}'; then
      echo "Unable to deliver synthetic subagent tool event." >&2
      return 1
    fi
  fi
  sleep "$delay"
  if [[ "$target_room" == "clone_bay" ]]; then
    if ! post_json "http://127.0.0.1:${PIXELVERSE_PORT}/api/event" \
      '{"agent_type":"hermes","agent":"synthetic-subagent-1","name":"Test Subagent","role":"subagent","event":"completed","state":"idle","target_room":"clone_bay","message":"Synthetic subagent completed delegated patch work.","color":"#a78bfa"}'; then
      echo "Unable to deliver synthetic subagent completion event." >&2
      return 1
    fi
  fi
  if ! post_json "$bridge_url/hook" "$end_json"; then
    echo "Unable to deliver synthetic hook completion event." >&2
    return 1
  fi
  if ! wait_for_route_evidence "henry-main" "$target_room" "standby_dock" "$minimum_event_id"; then
    return 1
  fi
  render_latest_trajectory "$target_room"
  echo "Hook movement evidence accepted: ${target_room} route and coordinate checks passed."
  echo "Synthetic hook sequence sent. Check UI or /api/world events."
}

smoke_furniture_drag() {
  local base_url="${PIXELVERSE_SMOKE_BASE_URL:-http://127.0.0.1:${PIXELVERSE_PORT}}"
  local -a cmd=(uv run --with playwright python "$ROOT/scripts/furniture_drag_browser_smoke.py" --base-url "$base_url")
  if [[ "${PIXELVERSE_SMOKE_HEADED:-0}" == "1" ]]; then
    cmd+=(--headed)
  fi
  if [[ -n "${PIXELVERSE_SMOKE_SLOW_MO_MS:-}" ]]; then
    cmd+=(--slow-mo-ms "$PIXELVERSE_SMOKE_SLOW_MO_MS")
  fi
  if [[ -n "${PIXELVERSE_SMOKE_SOURCE_ROOM:-}" ]]; then
    cmd+=(--source-room "$PIXELVERSE_SMOKE_SOURCE_ROOM")
  fi
  if [[ -n "${PIXELVERSE_SMOKE_TARGET_ROOM:-}" ]]; then
    cmd+=(--target-room "$PIXELVERSE_SMOKE_TARGET_ROOM")
  fi
  echo "Running furniture drag browser smoke against $base_url ..."
  "${cmd[@]}"
}

if [[ "${PIXELVERSE_SOURCE_ONLY:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

case "$COMMAND" in
  start)
    start_service interactive
    ;;
  stop|down)
    stop_service
    ;;
  restart|down_up)
    stop_service
    start_service reuse
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
  assets-status)
    python3 "$ROOT/scripts/provision_modern_office_assets.py" --status
    ;;
  platform)
    platform_command
    ;;
  bridge-status)
    bridge_status
    ;;
  floorplans)
    floorplans_command
    ;;
  prepare-floorplan)
    prepare_floorplan
    ;;
  map-builder)
    map_builder_command
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
  install-codex-hook)
    install_codex_project_hooks "${2:-$PWD}"
    ;;
  enable-shell-adapter)
    enable_shell_adapter
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
  smoke-furniture-drag)
    smoke_furniture_drag
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

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

usage() {
  cat <<'EOF'
Usage: hook_bridge.sh [--target PROJECT_DIR] [--agent KIND] [--launch]

Bind an Agent project to CLI_Pixelverse.

Options:
  --target DIR   Agent project directory. Default: current directory.
  --agent KIND   codex, gemini-cli, claude-code, antigravity, ollama,
                 hermes, or generic. Default: codex.
  --launch       Start the observable Agent CLI after binding.
  -h, --help     Show this help.

Examples:
  /path/to/CLI_Pixelverse/hook_bridge.sh --agent codex
  /path/to/CLI_Pixelverse/hook_bridge.sh --target /home/user/my-project --agent codex
  /path/to/CLI_Pixelverse/hook_bridge.sh --agent codex --launch
EOF
}

usage_error() {
  echo "$1" >&2
  echo "Run '$0 --help' for usage." >&2
  exit 2
}

target="$PWD"
agent="codex"
launch=0

while (($#)); do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || usage_error "--target requires a directory"
      target="$2"
      shift 2
      ;;
    --agent)
      [[ $# -ge 2 ]] || usage_error "--agent requires a value"
      agent="$2"
      shift 2
      ;;
    --launch)
      launch=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage_error "Unknown option: $1"
      ;;
  esac
done

case "$agent" in
  gemini) agent="gemini-cli" ;;
  claude) agent="claude-code" ;;
esac

case "$agent" in
  codex|gemini-cli|claude-code|antigravity|ollama|hermes|generic) ;;
  *) usage_error "Unsupported Agent kind: $agent" ;;
esac

if [[ ! -d "$target" ]]; then
  usage_error "Target project directory does not exist: $target"
fi
if ! target="$(cd -- "$target" && pwd -P)"; then
  usage_error "Target project directory is not accessible: $target"
fi

"$ROOT/run.sh" install-adapter "$agent" "$target"

echo
echo "Pixelverse project binding complete."
echo "Bound project: $target"
echo "Agent kind: $agent"

if [[ "$launch" != "1" ]]; then
  echo
  echo "Next steps:"
  echo "  1. Start Pixelverse: cd \"$ROOT\" && ./run.sh --start"
  echo "  2. Start the Agent now: \"$ROOT/hook_bridge.sh\" --target \"$target\" --agent \"$agent\" --launch"
  exit 0
fi

case "$agent" in
  codex) wrapper="pixelverse-codex" ;;
  gemini-cli) wrapper="pixelverse-gemini" ;;
  claude-code) wrapper="pixelverse-claude" ;;
  antigravity) wrapper="pixelverse-antigravity" ;;
  ollama) wrapper="pixelverse-ollama" ;;
  hermes) wrapper="pixelverse-hermes" ;;
  generic) usage_error "--launch is unavailable for generic agents; use the universal HTTP client." ;;
esac

wrapper_path="$ROOT/.pixelverse-service/bin/$wrapper"
if [[ ! -x "$wrapper_path" ]]; then
  echo "Observable Agent launcher was not created: $wrapper_path" >&2
  exit 1
fi

activation_file="$ROOT/.pixelverse-service/activate.sh"
if [[ -f "$activation_file" ]]; then
  # Load the service ports written by run.sh while preserving explicit custom URLs.
  source "$activation_file"
fi

echo "Launching $agent in $target ..."
cd -- "$target"
exec "$wrapper_path"

#!/usr/bin/env bash
set -euo pipefail

PIXELVERSE_AGENT_KIND="${PIXELVERSE_AGENT_KIND:-generic}"
PIXELVERSE_HOST="${PIXELVERSE_HOST:-0.0.0.0}"
PIXELVERSE_PORT="${PIXELVERSE_PORT:-5660}"
BRIDGE_PORT="${PIXELVERSE_BRIDGE_PORT:-4567}"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

python3 -m uvicorn pixelverse_fastapi:app --host "$PIXELVERSE_HOST" --port "$PIXELVERSE_PORT" &
SERVER_PID=$!

for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:${PIXELVERSE_PORT}/openapi.json" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    wait "$SERVER_PID"
  fi
  sleep 0.25
done

case "$PIXELVERSE_AGENT_KIND" in
  hermes)
    python3 /app/bridge.py \
      --server "http://127.0.0.1:${PIXELVERSE_PORT}" \
      --agent "${PIXELVERSE_BRIDGE_AGENT_ID:-henry-main}" \
      --name "${PIXELVERSE_BRIDGE_AGENT_NAME:-Henry}" \
      --color "${PIXELVERSE_BRIDGE_AGENT_COLOR:-#8b5cf6}" \
      --port "$BRIDGE_PORT" \
      --notify-on-complete \
      --notify-to "${PIXELVERSE_NOTIFY_TO:-henry.cos.allen@gmail.com}" \
      --notify-cmd "${PIXELVERSE_NOTIFY_CMD:-henry-notify}" \
      --no-speak &
    ;;
  codex|gemini-cli|claude-code|antigravity|ollama|generic)
    python3 /app/bridge.py \
      --server "http://127.0.0.1:${PIXELVERSE_PORT}" \
      --agent "${PIXELVERSE_BRIDGE_AGENT_ID:-henry-main}" \
      --name "${PIXELVERSE_BRIDGE_AGENT_NAME:-Henry}" \
      --color "${PIXELVERSE_BRIDGE_AGENT_COLOR:-#8b5cf6}" \
      --port "$BRIDGE_PORT" \
      --no-speak \
      --relay-only &
    curl -fsS -X POST "http://127.0.0.1:${PIXELVERSE_PORT}/api/heartbeat" \
      -H 'Content-Type: application/json' \
      -d "{\"agent\":\"${PIXELVERSE_AGENT_KIND}-main\",\"name\":\"${PIXELVERSE_AGENT_KIND}\",\"state\":\"idle\",\"task\":\"${PIXELVERSE_AGENT_KIND} ready\",\"source_placeholder\":true}" >/dev/null || true
    ;;
  *)
    echo "Unknown PIXELVERSE_AGENT_KIND: $PIXELVERSE_AGENT_KIND" >&2
    exit 2
    ;;
esac

wait "$SERVER_PID"

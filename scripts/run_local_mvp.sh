#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIXELVERSE_PORT="${PIXELVERSE_PORT:-4321}"
BRIDGE_PORT="${PIXELVERSE_BRIDGE_PORT:-4567}"
AGENT_ID="${PIXELVERSE_AGENT_ID:-henry-main}"
AGENT_NAME="${PIXELVERSE_AGENT_NAME:-Henry}"
AGENT_COLOR="${PIXELVERSE_AGENT_COLOR:-#8b5cf6}"
NOTIFY_TO="${PIXELVERSE_NOTIFY_TO:-henry.cos.allen@gmail.com}"
NOTIFY_CMD="${PIXELVERSE_NOTIFY_CMD:-henry-notify}"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}
trap cleanup EXIT

python3 "$ROOT/pixelverse_server.py" &
PIXEL_PID=$!
sleep 1

python3 "$ROOT/bridge.py" \
  --server "http://localhost:${PIXELVERSE_PORT}" \
  --agent "$AGENT_ID" \
  --name "$AGENT_NAME" \
  --color "$AGENT_COLOR" \
  --port "$BRIDGE_PORT" \
  --notify-on-complete \
  --notify-to "$NOTIFY_TO" \
  --notify-cmd "$NOTIFY_CMD" \
  --no-speak &
BRIDGE_PID=$!
sleep 2

cat <<EOF
CLI_Pixelverse MVP 已啟動
- UI:            http://localhost:${PIXELVERSE_PORT}
- Pixelverse API:http://localhost:${PIXELVERSE_PORT}/api/world
- Bridge health: http://localhost:${BRIDGE_PORT}/health

試跑事件：
  curl -X POST http://localhost:${BRIDGE_PORT}/hook \
    -H 'Content-Type: application/json' \
    -d '{"event":"agent:start","context":{"message":"planning pixelverse MVP"}}'

按 Ctrl+C 停止。
EOF

wait "$PIXEL_PID" "$BRIDGE_PID"

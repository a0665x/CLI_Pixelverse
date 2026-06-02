#!/usr/bin/env python3
"""CLI_Pixelverse bridge for lifecycle, heartbeat, and message relay."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import logging
import os
import shlex
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import httpx

log = logging.getLogger("cli-pixelverse")


def env(name: str, default: str) -> str:
    return os.getenv(name, default)

DEFAULT_CONFIG = {
    "server": env("PIXELVERSE_URL", "http://localhost:4321"),
    "agent_id": env("PIXELVERSE_AGENT_ID", "hermes-1"),
    "agent_name": env("PIXELVERSE_AGENT_NAME", "Hermes Agent"),
    "agent_color": env("PIXELVERSE_AGENT_COLOR", "#CD7F32"),
    "bridge_port": int(env("PIXELVERSE_BRIDGE_PORT", "4567")),
    "hermes_webhook_url": os.getenv("HERMES_WEBHOOK_URL", ""),
    "hermes_cmd": env("PIXELVERSE_HERMES_CMD", "hermes chat -c -q"),
    "heartbeat_interval": 20,
    "speak_responses": True,
    "notify_on_complete": os.getenv("PIXELVERSE_NOTIFY_ON_COMPLETE", "0").lower() in {"1", "true", "yes", "on"},
    "notify_to": [addr.strip() for addr in os.getenv("PIXELVERSE_NOTIFY_TO", "").split(",") if addr.strip()],
    "notify_cmd": os.getenv("PIXELVERSE_NOTIFY_CMD", "henry-notify"),
}


class PixelverseClient:
    def __init__(self, server_url: str, agent_id: str, agent_name: str, agent_color: str = "#CD7F32"):
        self.server = server_url.rstrip("/")
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.agent_color = agent_color
        self.http = httpx.Client(timeout=10)

    def heartbeat(self, state: str = "idle", task: str | None = None, energy: float = 1.0):
        payload = {
            "agent": self.agent_id,
            "name": self.agent_name,
            "state": state,
            "energy": energy,
            "color": self.agent_color,
            "task": task[:60] if task else None,
        }
        try:
            resp = self.http.post(f"{self.server}/api/heartbeat", json=payload)
            resp.raise_for_status()
            return True
        except Exception as exc:
            log.warning("Heartbeat failed: %s", exc)
            return False

    def act(self, action: dict):
        try:
            resp = self.http.post(f"{self.server}/api/act", json={"agent": self.agent_id, "action": action})
            resp.raise_for_status()
        except Exception as exc:
            log.warning("Action failed: %s", exc)

    def speak(self, message: str, to: str | None = None):
        action = {"type": "speak", "message": message[:200]}
        if to:
            action["to"] = to
        self.act(action)

    def message(self, to: str, message: str):
        self.act({"type": "message", "to": to, "message": message})

    def register_webhook(self, callback_url: str):
        try:
            resp = self.http.post(f"{self.server}/api/webhook", json={"agent": self.agent_id, "url": callback_url})
            resp.raise_for_status()
            log.info("Webhook registered: %s", callback_url)
            return True
        except Exception as exc:
            log.warning("Webhook registration failed: %s", exc)
            return False

    def unregister_webhook(self):
        try:
            self.http.delete(f"{self.server}/api/webhook", params={"agent": self.agent_id})
        except Exception:
            pass

    def get_agents(self) -> list:
        try:
            resp = self.http.get(f"{self.server}/api/agents")
            return resp.json().get("agents", [])
        except Exception:
            return []

    def close(self):
        self.http.close()


class BridgeState:
    def __init__(self):
        self.current_state = "idle"
        self.current_task: str | None = None
        self.last_start_message: str | None = None
        self.last_tools: list[str] = []
        self.last_completed_response: str | None = None
        self.lock = threading.Lock()

    def update(
        self,
        state: str,
        task: str | None = None,
        *,
        start_message: str | None = None,
        tools: list[str] | None = None,
        completed_response: str | None = None,
    ):
        with self.lock:
            self.current_state = state
            self.current_task = task
            if start_message is not None:
                self.last_start_message = start_message
            if tools is not None:
                self.last_tools = list(tools)
            if completed_response is not None:
                self.last_completed_response = completed_response

    def get(self):
        with self.lock:
            return self.current_state, self.current_task

    def snapshot(self):
        with self.lock:
            return {
                "state": self.current_state,
                "task": self.current_task,
                "start_message": self.last_start_message,
                "tools": list(self.last_tools),
                "completed_response": self.last_completed_response,
            }


def relay_world_action(
    client: PixelverseClient,
    message: str,
    *,
    action_type: str = "status",
    target: str | None = None,
    meta: dict | None = None,
):
    payload = {"type": action_type, "message": message[:200]}
    if meta:
        payload.update({key: value for key, value in meta.items() if value is not None})
    if target:
        payload["to"] = target
    try:
        client.act(payload)
    except Exception as exc:
        log.debug("World action relay failed: %s", exc)


def send_completion_notification(config: dict, bridge_state: BridgeState, ctx: dict):
    recipients = [addr for addr in config.get("notify_to", []) if addr]
    if not config.get("notify_on_complete") or not recipients:
        return

    snapshot = bridge_state.snapshot()
    response = ctx.get("response", "") or snapshot.get("completed_response") or "(no response captured)"
    start_message = snapshot.get("start_message") or "(unknown start context)"
    tools = snapshot.get("tools") or []
    completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = f"[{config['agent_name']}] Pixelverse task completed"
    body_lines = [
        f"Agent: {config['agent_name']} ({config['agent_id']})",
        f"Completed at: {completed_at}",
        f"Pixelverse server: {config['server']}",
        "",
        "Start context:",
        start_message,
        "",
        "Latest visible task:",
        snapshot.get("task") or "(none)",
        "",
        "Recent tools:",
        ", ".join(tools) if tools else "(none)",
        "",
        "Final response:",
        response,
    ]
    cmd = shlex.split(config["notify_cmd"])
    for recipient in recipients:
        cmd.extend(["--to", recipient])
    cmd.extend(["--subject", subject, "--body", "\n".join(body_lines)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if result.returncode != 0:
            log.error("Completion notification failed: %s", result.stderr.strip() or result.stdout.strip())
        else:
            log.info("Completion notification sent to %s", ", ".join(recipients))
    except Exception as exc:
        log.error("Completion notification error: %s", exc)


def heartbeat_loop(client: PixelverseClient, state: BridgeState, interval: int = 20):
    log.info("Heartbeat loop started (every %ds)", interval)
    while True:
        current_state, current_task = state.get()
        client.heartbeat(state=current_state, task=current_task)
        time.sleep(interval)


def handle_incoming_message(from_agent: str, message: str, config: dict, client: PixelverseClient, bridge_state: BridgeState):
    log.info("Message from %s: %s", from_agent, message[:80])
    bridge_state.update("thinking", f"Reading message from {from_agent}", start_message=message)
    relay_world_action(client, f"收到來自 {from_agent} 的訊息，正在整理", action_type="thought")

    hermes_url = config.get("hermes_webhook_url")
    agent_id = config["agent_id"]

    if hermes_url:
        conversation_id = f"{agent_id}:{from_agent}"
        bridge_state.update("working", f"Responding to {from_agent}")
        try:
            resp = httpx.post(
                f"{hermes_url}/message",
                json={"chat_id": conversation_id, "message": message, "from": from_agent, "user_id": from_agent},
                timeout=300,
            )
            data = resp.json()
            response = data.get("response", "") or "(No response from agent)"
        except httpx.TimeoutException:
            response = "(Sorry, I took too long thinking about that!)"
            log.warning("Hermes webhook timed out for message from %s", from_agent)
        except Exception as exc:
            response = f"(Error communicating with Hermes: {exc})"
            log.error("Webhook POST failed: %s", exc)
    else:
        log.warning("No HERMES_WEBHOOK_URL set — using CLI fallback (not recommended for multi-agent)")
        hermes_input = (
            f"[Pixelverse message from agent '{from_agent}']: {message}\n\n"
            f"(You are connected through the CLI_Pixelverse world. Reply naturally.)"
        )
        cmd = config["hermes_cmd"].split() + [hermes_input]
        bridge_state.update("working", f"Responding to {from_agent}")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=os.path.expanduser("~"))
            response = result.stdout.strip() or "(I had trouble processing that, sorry!)"
        except subprocess.TimeoutExpired:
            response = "(Sorry, I took too long thinking about that!)"
        except FileNotFoundError:
            response = "(Hermes CLI not found — is it installed?)"
        except Exception as exc:
            response = f"(Error: {exc})"

    if response:
        client.message(from_agent, response[:500])
        if config.get("speak_responses"):
            client.speak(response[:200], to=from_agent)

    bridge_state.update("idle")
    relay_world_action(client, f"已回覆 {from_agent}，回到待命站", action_type="status")
    log.info("Replied to %s: %s", from_agent, response[:80])


def handle_hook_event(event: str, ctx: dict, config: dict, client: PixelverseClient, bridge_state: BridgeState):
    log.info("Hook event received: %s context_keys=%s", event or "(empty)", sorted(ctx.keys()))
    if event == "agent:start":
        start_message = (ctx.get("message", "") or "")[:60]
        target_room = ctx.get("target_room")
        bridge_state.update("thinking", start_message, start_message=ctx.get("message", ""))
        relay_world_action(
            client,
            f"正在思考：{start_message or '開始新任務'}",
            action_type="thought",
            meta={"event_name": "main.task.started", "preview": start_message or None, "state": "thinking", "target_room": target_room},
        )
    elif event == "agent:step":
        tools = ctx.get("tool_names", [])
        target_room = ctx.get("target_room")
        task = ", ".join(tools[:3]) if tools else "working"
        bridge_state.update("working", task, tools=tools)
        relay_world_action(
            client,
            f"工具步驟：{task}",
            action_type="tool",
            meta={"event_name": "main.tool.batch", "tool_names": tools[:3], "preview": task, "state": "working", "target_room": target_room},
        )
    elif event == "reasoning.available":
        detail = (ctx.get("text") or ctx.get("preview") or ctx.get("message") or "")[:120]
        bridge_state.update("thinking", detail or bridge_state.snapshot().get("task") or "thinking")
        relay_world_action(
            client,
            f"規劃中：{detail or '正在整理思路'}",
            action_type="thought",
            meta={"event_name": "main.reasoning", "preview": detail or None, "state": "planning"},
        )
    elif event == "tool.started":
        tool_name = ctx.get("tool_name") or ctx.get("tool") or "tool"
        preview = (ctx.get("preview") or "")[:120]
        bridge_state.update("working", tool_name, tools=[tool_name])
        relay_world_action(
            client,
            f"開始使用 {tool_name}：{preview}" if preview else f"開始使用 {tool_name}",
            action_type="tool",
            meta={
                "event_name": "main.tool.started",
                "tool_name": tool_name,
                "tool_phase": "started",
                "preview": preview or None,
                "state": "working",
            },
        )
    elif event == "tool.completed":
        tool_name = ctx.get("tool_name") or ctx.get("tool") or "tool"
        relay_world_action(
            client,
            f"完成 {tool_name}",
            action_type="tool",
            meta={
                "event_name": "main.tool.completed",
                "tool_name": tool_name,
                "tool_phase": "completed",
                "preview": (ctx.get("preview") or "")[:120] or None,
                "state": bridge_state.snapshot().get("state") or "working",
            },
        )
    elif event == "agent:end":
        response = ctx.get("response", "")
        if response and config.get("speak_responses"):
            client.speak(response[:200])
        relay_world_action(
            client,
            "任務已完成，回到待命站",
            action_type="status",
            meta={"event_name": "main.task.completed", "preview": response[:120] or None, "state": "idle"},
        )
        bridge_state.update("idle", completed_response=response)
        state, task = bridge_state.get()
        client.heartbeat(state=state, task=task)
        send_completion_notification(config, bridge_state, ctx)
        return
    else:
        log.info("Unknown hook event ignored: %s", event)

    state, task = bridge_state.get()
    client.heartbeat(state=state, task=task)


def make_webhook_handler(config: dict, client: PixelverseClient, bridge_state: BridgeState):
    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            path = urlparse(self.path).path

            if path == "/webhook":
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"{}")
                try:
                    data = json.loads(body)
                    from_agent = data.get("from", "unknown")
                    message = data.get("message", "")
                    if message:
                        t = threading.Thread(
                            target=handle_incoming_message,
                            args=(from_agent, message, config, client, bridge_state),
                            daemon=True,
                        )
                        t.start()
                except Exception as exc:
                    log.error("Webhook parse error: %s", exc)
                return

            if path == "/hook":
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"{}")
                try:
                    data = json.loads(body)
                    event = data.get("event", "")
                    ctx = data.get("context", {})
                    log.info("Hook relay POST accepted: %s", event or "(empty)")
                    t = threading.Thread(
                        target=handle_hook_event,
                        args=(event, ctx, config, client, bridge_state),
                        daemon=True,
                    )
                    t.start()
                except Exception as exc:
                    log.error("Hook relay error: %s", exc)
                return

            self.send_response(404)
            self.end_headers()

        def do_GET(self):
            if urlparse(self.path).path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                state, task = bridge_state.get()
                self.wfile.write(json.dumps({"ok": True, "agent": config["agent_id"], "state": state, "task": task, "server": config["server"]}).encode())
                return
            self.send_response(404)
            self.end_headers()

        def log_message(self, format, *args):
            log.debug(format, *args)

    return WebhookHandler


def main():
    parser = argparse.ArgumentParser(description="Bridge between Hermes Agent and Pixelverse", formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--server", default=DEFAULT_CONFIG["server"], help="Pixelverse server URL")
    parser.add_argument("--agent", default=DEFAULT_CONFIG["agent_id"], help="Agent ID in Pixelverse")
    parser.add_argument("--name", default=DEFAULT_CONFIG["agent_name"], help="Display name")
    parser.add_argument("--color", default=DEFAULT_CONFIG["agent_color"], help="Agent color (hex)")
    parser.add_argument("--port", type=int, default=DEFAULT_CONFIG["bridge_port"], help="Local port for webhook callbacks")
    parser.add_argument("--hermes-webhook", default=DEFAULT_CONFIG["hermes_webhook_url"], help="Hermes webhook adapter URL")
    parser.add_argument("--hermes-cmd", default=DEFAULT_CONFIG["hermes_cmd"], help="CLI fallback command")
    parser.add_argument("--notify-on-complete", action="store_true", default=DEFAULT_CONFIG["notify_on_complete"], help="Send completion email")
    parser.add_argument("--notify-to", action="append", default=None, help="Notification recipient; repeat for multiple")
    parser.add_argument("--notify-cmd", default=DEFAULT_CONFIG["notify_cmd"], help="Notification command")
    parser.add_argument("--no-speak", action="store_true", help="Don't speak responses in the world")
    parser.add_argument("--relay-only", action="store_true", help="Expose hook relay without creating an idle bridge agent until an event arrives.")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")

    config = {
        **DEFAULT_CONFIG,
        "server": args.server,
        "agent_id": args.agent,
        "agent_name": args.name,
        "agent_color": args.color,
        "bridge_port": args.port,
        "hermes_webhook_url": args.hermes_webhook or "",
        "hermes_cmd": args.hermes_cmd,
        "speak_responses": not args.no_speak,
        "notify_on_complete": args.notify_on_complete,
        "notify_to": args.notify_to if args.notify_to is not None else DEFAULT_CONFIG["notify_to"],
        "notify_cmd": args.notify_cmd,
    }

    client = PixelverseClient(config["server"], config["agent_id"], config["agent_name"], config["agent_color"])
    bridge_state = BridgeState()

    log.info("Connecting to Pixelverse at %s ...", config["server"])
    if args.relay_only:
        log.info("Relay-only mode: waiting for Hermes gateway lifecycle events before creating an agent")
    else:
        if not client.heartbeat(state="idle"):
            log.error("Could not connect to Pixelverse server. Is it running?")
            sys.exit(1)
        log.info("✓ Connected as '%s' (%s)", config["agent_id"], config["agent_name"])

        agents = client.get_agents()
        if agents:
            names = [a.get("name", a.get("agent", "?")) for a in agents]
            log.info("Agents in world: %s", ", ".join(names))

        hb_thread = threading.Thread(target=heartbeat_loop, args=(client, bridge_state, config["heartbeat_interval"]), daemon=True)
        hb_thread.start()

    handler = make_webhook_handler(config, client, bridge_state)
    server = HTTPServer(("0.0.0.0", config["bridge_port"]), handler)
    webhook_url = f"http://localhost:{config['bridge_port']}/webhook"
    if not args.relay_only:
        client.register_webhook(webhook_url)

    log.info("Bridge running on port %d", config["bridge_port"])
    log.info("  Webhook endpoint: %s", webhook_url)
    log.info("  Hook relay:       http://localhost:%d/hook", config["bridge_port"])
    log.info("  Health check:     http://localhost:%d/health", config["bridge_port"])
    log.info("")
    log.info("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down...")
        client.heartbeat(state="offline")
        client.unregister_webhook()
        client.close()
        server.shutdown()


if __name__ == "__main__":
    main()

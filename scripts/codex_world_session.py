#!/usr/bin/env python3
"""Run a Codex TUI and the village against one explicitly owned App Server session."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from agent_bridges.codex_control import CodexConnection, CodexControl
from agent_bridges import control_mailbox


def post(url, payload, path='/api/event'):
    request = urllib.request.Request(url + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=3) as response:
        response.read()


async def run(args):
    adapter_bin = str(ROOT / '.pixelverse-service/bin')
    search_path = os.pathsep.join(p for p in os.get_exec_path() if str(Path(p).resolve()) != adapter_bin)
    executable = os.getenv('PIXELVERSE_CODEX_COMMAND') or shutil.which('codex', path=search_path)
    if not executable: raise RuntimeError('Codex CLI is not installed.')
    os.environ.setdefault('PIXELVERSE_CONTROL_RUNTIME', str(ROOT / '.pixelverse-service/runtime/codex-control'))
    agent = 'codex-world:' + uuid.uuid4().hex
    root = control_mailbox.folder(agent)
    root.mkdir(parents=True, mode=0o700)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    url = f'ws://127.0.0.1:{port}'
    # No shell interpolation and no changes to the user's approval/sandbox settings.
    server_env = {**os.environ, 'PIXELVERSE_AGENT_ID': agent, 'PIXELVERSE_URL': args.url, 'PIXELVERSE_INSTANCE_NAME': args.name, 'PIXELVERSE_PROJECT_PATH': os.getcwd(), 'PIXELVERSE_PROJECT_NAME': Path.cwd().name}
    server = await asyncio.create_subprocess_exec(executable, 'app-server', '--listen', url, env=server_env, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    tui = None
    owner = None
    try:
        for attempt in range(60):
            try:
                owner = await CodexConnection(url).__aenter__()
                break
            except Exception:
                if owner:
                    await owner.__aexit__(None, None, None)
                    owner = None
                if server.returncode is not None or attempt == 59: raise
                await asyncio.sleep(.25)
        if args.headless:
            method = 'thread/resume' if args.resume else 'thread/start'
            params = {'threadId': args.resume, 'excludeTurns': True} if args.resume else {'cwd': os.getcwd()}
            thread = (await owner.call(method, params))['thread']['id']
        else:
            # Let the TUI own bootstrap. Preloading via a separate API client
            # makes Codex 0.154 resume against a backend without list_turns.
            env = {**os.environ, 'PIXELVERSE_AGENT_ID': agent, 'PIXELVERSE_URL': args.url}
            command = [executable, '--remote', url]
            if args.resume: command += ['resume', args.resume]
            tui = await asyncio.create_subprocess_exec(*command, env=env)
            thread = await wait_for_tui_thread(owner, tui, args.resume)
            if thread is None:
                return tui.returncode
        control = CodexControl(use_mailbox=False)
        control.binding = lambda _: {'url': url, 'thread_id': thread}
        base = dict(agent=agent, agent_type='codex', name=args.name, role='main_agent', session_id=thread,
                    project_path=os.getcwd(), project_name=Path.cwd().name, process_id=os.getpid())
        print(f'Village session: {thread}\nAgent: {agent}\nOpen {args.url} and approach this rabbit.', flush=True)
        last = 0
        last_state = None
        while tui is None or tui.returncode is None:
            control_mailbox.atomic(root / 'ready.json', {'time': time.time(), 'thread_id': thread})
            for path in list(root.glob('*.request')):
                try:
                    data = json.loads(path.read_text())
                    operation, params = data['operation'], data.get('params', {})
                    if operation == 'capability': result = await control.capability(agent)
                    elif operation == 'session': result = await control.session(agent)
                    elif operation == 'execute': result = await control.execute(agent, **params)
                    else: raise ValueError('Unsupported operation')
                    response = {'result': result}
                except Exception as exc:
                    response = {'error': str(exc), 'status': getattr(exc, 'status', 503)}
                control_mailbox.atomic(path.with_suffix('.response'), response)
                path.unlink(missing_ok=True)
            if time.monotonic() - last > 3:
                last = time.monotonic()
                try:
                    session = await control.session(agent)
                    working = session['state'] == 'working'
                    state = 'working' if working else 'idle'
                    if state != last_state:
                        await asyncio.to_thread(post, args.url, dict(base, event='tool.started' if working else 'agent.completed', state=state, message='Codex working' if working else 'Waiting for your next message', conversation=session['messages']))
                        last_state = state
                    else:
                        await asyncio.to_thread(post, args.url, dict(base, state=state, preserve_phase=True, conversation=session['messages']), '/api/heartbeat')
                except Exception:
                    pass
            await asyncio.sleep(.1)
        return tui.returncode if tui else 0
    finally:
        (root / 'ready.json').unlink(missing_ok=True)
        if tui and tui.returncode is None:
            tui.terminate(); await tui.wait()
        if owner: await owner.__aexit__(None, None, None)
        if server.returncode is None:
            server.terminate(); await server.wait()


async def wait_for_tui_thread(connection, tui, resume, timeout=60):
    """Discover only the TUI's thread on this launcher's dedicated App Server."""
    async with asyncio.timeout(timeout):
        while tui.returncode is None:
            loaded = await connection.call('thread/loaded/list', {})
            ids = loaded.get('data', [])
            if resume:
                if resume in ids: return resume
            elif ids:
                if len(ids) != 1 or loaded.get('nextCursor'):
                    raise RuntimeError('Ambiguous Codex session; refusing to bind the wrong rabbit.')
                return ids[0]
            await asyncio.sleep(.1)
    return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=os.getenv('PIXELVERSE_URL', 'http://127.0.0.1:5661'))
    parser.add_argument('--name', default='Codex World')
    parser.add_argument('--resume', help='Explicit saved session UUID to resume; close its previous CLI first.')
    parser.add_argument('--headless', action='store_true', help='Use only the village conversation UI; keep this launcher running.')
    try: sys.exit(asyncio.run(run(parser.parse_args())))
    except KeyboardInterrupt: sys.exit(130)

"""Launcher regression, including an opt-in real Codex PTY bootstrap check."""
import asyncio
import json
import os
from pathlib import Path
import signal
import sys
import time
import uuid

import pytest
from scripts.codex_world_session import wait_for_tui_thread


def test_binding_uses_only_loaded_tui_session():
    class Tui:
        returncode = None
    class Connection:
        async def call(self, method, params):
            assert method == 'thread/loaded/list'  # Must never pre-load with resume/start.
            return {'data': ['exact-tui-thread']}
    assert asyncio.run(wait_for_tui_thread(Connection(), Tui(), None)) == 'exact-tui-thread'
    class Ambiguous:
        async def call(self, *_): return {'data': ['one', 'two']}
    with pytest.raises(RuntimeError, match='Ambiguous'):
        asyncio.run(wait_for_tui_thread(Ambiguous(), Tui(), None))
    tui = Tui(); tui.returncode = 1
    assert asyncio.run(wait_for_tui_thread(Connection(), tui, None)) is None


@pytest.mark.skipif(os.getenv('PIXELVERSE_TEST_CODEX_TUI') != '1', reason='Opt-in: requires installed authenticated Codex and opens a real PTY')
def test_real_tui_new_resume_and_first_village_message(tmp_path):
    import fcntl
    import pty
    import re
    import select
    import struct
    import subprocess
    import termios
    from agent_bridges.control_mailbox import atomic
    root = Path(__file__).resolve().parents[1]
    runtime = tmp_path / 'control'
    env = {**os.environ, 'TERM': 'xterm-256color', 'PIXELVERSE_CONTROL_RUNTIME': str(runtime)}
    command = [sys.executable, str(root / 'scripts/codex_world_session.py'), '--url', 'http://127.0.0.1:59999']
    ansi = re.compile(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]')

    def launch(resume=None):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 160, 0, 0))
        def terminal():
            os.setsid()
            fcntl.ioctl(0, termios.TIOCSCTTY, 0)
        proc = subprocess.Popen(command + (['--resume', resume] if resume else []), cwd=root,
                                env=env, stdin=slave, stdout=slave, stderr=slave, preexec_fn=terminal)
        os.close(slave)
        return proc, master

    def read_until(proc, master, predicate, timeout=55):
        text = ''
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if select.select([master], [], [], .1)[0]:
                try: raw = os.read(master, 65536)
                except OSError: raw = b''
                text += ansi.sub('', raw.decode(errors='replace'))
            assert 'list_turns is not supported yet' not in text, 'Codex TUI bootstrap regressed: list_turns unsupported'
            assert proc.poll() is None, f'Codex TUI exited during bootstrap: {proc.returncode}'
            if predicate(text): return text
        raise AssertionError('Codex TUI did not reach the expected interactive state')

    def request(folder, operation, **params):
        path = folder / (uuid.uuid4().hex + '.request')
        atomic(path, {'operation': operation, 'params': params})
        response = path.with_suffix('.response')
        deadline = time.monotonic() + 30
        while not response.exists() and time.monotonic() < deadline:
            if select.select([master], [], [], .1)[0]: os.read(master, 65536)
        assert response.exists(), 'Village control timed out'
        data = json.loads(response.read_text()); response.unlink()
        assert 'error' not in data, data.get('error')
        return data['result']

    thread = None
    for iteration in range(2):
        proc, master = launch(thread)
        try:
            # Slash command confirmation exercises the real interactive TUI,
            # not the initial placeholder input rendered before bootstrap.
            read_until(proc, master, lambda _: bool(list(runtime.glob('*/ready.json'))))
            time.sleep(2)
            os.write(master, b'/status')
            time.sleep(.2)
            os.write(master, b'\r')
            read_until(proc, master, lambda text: 'Session:' in text)
            ready = list(runtime.glob('*/ready.json'))
            assert len(ready) == 1
            bound = json.loads(ready[0].read_text())['thread_id']
            if thread: assert bound == thread
            thread = bound
            folder = ready[0].parent
            assert request(folder, 'capability')['available']
            messages = request(folder, 'session')['messages']
            if iteration:
                assert any(m['role'] == 'assistant' and 'PIXELVERSE_BOOTSTRAP_OK' in m['text'] for m in messages)
            else:
                assert messages == []
            if not iteration:
                assert request(folder, 'execute', action='start', text='Reply exactly PIXELVERSE_BOOTSTRAP_OK. Do not use tools or modify files.', expected_turn_id='', request_id=uuid.uuid4().hex)['accepted']
                deadline = time.monotonic() + 45
                while time.monotonic() < deadline:
                    session = request(folder, 'session')
                    if session['state'] == 'idle' and any(m['role'] == 'assistant' and 'PIXELVERSE_BOOTSTRAP_OK' in m['text'] for m in session['messages']): break
                    time.sleep(.5)
                else: pytest.fail('Village did not receive the real Codex reply')
            os.write(master, b'/quit')
            time.sleep(.2)
            os.write(master, b'\r')
            deadline = time.monotonic() + 15
            while proc.poll() is None and time.monotonic() < deadline:
                if select.select([master], [], [], .1)[0]:
                    try: os.read(master, 65536)
                    except OSError: pass
            proc.wait(timeout=1)
            assert proc.returncode == 0
            assert not list(runtime.glob('*/ready.json'))
        finally:
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGINT)
                try: proc.wait(timeout=10)
                except subprocess.TimeoutExpired: os.killpg(proc.pid, signal.SIGKILL); proc.wait()
            os.close(master)

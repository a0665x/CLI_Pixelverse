import asyncio
import json
import pytest
from agent_bridges.codex_control import CodexControl, ControlError


class FakeCodex:
    active = 'turn-1'
    calls = []
    fail_interrupt = False
    def __init__(self, url): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *_): pass
    async def call(self, method, params):
        self.calls.append((method, params))
        if method == 'thread/read':
            return {'thread': {'turns': [{'id': self.active, 'status': 'inProgress'}] if self.active else []}}
        if method == 'turn/steer': return {'turnId': self.active}
        if method == 'turn/start': return {'turn': {'id': 'new-turn'}}
        return {}
    async def interrupted(self, turn_id):
        self.calls.append(('confirmed', turn_id))
        if self.fail_interrupt: raise TimeoutError()
        self.active = None


@pytest.fixture
def control(tmp_path, monkeypatch):
    config = tmp_path / 'bindings.json'
    config.write_text(json.dumps({'agent-a': {'url': 'ws://127.0.0.1:4501', 'thread_id': 'thread-a'}}))
    monkeypatch.setenv('PIXELVERSE_CODEX_CONTROL_BINDINGS', str(config))
    FakeCodex.active = 'turn-1'
    FakeCodex.calls = []
    FakeCodex.fail_interrupt = False
    return CodexControl(FakeCodex)


def test_hook_only_agent_cannot_be_controlled(control):
    assert asyncio.run(control.capability('hook-agent'))['available'] is False
    with pytest.raises(ControlError):
        asyncio.run(control.execute('hook-agent', 'steer', 'hello', 'turn-1', 'request-1'))
    assert FakeCodex.calls == []


def test_steer_targets_exact_turn_and_preserves_input(control):
    async def run():
        text = '請保留 `$(literal)`，先修橋\n不要改房子'
        result = await control.execute('agent-a', 'steer', text, 'turn-1', 'request-1')
        assert result['accepted']
        assert FakeCodex.calls[-1] == ('turn/steer', {'threadId': 'thread-a', 'expectedTurnId': 'turn-1', 'input': [{'type': 'text', 'text': text}]})
        count = len(FakeCodex.calls)
        assert await control.execute('agent-a', 'steer', text, 'turn-1', 'request-1') == result
        assert len(FakeCodex.calls) == count
        with pytest.raises(ControlError):
            await control.execute('agent-a', 'steer', 'different', 'turn-1', 'request-1')
    asyncio.run(run())


def test_stale_turn_never_receives_command(control):
    with pytest.raises(ControlError, match='任務已改變'):
        asyncio.run(control.execute('agent-a', 'interrupt', 'new task', 'stale', 'request-1'))
    assert [m for m, _ in FakeCodex.calls] == ['thread/resume', 'thread/read']


def test_interrupt_waits_for_confirmation_before_new_turn(control):
    result = asyncio.run(control.execute('agent-a', 'interrupt', 'new task', 'turn-1', 'request-1'))
    assert result['accepted']
    assert [m for m, _ in FakeCodex.calls] == ['thread/resume', 'thread/read', 'turn/interrupt', 'confirmed', 'thread/read', 'turn/start']


def test_unconfirmed_interrupt_does_not_start_new_work(control):
    FakeCodex.fail_interrupt = True
    with pytest.raises(ControlError, match='狀態未確認'):
        asyncio.run(control.execute('agent-a', 'interrupt', 'new task', 'turn-1', 'request-1'))
    assert 'turn/start' not in [m for m, _ in FakeCodex.calls]


def test_real_json_rpc_transport_confirms_interrupt_before_start(tmp_path, monkeypatch):
    import websockets
    from agent_bridges.codex_control import CodexConnection
    methods = []
    async def run():
        active = True
        async def server(ws, *_):
            nonlocal active
            async for raw in ws:
                message = json.loads(raw)
                method = message['method']
                methods.append(method)
                if 'id' not in message: continue
                result = {}
                if method == 'thread/read':
                    result = {'thread': {'turns': [{'id': 'turn-1', 'status': 'inProgress'}] if active else []}}
                if method == 'turn/interrupt':
                    active = False
                    # Notification may arrive before the response; it must not be lost.
                    await ws.send(json.dumps({'method': 'turn/completed', 'params': {'threadId': 'thread-a', 'turn': {'id': 'turn-1', 'status': 'interrupted'}}}))
                if method == 'turn/start': result = {'turn': {'id': 'turn-2'}}
                await ws.send(json.dumps({'id': message['id'], 'result': result}))
        async with websockets.serve(server, '127.0.0.1', 0) as ws_server:
            port = ws_server.sockets[0].getsockname()[1]
            config = tmp_path / 'local-control.json'
            config.write_text(json.dumps({'agent-a': {'url': f'ws://127.0.0.1:{port}', 'thread_id': 'thread-a'}}))
            monkeypatch.setenv('PIXELVERSE_CODEX_CONTROL_BINDINGS', str(config))
            control = CodexControl(CodexConnection)
            assert (await control.execute('agent-a', 'interrupt', 'new instructions', 'turn-1', 'request-rpc'))['accepted']
        assert methods == ['initialize', 'initialized', 'thread/resume', 'thread/read', 'turn/interrupt', 'thread/read', 'turn/start']
    asyncio.run(run())


def test_bound_idle_session_accepts_next_conversation(control):
    FakeCodex.active = None
    async def run():
        assert (await control.capability('agent-a'))['available']
        result = await control.execute('agent-a', 'start', 'continue the conversation', '', 'idle-start')
        assert result['accepted']
        assert FakeCodex.calls[-1][0] == 'turn/start'
    asyncio.run(run())

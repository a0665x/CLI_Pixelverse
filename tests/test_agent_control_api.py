from fastapi.testclient import TestClient
from pixelverse_fastapi import app


def test_control_rejects_foreign_origins_before_execution():
    with TestClient(app, base_url='http://127.0.0.1') as client:
        payload = {'action': 'steer', 'text': 'hello', 'expected_turn_id': 'turn-1', 'request_id': 'request-1'}
        assert client.post('/api/agent-control/test', json=payload, headers={'Origin': 'https://evil.example'}).status_code == 403
        assert client.post('/api/agent-control/test', json=payload).status_code == 403


def test_unbound_agent_is_explicitly_read_only(monkeypatch):
    monkeypatch.delenv('PIXELVERSE_CODEX_CONTROL_BINDINGS', raising=False)
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.get('/api/agent-control/unbound').json()['available'] is False
        result = client.post('/api/agent-control/unbound', json={'action': 'steer', 'text': 'hello', 'expected_turn_id': 'turn-1', 'request_id': 'request-1'}, headers={'Origin': 'http://127.0.0.1'})
        assert result.status_code == 409
        assert '尚未連接' in result.json()['detail']


def test_subagent_parent_and_project_survive_heartbeats(monkeypatch):
    from pixelverse_server import WorldState
    import pixelverse_fastapi
    world = WorldState()
    monkeypatch.setattr(pixelverse_fastapi, 'WORLD', world)
    with TestClient(app, base_url='http://127.0.0.1') as client:
        for name in ['alpha', 'beta']:
            response = client.post('/api/event', json={'agent': name, 'event': 'tool.started', 'project_name': name, 'project_path': '/projects/' + name})
            assert response.status_code == 200
        response = client.post('/api/event', json={'agent': 'child', 'event': 'tool.started', 'role': 'subagent', 'parent_agent_id': 'beta'})
        assert response.status_code == 200
        client.post('/api/event', json={'agent': 'child', 'event': 'heartbeat'})
        child = world.agents['child']
        assert child.role == 'subagent'
        assert child.parent_agent_id == 'beta'
        assert child.project_name == 'beta'
        assert child.project_path == '/projects/beta'


def test_idle_conversation_accepts_null_turn_id(monkeypatch):
    import pixelverse_fastapi
    recorded = []
    async def execute(*args):
        recorded.append(args)
        return {'accepted': True}
    monkeypatch.setattr(pixelverse_fastapi.CONTROL, 'execute', execute)
    with TestClient(app, base_url='http://127.0.0.1') as client:
        result = client.post('/api/agent-control/idle', json={'action':'start', 'text':'hello', 'expected_turn_id':None, 'request_id':'idle-ui-message'}, headers={'Origin':'http://127.0.0.1'})
        assert result.status_code == 200
        assert recorded == [('idle', 'start', 'hello', '', 'idle-ui-message')]

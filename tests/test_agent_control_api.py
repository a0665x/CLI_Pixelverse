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

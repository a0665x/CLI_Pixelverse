import asyncio
import json
import time
import pytest
from agent_bridges import control_mailbox as mailbox
from agent_bridges.codex_control import ControlError


def test_mailbox_roundtrip_and_stale_connection(tmp_path, monkeypatch):
    monkeypatch.setenv('PIXELVERSE_CONTROL_RUNTIME', str(tmp_path))
    root = mailbox.folder('../agent'); root.mkdir()
    assert root.parent == tmp_path
    assert not mailbox.available('../agent')
    mailbox.atomic(root / 'ready.json', {'time': time.time()})
    async def run():
        pending = asyncio.create_task(mailbox.request('../agent', 'capability'))
        await asyncio.sleep(.01)
        path = next(root.glob('*.request'))
        assert json.loads(path.read_text())['operation'] == 'capability'
        mailbox.atomic(path.with_suffix('.response'), {'result': {'available': True, 'turnId': None}})
        path.unlink()
        assert (await pending)['available']
        assert not list(root.glob('*.response'))
    asyncio.run(run())
    mailbox.atomic(root / 'ready.json', {'time': time.time()-20})
    with pytest.raises(ControlError):
        asyncio.run(mailbox.request('../agent', 'capability'))


def test_hook_transcript_excludes_internal_items(tmp_path, monkeypatch):
    from scripts.codex_pixelverse_hook import public_history
    monkeypatch.setenv('CODEX_HOME', str(tmp_path))
    session = '11111111-2222-3333-4444-555555555555'
    folder = tmp_path / 'sessions/2026/09/14'; folder.mkdir(parents=True)
    rows = [
        {'type': 'event_msg', 'payload': {'type': 'user_message', 'message': 'hello'}},
        {'type': 'event_msg', 'payload': {'type': 'agent_reasoning', 'message': 'private reasoning'}},
        {'type': 'response_item', 'payload': {'type': 'reasoning', 'text': 'private'}},
        {'type': 'event_msg', 'payload': {'type': 'agent_message', 'message': 'public reply'}},
    ]
    (folder / ('rollout-' + session + '.jsonl')).write_text('\n'.join(map(json.dumps, rows)))
    assert public_history(session) == [{'role':'user','text':'hello'}, {'role':'assistant','text':'public reply'}]
    assert public_history('../../etc/passwd') == []


def test_history_is_not_broadcast_with_world_snapshot():
    from pixelverse_server import WorldState
    world = WorldState()
    agent = world.upsert_agent({'agent':'one','session_id':'thread-one','conversation':[{'role':'user','text':'hello'}]})
    assert agent.conversation[0]['text'] == 'hello'
    assert 'conversation' not in agent.to_public()
    assert agent.to_public()['session_id'] == 'thread-one'

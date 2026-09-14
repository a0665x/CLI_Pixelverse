"""Local shared-runtime transport; only the host-owned session worker executes Codex RPC."""
import asyncio
import hashlib
import json
import os
import time
import uuid
from pathlib import Path


def folder(agent):
    return Path(os.getenv('PIXELVERSE_CONTROL_RUNTIME', 'runtime/codex-control')) / hashlib.sha256(agent.encode()).hexdigest()


def available(agent):
    try:
        return time.time() - json.loads((folder(agent) / 'ready.json').read_text())['time'] < 15
    except (OSError, ValueError, KeyError, TypeError):
        return False


def atomic(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False))
    temp.replace(path)


async def request(agent, operation, **params):
    from .codex_control import ControlError
    root = folder(agent)
    if not available(agent):
        raise ControlError('Local session connection is offline.', 503)
    key = uuid.uuid4().hex
    incoming, outgoing = root / (key + '.request'), root / (key + '.response')
    atomic(incoming, {'operation': operation, 'params': params})
    try:
        async with asyncio.timeout(55):
            while not outgoing.exists():
                await asyncio.sleep(.1)
        result = json.loads(outgoing.read_text())
        if 'error' in result:
            raise ControlError(result['error'], result.get('status', 409))
        return result['result']
    except TimeoutError as exc:
        raise ControlError('Session response timed out; delivery is unconfirmed.', 503) from exc
    finally:
        # An in-flight worker still owns the request; never retry a submission automatically.
        outgoing.unlink(missing_ok=True)

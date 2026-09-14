"""Opt-in control of explicitly bound, already-running Codex App Server threads.

Hook-only agents stay read-only. Bindings come from a local administrator file,
never a URL, thread id or executable supplied by a browser request.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import websockets
from . import control_mailbox


class ControlError(Exception):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.status = status


class CodexConnection:
    def __init__(self, url: str):
        self.url = url
        self.sequence = 0
        self.completed: set[str] = set()

    async def __aenter__(self):
        self.ws = await websockets.connect(self.url, open_timeout=5, max_size=8 * 1024 * 1024)
        try:
            await self.call('initialize', {'clientInfo': {'name': 'pixelverse', 'version': '1.0'}})
            await self.ws.send(json.dumps({'method': 'initialized'}))
        except BaseException:
            await self.ws.close()
            raise
        return self

    async def __aexit__(self, *_):
        await self.ws.close()

    def observe(self, message):
        if message.get('method') == 'turn/completed':
            turn = message.get('params', {}).get('turn', {})
            if turn.get('status') == 'interrupted':
                self.completed.add(turn.get('id'))
        # Approvals belong to the owning Codex client. Never auto-approve here.

    async def receive(self):
        message = json.loads(await asyncio.wait_for(self.ws.recv(), 20))
        self.observe(message)
        return message

    async def call(self, method: str, params: dict):
        self.sequence += 1
        request_id = self.sequence
        await self.ws.send(json.dumps({'id': request_id, 'method': method, 'params': params}))
        async with asyncio.timeout(20):
            while True:
                message = await self.receive()
                if message.get('id') != request_id or 'method' in message:
                    continue
                if 'error' in message:
                    raise ControlError('Codex 拒絕此操作；請回到原任務確認狀態後再試。')
                return message.get('result', {})

    async def interrupted(self, turn_id: str):
        async with asyncio.timeout(20):
            while turn_id not in self.completed:
                await self.receive()


class CodexControl:
    def __init__(self, connector=CodexConnection, use_mailbox=True):
        self.use_mailbox = use_mailbox
        self.connector = connector
        self.locks: dict[str, asyncio.Lock] = {}
        self.requests: dict[tuple[str, str], tuple[tuple, asyncio.Task]] = {}

    def binding(self, agent: str):
        path = os.getenv('PIXELVERSE_CODEX_CONTROL_BINDINGS')
        if not path:
            return None
        try:
            bindings = json.loads(Path(path).read_text())
            if not isinstance(bindings, dict):
                raise ValueError('bindings must be an object')
            binding = bindings.get(agent)
            if not binding:
                return None
            url = urlsplit(binding['url'])
            if url.scheme != 'ws' or url.hostname not in {'127.0.0.1', 'localhost', '::1'} or url.username or url.password:
                raise ValueError('only local app servers are supported')
            if not isinstance(binding['thread_id'], str) or not binding['thread_id']:
                raise ValueError('missing thread')
            return binding
        except (OSError, ValueError, KeyError, TypeError):
            raise ControlError('本機 Codex 控制綁定設定無效。', 503)

    @staticmethod
    async def active_turn(connection, thread_id: str):
        result = await connection.call('thread/read', {'threadId': thread_id, 'includeTurns': True})
        thread = result.get('thread', {})
        return next((turn.get('id') for turn in reversed(thread.get('turns', [])) if turn.get('status') == 'inProgress'), None)

    async def capability(self, agent: str):
        if self.use_mailbox and control_mailbox.available(agent):
            return await control_mailbox.request(agent, 'capability')
        binding = self.binding(agent)
        if not binding:
            return {'available': False, 'reason': '此 Agent 目前透過 Hook 回報狀態，尚未綁定 Codex 控制通道。'}
        try:
            async with self.connector(binding['url']) as connection:
                turn_id = await self.active_turn(connection, binding['thread_id'])
            return {'available': True, 'turnId': turn_id, 'state': 'working' if turn_id else 'idle', 'reason': ''}
        except Exception:
            return {'available': False, 'reason': '無法確認 Codex 控制連線；目前只提供查看工作。'}

    async def session(self, agent: str):
        if self.use_mailbox and control_mailbox.available(agent):
            return await control_mailbox.request(agent, 'session')
        binding = self.binding(agent)
        if not binding:
            return {'available': False, 'messages': []}
        async with self.connector(binding['url']) as connection:
            result = await connection.call('thread/read', {'threadId': binding['thread_id'], 'includeTurns': True})
        thread = result.get('thread', {})
        messages = []
        for turn in thread.get('turns', [])[-20:]:
            for item in turn.get('items', []):
                kind = item.get('type')
                if kind == 'userMessage':
                    text = '\n'.join(c.get('text', '') for c in item.get('content', []) if c.get('type') == 'text')
                    role = 'user'
                elif kind == 'agentMessage':
                    text, role = item.get('text', ''), 'assistant'
                elif kind == 'commandExecution':
                    text, role = (str(item.get('command', '')) + '\n' + (item.get('aggregatedOutput') or '')), 'tool'
                else:
                    continue
                if text: messages.append({'role': role, 'text': text[-8000:]})
        active = next((t['id'] for t in reversed(thread.get('turns', [])) if t.get('status') == 'inProgress'), None)
        return {'available': True, 'threadId': binding['thread_id'], 'state': 'working' if active else 'idle', 'turnId': active, 'messages': messages[-60:]}

    async def execute(self, agent: str, action: str, text: str, expected_turn_id: str, request_id: str):
        if self.use_mailbox and control_mailbox.available(agent):
            return await control_mailbox.request(agent, 'execute', action=action, text=text, expected_turn_id=expected_turn_id, request_id=request_id)
        fingerprint = (action, text, expected_turn_id)
        key = (agent, request_id)
        if key in self.requests:
            previous, task = self.requests[key]
            if previous != fingerprint:
                raise ControlError('重複請求的內容不一致。')
            return await asyncio.shield(task)
        if len(self.requests) >= 256:
            # Never evict an uncertain submission and accidentally execute it twice.
            raise ControlError('控制請求紀錄已滿，請由管理者重新啟動控制服務。', 503)
        task = asyncio.create_task(self._execute(agent, action, text, expected_turn_id))
        self.requests[key] = (fingerprint, task)
        # Retrieve failures even when the browser disconnects during submission.
        task.add_done_callback(lambda done: done.exception() if not done.cancelled() else None)
        return await asyncio.shield(task)

    async def _execute(self, agent, action, text, expected_turn_id):
        if action not in {'steer', 'interrupt', 'start'} or not text.strip() or (action != 'start' and not expected_turn_id):
            raise ControlError('請提供有效指令與目前任務識別。', 422)
        binding = self.binding(agent)
        if not binding:
            raise ControlError('這位 Agent 尚未連接控制通道。')
        async with self.locks.setdefault(binding['url'] + '|' + binding['thread_id'], asyncio.Lock()):
            try:
                async with self.connector(binding['url']) as connection:
                    thread_id = binding['thread_id']
                    # A read does not load a persisted thread into this connection.
                    await connection.call('thread/resume', {'threadId': thread_id})
                    if await self.active_turn(connection, thread_id) != (expected_turn_id or None):
                        raise ControlError('Agent 的任務已改變，未送出指令；請返回選項重新確認。')
                    inputs = [{'type': 'text', 'text': text}]
                    if action == 'start':
                        result = await connection.call('turn/start', {'threadId': thread_id, 'input': inputs})
                        if not result.get('turn', {}).get('id'):
                            raise ControlError('New turn was not acknowledged.')
                    elif action == 'steer':
                        result = await connection.call('turn/steer', {'threadId': thread_id, 'expectedTurnId': expected_turn_id, 'input': inputs})
                        if result.get('turnId') != expected_turn_id:
                            raise ControlError('未取得指定任務的接受確認，請檢查原任務。')
                    else:
                        await connection.call('turn/interrupt', {'threadId': thread_id, 'turnId': expected_turn_id})
                        await connection.interrupted(expected_turn_id)
                        # Another client may have started a task while interruption completed.
                        if await self.active_turn(connection, thread_id):
                            raise ControlError('舊任務已中斷，但另一個任務已啟動；新指令未送出。')
                        result = await connection.call('turn/start', {'threadId': thread_id, 'input': inputs})
                        if not result.get('turn', {}).get('id'):
                            raise ControlError('已中斷，但新指令未取得開始確認；請檢查原任務。')
                    return {'accepted': True, 'action': action}
            except ControlError:
                raise
            except Exception as exc:
                raise ControlError('連線中斷或等候逾時，送達狀態未確認；請先檢查原 Codex 任務，勿重複送出。', 503) from exc


CONTROL = CodexControl()

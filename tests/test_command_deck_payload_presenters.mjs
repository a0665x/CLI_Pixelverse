import test from 'node:test';
import assert from 'node:assert/strict';

import { agentConnectionStatusText, agentTaskText } from '../public/ui_strings.mjs';
import { currentAgentStatePresentation } from '../public/command_deck_payload_presenters.mjs';

for (const [locale, expected] of Object.entries({
  'en-US': 'Waiting for a new CLI session',
  'zh-TW': '等待新的 CLI 工作階段',
  'ja-JP': '新しい CLI セッションを待機中',
  'ko-KR': '새 CLI 세션을 기다리는 중',
})) {
  test(`awaiting source uses ${locale} product copy`, () => {
    const agent = { connection_status: 'awaiting_attach', source_placeholder: true, activity_hint: '不應顯示' };
    const detail = agentConnectionStatusText(locale, agent);
    assert.equal(detail, expected);
    assert.equal(currentAgentStatePresentation({ name: 'codex', state: 'Idle', room: 'Standby Dock', detail }).text,
      `codex · Idle · Standby Dock · ${expected}`);
  });
}

test('external task bytes stay verbatim', () => {
  assert.equal(agentConnectionStatusText('en-US', { task: '使用者的原始任務', connection_status: 'attached' }), '');
  assert.equal(agentTaskText({ task: '使用者的原始任務' }), '使用者的原始任務');
});

test('legacy generated activity hints are not treated as external task bytes', () => {
  assert.equal(agentTaskText({ activity_hint: '產品生成文字' }), '');
});

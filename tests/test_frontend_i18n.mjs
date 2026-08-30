import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLocaleStrings,
  getRoomDecor,
  localizeToolSummary,
  normalizeLocale,
  summarizeWorld,
} from '../public/ui_strings.mjs';
import * as uiStrings from '../public/ui_strings.mjs';

test('normalizeLocale falls back to English', () => {
  assert.equal(normalizeLocale('fr-FR'), 'en-US');
  assert.equal(normalizeLocale('en-US'), 'en-US');
});

test('known adapter lifecycle copy localizes without rewriting external task bytes', () => {
  const expected = {
    'en-US': ['CLI session started', 'CLI session running', 'CLI session completed'],
    'zh-TW': ['CLI 工作階段已啟動', 'CLI 工作階段執行中', 'CLI 工作階段已完成'],
    'ja-JP': ['CLI セッションを開始しました', 'CLI セッション実行中', 'CLI セッションが完了しました'],
    'ko-KR': ['CLI 세션을 시작했습니다', 'CLI 세션 실행 중', 'CLI 세션을 완료했습니다'],
  };
  for (const [locale, copy] of Object.entries(expected)) {
    assert.deepEqual([
      uiStrings.agentTaskText({ task: 'CLI session started' }, locale),
      uiStrings.agentTaskText({ task: 'CLI session running' }, locale),
      uiStrings.agentTaskText({ task: 'CLI session completed' }, locale),
    ], copy);
    assert.equal(uiStrings.agentTaskText({ task: '使用者 authored task' }, locale), '使用者 authored task');
  }
});

test('adapter lifecycle events render localized status instead of backend JSON summaries', () => {
  const event = {
    kind: 'agent.completed',
    payload: { action: { type: 'status', state: 'idle', message: 'CLI session completed' } },
    summary: '{"agent":"codex-cli:42","action":{"type":"status"}}',
  };
  assert.equal(uiStrings.eventSummaryForLocale(event, 'zh-TW'), '狀態：待命中｜CLI 工作階段已完成');
  assert.equal(uiStrings.eventSummaryForLocale(event, 'ja-JP'), '状態：待機｜CLI セッションが完了しました');
  assert.equal(uiStrings.eventSummaryForLocale(event, 'ko-KR'), '상태: 대기｜CLI 세션을 완료했습니다');
});

test('all supported locales contain complete Agent detail and village layout copy', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    for (const key of [
      'agentDetail.title', 'agentDetail.close', 'agentDetail.currentTask', 'agentDetail.room',
      'agentDetail.tool', 'agentDetail.hook', 'agentDetail.lastSeen', 'agentDetail.process',
      'agentDetail.session', 'agentDetail.project', 'agentDetail.recentEvents', 'agentDetail.noTask',
      'agentDetail.role.main_agent', 'agentDetail.role.subagent',
      'villageLayout.reset', 'villageLayout.resizeTop', 'villageLayout.resizeRoster',
      'villageLayout.resizeDetail', 'agentState.editing_files', 'agentState.offline',
      'agentConnection.awaitingAttach', 'agentConnection.stale',
    ]) {
      assert.notEqual(uiStrings.uiText(locale, key), key, `${locale}:${key}`);
    }
  }
});

test('getLocaleStrings returns translated HUD labels', () => {
  const zh = getLocaleStrings('zh-TW');
  const en = getLocaleStrings('en-US');
  const ja = getLocaleStrings('ja-JP');
  const ko = getLocaleStrings('ko-KR');

  assert.equal(zh.brandTitle, 'CLI_Pixelverse');
  assert.equal(zh.inspectorTitle, '狀態檢視器');
  assert.equal(zh.legendPlanningTitle, '規劃中');
  assert.equal(en.inspectorTitle, 'Inspector');
  assert.equal(en.inspectorAgentSelect, 'Select agent');
  assert.equal(en.legendIdleTitle, 'Idle');
  assert.equal(zh.hookStateTitle, 'Hook 狀態路由表');
  assert.equal(en.states.executing, 'Executing');
  assert.match(zh.layoutKeyboardHint, /Enter/);
  assert.match(zh.layoutChangesCount(3), /3/);
  assert.match(zh.layoutGridHint, /0.5%/);
  assert.match(zh.layoutCoordChip('42.0', '18.5'), /x 42.0%/);
  assert.match(en.layoutUnsavedChanges, /Unsaved/);
  assert.match(en.layoutSavedDetail(4, 2), /4/);
  assert.match(en.layoutSnapChip('1.0'), /1.0%/);
  assert.match(en.mobileMode, /Mobile/);
  assert.match(en.dashboardPanels, /Sidebar/);
  assert.match(en.showPanels, /Open/);
  assert.equal(en.dashboardEvents, 'Events');
  assert.equal(en.dashboardAgents, 'Agents');
  assert.equal(en.dashboardHelp, 'Help');
  assert.equal(zh.dashboardEvents, '事件');
  assert.equal(ja.dashboardAgents, 'エージェント');
  assert.equal(ko.dashboardHelp, '도움말');
  assert.equal(en.dashboardPage(2, 5), 'Page 2 of 5');
  assert.match(en.heartbeatLive('2s ago'), /2s ago/);
  assert.match(en.layoutCollisionTitle, /overlap/);
  assert.match(ja.layoutDragActiveHint, /ドラッグ中/);
  assert.match(ja.layoutExitConfirm, /未保存/);
  assert.match(ko.layoutPickHint, /드래그/);
  assert.match(ko.layoutSelectedHint, /방향키/);
});

test('getRoomDecor exposes furniture labels in both locales', () => {
  const zhDecor = getRoomDecor('think_lab', 'zh-TW');
  const enDecor = getRoomDecor('tool_forge', 'en-US');
  const standbyDecor = getRoomDecor('standby_dock', 'zh-TW');

  assert.ok(zhDecor.some(item => item.label.includes('書櫃')));
  assert.ok(enDecor.some(item => item.label.includes('Workbench')));
  assert.ok(standbyDecor.some(item => item.label.includes('休息床')));
});

test('summarizeWorld adapts to locale and hermes connectivity', () => {
  const stats = { hermes_connected: true };
  assert.match(summarizeWorld(stats, 'zh-TW'), /主代理會沿走廊移動到不同工位/);
  assert.match(summarizeWorld(stats, 'en-US'), /walks through hallways toward room workstations/i);
});

test('localizeToolSummary translates comma-separated tool names for English mode', () => {
  assert.equal(localizeToolSummary('read_file, patch, write_file', 'en-US'), 'Read File, Patch File, Write File');
  assert.equal(localizeToolSummary('read_file, patch, write_file', 'zh-TW'), '讀取檔案、修改檔案、寫入檔案');
});

test('Japanese and Korean dynamic dashboard events never fall through to English copy', () => {
  assert.equal(typeof uiStrings.eventTitleForLocale, 'function');
  assert.equal(typeof uiStrings.eventSummaryForLocale, 'function');
  if (typeof uiStrings.eventTitleForLocale !== 'function' || typeof uiStrings.eventSummaryForLocale !== 'function') return;
  const event = {
    kind: 'main.tool.started',
    payload: { action: { tool_name: 'read_file', preview: 'index.ts' } },
  };
  const completed = {
    kind: 'main.task.completed',
    payload: { action: {} },
  };
  const localizedKinds = [
    event,
    completed,
    { kind: 'heartbeat', payload: { state: 'working', task: 'read_file' } },
    { kind: 'action', payload: { action: { type: 'thought', message: 'Planning' } } },
    { kind: 'action', payload: { action: { type: 'tool', message: 'Tool step: patch' } } },
    { kind: 'action', payload: { action: { type: 'status', message: 'Status: waiting' } } },
    { kind: 'hermes.status', payload: { gateway_state: 'connected', active_sessions: 2 } },
  ];

  const localizedRows = (locale) => localizedKinds.map((item) => ({
    title: uiStrings.eventTitleForLocale(item, locale),
    summary: uiStrings.eventSummaryForLocale(item, locale),
  }));
  const japaneseRows = localizedRows('ja-JP');
  const koreanRows = localizedRows('ko-KR');
  const japanese = japaneseRows.flatMap(({ title, summary }) => [title, summary]).join(' · ');
  const korean = koreanRows.flatMap(({ title, summary }) => [title, summary]).join(' · ');

  assert.equal(japaneseRows.every(({ title, summary }) => title && summary), true);
  assert.equal(koreanRows.every(({ title, summary }) => title && summary), true);
  assert.equal(japaneseRows.every(({ title, summary }) => /[ぁ-んァ-ン一-龯]/.test(`${title}${summary}`)), true);
  assert.equal(koreanRows.every(({ title, summary }) => /[가-힣]/.test(`${title}${summary}`)), true);
  assert.match(japanese, /[ぁ-んァ-ン一-龯]/);
  assert.match(korean, /[가-힣]/);
  for (const rendered of [japanese, korean]) {
    for (const raw of ['read_file', 'Planning', 'Tool step: patch', 'Status: waiting']) assert.match(rendered, new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const productCopyOnly = ['read_file', 'Planning', 'Tool step: patch', 'Status: waiting'].reduce((value, raw) => value.replaceAll(raw, ''), rendered);
    assert.doesNotMatch(productCopyOnly, /\b(?:Main|Started|Finished|Returned|tool|task|State|Status|Gateway|Waiting|Read File)\b/i);
  }
});

test('catalog parity helper reports nested omissions precisely', () => {
  assert.equal(typeof uiStrings.missingLocaleKeys, 'function');
  if (typeof uiStrings.missingLocaleKeys !== 'function') return;
  assert.deepEqual(uiStrings.missingLocaleKeys({
    'en-US': { top: { title: 'Title', count: ({ count }) => `${count}` } },
    'zh-TW': { top: { title: '標題' } },
    'ja-JP': { top: { title: 'タイトル', count: ({ count }) => `${count}` } },
    'ko-KR': { top: { title: '제목', count: ({ count }) => `${count}` } },
  }), { 'zh-TW': ['top.count'] });
});

test('roster copy has exact four-locale parity and no supported-locale English fallback', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    assert.equal(uiStrings.localeCatalogComplete(locale), true);
    for (const key of [
      'title', 'needsYou', 'active', 'idle', 'offline',
      'signal.idle', 'signal.thinking', 'signal.working', 'signal.busy',
      'signal.blocked', 'signal.degraded', 'signal.offline',
    ]) {
      assert.notEqual(
        uiStrings.uiText(locale, `commandDeck.roster.${key}`, { count: 2 }),
        `commandDeck.roster.${key}`,
      );
    }
  }
  assert.equal(
    uiStrings.uiText('ja-JP', 'commandDeck.roster.missingKey'),
    'commandDeck.roster.missingKey',
  );
  assert.equal(uiStrings.uiText('fr-FR', 'commandDeck.roster.title'), 'Agent roster');
});

test('active interaction, activity, timeline, furniture, and pose copy has four-locale framing', () => {
  for (const name of [
    'interactionText', 'ambientText', 'activityHintForLocale', 'timelineItemForLocale',
    'furnitureCoordinateText', 'poseLabelForLocale',
  ]) assert.equal(typeof uiStrings[name], 'function');
  if (typeof uiStrings.interactionText !== 'function') return;
  const outputs = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR'].map((locale) => ({
    interaction: uiStrings.interactionText(locale, { propType: 'terminal', pose: { pose: 'terminal' } }),
    activity: uiStrings.activityHintForLocale(locale, { state: 'working', activity_hint: '產品生成文字' }, 'Workshop', 'RAW_TASK'),
    timeline: uiStrings.timelineItemForLocale(locale, { type: 'thought', preview: 'RAW_PREVIEW' }),
    coordinate: uiStrings.furnitureCoordinateText(locale, { room: 'Workshop', x: '1', y: '2', snap: '0.5', scale: '125%', propType: 'prop' }),
    pose: uiStrings.poseLabelForLocale(locale, 'terminal'),
  }));
  for (const key of ['interaction', 'activity', 'coordinate', 'pose']) {
    assert.equal(new Set(outputs.map((output) => output[key])).size, 4, key);
  }
  outputs.forEach(({ activity, timeline }) => {
    assert.doesNotMatch(activity, /RAW_TASK|產品生成文字/);
    assert.match(timeline.message, /RAW_PREVIEW/);
  });
});

test('acceptance catalog materializes every static and dynamic UI leaf without omissions', () => {
  assert.equal(typeof uiStrings.materializeUiCatalogForAcceptance, 'function');
  assert.equal(typeof uiStrings.uiCatalogLeafManifest, 'function');
  if (typeof uiStrings.materializeUiCatalogForAcceptance !== 'function') return;
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const manifest = uiStrings.uiCatalogLeafManifest(locale);
    const materialized = uiStrings.materializeUiCatalogForAcceptance(locale);
    assert.equal(manifest.omitted.length, 0, `${locale}: ${manifest.omitted.join(', ')}`);
    assert.equal(manifest.functionPaths.length, 43);
    assert.deepEqual(manifest.sourcePaths, manifest.materializedPaths);
    assert.equal(manifest.materializedPaths.length, Object.keys(materialized).length);
    for (const path of manifest.functionPaths) assert.equal(typeof materialized[path], 'string', `${locale}:${path}`);
  }
});

test('active formatters preserve complete long task, preview, and message fallback payloads', () => {
  const task = `read_file::${'TASK-LONG-'.repeat(14)}END-TASK`;
  const preview = `PREVIEW-LONG-${'preview-'.repeat(16)}END-PREVIEW`;
  const message = `MESSAGE-ONLY-${'message-'.repeat(16)}END-MESSAGE`;
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    assert.ok(uiStrings.ambientText(locale, { state: 'working' }, task).includes(task));
    const started = uiStrings.timelineItemForLocale(locale, { event_name: 'main.tool.started', tool_name: 'read_file', preview });
    const completed = uiStrings.timelineItemForLocale(locale, { event_name: 'main.tool.completed', tool_name: 'read_file', message });
    const both = uiStrings.timelineItemForLocale(locale, { event_name: 'main.tool.started', tool_name: 'read_file', preview, message });
    assert.ok(started.message.includes(preview));
    assert.ok(completed.message.includes(message));
    assert.ok(both.message.includes(preview));
    assert.equal(both.message.includes(message), false);
    assert.doesNotMatch(`${started.message}${completed.message}`, /…/);
    assert.ok(uiStrings.eventSummaryForLocale({ kind: 'main.tool.started', payload: { action: { tool_name: 'read_file', message } } }, locale).includes(message));
    assert.ok(uiStrings.eventSummaryForLocale({ kind: 'main.tool.completed', payload: { action: { tool_name: 'read_file', message } } }, locale).includes(message));
    assert.ok(uiStrings.eventSummaryForLocale({ kind: 'main.tool.batch', payload: { action: { tool_names: ['read_file'], preview } } }, locale).includes(preview));
    assert.ok(uiStrings.eventSummaryForLocale({ kind: 'heartbeat', payload: { state: 'working', task } }, locale).includes(task));
  }
});

test('task-start, tool-batch, and generic-tool timeline paths preserve preview/message exactly once', () => {
  const payloads = {
    preview: `<preview>&"'${'PREVIEW-BLOCK-'.repeat(12)}END-PREVIEW`,
    message: `<message>&"'${'MESSAGE-BLOCK-'.repeat(12)}END-MESSAGE`,
  };
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const localizedTool = uiStrings.localizeToolSummary('read_file', locale);
    for (const [field, raw] of Object.entries(payloads)) {
      const cases = [
        { rendered: uiStrings.timelineItemForLocale(locale, { event_name: 'main.task.started', [field]: raw }), expectsTool: false },
        { rendered: uiStrings.timelineItemForLocale(locale, { event_name: 'main.tool.batch', tool_names: ['read_file'], [field]: raw }, { toolRouteLabel: localizedTool }), expectsTool: true },
        { rendered: uiStrings.timelineItemForLocale(locale, { type: 'tool', tool_name: 'read_file', [field]: raw }, { toolLabel: localizedTool }), expectsTool: true },
      ];
      for (const { rendered, expectsTool } of cases) {
        assert.equal(rendered.message.split(raw).length - 1, 1, `${locale} ${field}: ${rendered.message}`);
        assert.doesNotMatch(rendered.message, /…/);
        if (expectsTool) {
          assert.equal(rendered.message.split(localizedTool).length - 1, 1, `${locale} ${field}: ${rendered.message}`);
          assert.ok(rendered.message.indexOf(localizedTool) < rendered.message.indexOf(raw), `${locale} ${field}: ${rendered.message}`);
        }
      }
    }
  }
});

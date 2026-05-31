import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLocaleStrings,
  getRoomDecor,
  localizeToolSummary,
  normalizeLocale,
  summarizeWorld,
} from '../public/ui_strings.mjs';

test('normalizeLocale falls back to English', () => {
  assert.equal(normalizeLocale('fr-FR'), 'en-US');
  assert.equal(normalizeLocale('en-US'), 'en-US');
});

test('getLocaleStrings returns translated HUD labels', () => {
  const zh = getLocaleStrings('zh-TW');
  const en = getLocaleStrings('en-US');
  const ja = getLocaleStrings('ja-JP');
  const ko = getLocaleStrings('ko-KR');

  assert.equal(zh.brandTitle, 'Hermes Pixelverse');
  assert.equal(zh.inspectorTitle, '狀態檢視器');
  assert.equal(zh.legendPlanningTitle, '規劃中');
  assert.equal(en.inspectorTitle, 'Inspector');
  assert.equal(en.legendIdleTitle, 'Idle');
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

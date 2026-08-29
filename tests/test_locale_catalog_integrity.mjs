import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  SUPPORTED_LOCALES,
  UI_CATALOG,
  missingLocaleKeys,
  uiText,
} from '../public/ui_strings.mjs';

const settingsKeys = [
  'appearance',
  'connection',
  'agentIntegration',
  'agentIntegrationDescription',
  'help',
  'helpDescription',
  'about',
  'uiVersion',
  'apiVersion',
  'buildRevision',
];

test('all four locales provide every unified settings label', () => {
  assert.deepEqual(missingLocaleKeys(UI_CATALOG), {});
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of settingsKeys) {
      const path = `commandDeck.settings.${key}`;
      const rendered = uiText(locale, path);
      assert.notEqual(rendered, path, `${locale} is missing ${path}`);
      assert.ok(rendered.length > 0, `${locale}.${path} is empty`);
    }
  }
});

test('settings headings are declaratively bound and app has no English fallback copy', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');

  for (const key of settingsKeys) {
    assert.ok(html.includes(`commandDeck.settings.${key}`), `HTML is missing ${key}`);
  }
  assert.doesNotMatch(app, /\|\| '(?:Copy URL|Exposure update failed|URL)'/);
});

test('English product settings copy contains no Traditional Chinese status fragments', () => {
  const english = settingsKeys
    .map((key) => uiText('en-US', `commandDeck.settings.${key}`))
    .join(' ');

  assert.doesNotMatch(english, /已選擇|等待新的|最近同步|設定|語言|說明|版本/);
});

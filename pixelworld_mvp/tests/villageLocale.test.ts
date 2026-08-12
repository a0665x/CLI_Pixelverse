import { describe, expect, it } from 'vitest';
import { localeMessage, normalizeVillageLocale, villageCopy } from '../src/i18n/villageLocale';

describe('village locale catalog', () => {
  it('validates supported locale messages and falls back safely', () => {
    expect(normalizeVillageLocale('en-US')).toBe('en-US');
    expect(normalizeVillageLocale('xx')).toBe('zh-TW');
    expect(localeMessage({ type: 'pixelverse.locale.update', locale: 'ja-JP', sequence: 7 }))
      .toEqual({ locale: 'ja-JP', sequence: 7 });
    expect(localeMessage({ type: 'other', locale: 'en-US' })).toBeUndefined();
  });

  it.each(['zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const)('provides complete visible copy for %s', (locale) => {
    const copy = villageCopy(locale);
    expect(Object.keys(copy.buildings)).toHaveLength(12);
    expect(copy.actions.tool).toBeTruthy();
    expect(copy.actions.idle).toBeTruthy();
    expect(copy.controls.fit).toBeTruthy();
    expect(copy.controls.cover).toBeTruthy();
    expect(copy.controls.zoomIn).toBeTruthy();
    expect(copy.cutaway.categories.workstations).toBeTruthy();
    expect(copy.cutaway.actions.save).toBeTruthy();
    expect(copy.cutaway.actions.undo).toBeTruthy();
    expect(copy.cutaway.actions.applyTemplate).toBeTruthy();
    expect(copy.cutaway.actions.previewTemplate).toBeTruthy();
    expect(copy.cutaway.actions.dissolveGroup).toBeTruthy();
    expect(copy.cutaway.status.templateInvalid).toBeTruthy();
    expect(copy.cutaway.status.unreachableHook).toBeTruthy();
    expect(copy.cutaway.status.storageFailed).toBeTruthy();
    expect(copy.cutaway.titles['research-library']).toBeTruthy();
  });

  it('does not retain Chinese building text in English mode', () => {
    expect(Object.values(villageCopy('en-US').buildings).join('')).not.toMatch(/[\u3400-\u9fff]/);
    expect(JSON.stringify(villageCopy('en-US').cutaway)).not.toMatch(/[\u3400-\u9fff]/);
  });
});

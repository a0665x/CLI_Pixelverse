import { describe, expect, it } from 'vitest';
import {
  CUTAWAY_OPERATION_MESSAGE_IDS,
  cutawayMessage,
  furnitureLayerLabel,
  localeMessage,
  normalizeVillageLocale,
  statusFailureMessage,
  villageCopy,
} from '../src/i18n/villageLocale';

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
    expect(copy.cutaway.status.undoApplied).toBeTruthy();
    expect(copy.cutaway.status.templatePreviewReady).toBeTruthy();
    expect(copy.cutaway.status.templateApplied).toBeTruthy();
    expect(copy.cutaway.status.groupDissolved).toBeTruthy();
    expect(copy.cutaway.titles['research-library']).toBeTruthy();
  });

  it('does not retain Chinese building text in English mode', () => {
    expect(Object.values(villageCopy('en-US').buildings).join('')).not.toMatch(/[\u3400-\u9fff]/);
    expect(JSON.stringify(villageCopy('en-US').cutaway)).not.toMatch(/[\u3400-\u9fff]/);
  });

  it.each(['en-US', 'ja-JP', 'ko-KR'] as const)('provides localized editor workflow feedback for %s', (locale) => {
    const status = villageCopy(locale).cutaway.status;
    expect(new Set([
      status.undoApplied,
      status.templatePreviewReady,
      status.templateApplied,
      status.groupDissolved,
      status.storageFailed,
    ]).size).toBe(5);
    if (locale === 'en-US') expect(JSON.stringify(status)).not.toMatch(/[\u3400-\u9fff]/);
  });

  it.each(['zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const)(
    'provides parameterized operational editor, selection, storage, and error copy for %s',
    (locale) => {
      expect(cutawayMessage(locale, 'selectionCompleted', { count: 3 })).toContain('3');
      expect(cutawayMessage(locale, 'prefabPlaced', { name: 'Desk Set' })).toContain('Desk Set');
      expect(cutawayMessage(locale, 'resizeApplied', { percent: 125 })).toContain('125');
      expect(cutawayMessage(locale, 'returnedToShelf', { count: 2 })).toContain('2');
      expect(cutawayMessage(locale, 'storageFailed')).toBe(villageCopy(locale).cutaway.status.storageFailed);
      expect(statusFailureMessage(locale, 'no-path')).toBeTruthy();
    },
  );

  it('requires parameters exactly for placeholder-bearing operation messages', () => {
    // @ts-expect-error selectionCompleted requires a count.
    void cutawayMessage('en-US', 'selectionCompleted');
    // @ts-expect-error ready has no parameter bag.
    void cutawayMessage('en-US', 'ready', { count: 1 });
  });

  it('contains no CJK in any serialized English operational UI message', () => {
    const rendered = [
      ...CUTAWAY_OPERATION_MESSAGE_IDS.map((id) => cutawayMessage('en-US', id, {
        count: 2, name: 'Desk Set', percent: 125, label: 'Office 001', diagnostic: 'blocks-door',
      })),
      cutawayMessage('en-US', 'ready'),
      cutawayMessage('en-US', 'selectionCompleted', { count: 2 }),
      cutawayMessage('en-US', 'placementRejected', { diagnostic: 'blocks-door' }),
      cutawayMessage('en-US', 'prefabCreated', { name: 'Desk Set' }),
      cutawayMessage('en-US', 'returnedToShelf', { count: 2 }),
      statusFailureMessage('en-US', 'station-full'),
      statusFailureMessage('en-US', 'no-path'),
      statusFailureMessage('en-US', 'clone-queue'),
      statusFailureMessage('en-US', 'agent-cap'),
      furnitureLayerLabel('en-US', 'floor'),
      furnitureLayerLabel('en-US', 'furniture'),
      furnitureLayerLabel('en-US', 'surface'),
      furnitureLayerLabel('en-US', 'wall'),
    ];
    expect(JSON.stringify(rendered)).not.toMatch(/[\u3400-\u9fff]/);
  });
});

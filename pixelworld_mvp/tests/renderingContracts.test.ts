import { describe, expect, it } from 'vitest';
import { PROP_ASSETS, villageAssetEntries } from '../src/rendering/assetManifest';

describe('village asset manifest', () => {
  it('provides a unique preload key and copied path for every AppleDog prop', () => {
    expect(PROP_ASSETS).toMatchObject({
      appleTerminal: '/assets/appledog/terminal.png',
      appleSmallTerminal: '/assets/appledog/small-terminal.png',
      appleDesk: '/assets/appledog/office-table.png',
      appleSofa: '/assets/appledog/lounge-sofa.png',
      applePlant: '/assets/appledog/plant.png',
    });

    const entries = villageAssetEntries();
    expect(new Set(entries.map(([key]) => key)).size).toBe(entries.length);
    expect(entries).toEqual(expect.arrayContaining([
      ['prop-appleTerminal', '/assets/appledog/terminal.png'],
      ['prop-appleSmallTerminal', '/assets/appledog/small-terminal.png'],
      ['prop-appleDesk', '/assets/appledog/office-table.png'],
      ['prop-appleSofa', '/assets/appledog/lounge-sofa.png'],
      ['prop-applePlant', '/assets/appledog/plant.png'],
    ]));
  });
});

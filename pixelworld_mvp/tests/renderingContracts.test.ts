import { describe, expect, it } from 'vitest';
import { AGENT_ATLAS, PROP_ASSETS, WORLD_ATLAS, villageAssetEntries } from '../src/rendering/assetManifest';

describe('village asset manifest', () => {
  it('uses only the curated CC0 world and agent sprite sheets', () => {
    const sheets = [WORLD_ATLAS, ...Object.values(AGENT_ATLAS)];

    expect(WORLD_ATLAS.path).toBe('/assets/puny-world/punyworld-overworld-tileset.png');
    expect(Object.values(AGENT_ATLAS).map((sheet) => sheet.path)).toEqual([
      '/assets/ninja-adventure/ninja-blue.png',
      '/assets/ninja-adventure/samurai-blue.png',
      '/assets/ninja-adventure/samurai-green.png',
    ]);
    for (const sheet of sheets) {
      expect(sheet).toMatchObject({ frameWidth: 16, frameHeight: 16 });
      expect(sheet.path).not.toMatch(/pokemon|essentials|ruby|sapphire|rip/i);
    }
  });

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

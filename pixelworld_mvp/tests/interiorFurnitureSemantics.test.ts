import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  nearestSemanticStation,
  semanticForAction,
  semanticForFurniture,
} from '../src/rendering/interiorFurnitureSemantics';
import { missingSemanticFurnitureCopy } from '../src/rendering/interiorLocale';

const furniture = (
  id: string,
  kind: FurnitureDefinition['kind'],
  point: FurnitureDefinition['point'],
  extras: Partial<FurnitureDefinition> = {},
): FurnitureDefinition => ({
  id, kind, point, facing: 'up', supportedActions: [], icon: 'generic',
  blocksNavigation: true, ...extras,
});

const room = (items: FurnitureDefinition[]): InteriorDefinition => ({
  id: 'maker-workshop', label: 'Semantic test room', width: 9, height: 7,
  floor: 'tile', wall: 'brick', furniture: items, overflow: [],
});

describe('interior furniture semantics', () => {
  it('maps fine-grained actions into the three user-facing Hook categories', () => {
    expect(semanticForAction('rest')).toBe('rest');
    expect(semanticForAction('offline')).toBe('rest');
    expect(semanticForAction('read')).toBe('search');
    expect(semanticForAction('signal')).toBe('search');
    expect(semanticForAction('terminal')).toBe('work');
    expect(semanticForAction('repair')).toBe('work');
  });

  it('derives furniture semantics without depending on an exact ID or requirementId', () => {
    expect(semanticForFurniture(furniture('custom-lounge', 'sofa', { x: 1, y: 1 }))).toBe('rest');
    expect(semanticForFurniture(furniture('custom-archive', 'cabinet', { x: 1, y: 1 }))).toBe('search');
    expect(semanticForFurniture(furniture('custom-desk', 'desk', { x: 1, y: 1 }))).toBe('work');
    expect(semanticForFurniture(furniture('legacy-tool', 'decor', { x: 1, y: 1 }, {
      supportedActions: ['terminal'], requirementId: 'obsolete:terminal',
    }))).toBe('work');
    expect(semanticForFurniture(furniture('catalog-workstation', 'decor', { x: 1, y: 1 }, {
      assetId: 247,
    }))).toBe('work');
  });

  it.each([207, 208, 209])('does not treat decorative glass divider asset %i as Search furniture', (assetId) => {
    expect(semanticForFurniture(furniture(`divider-${assetId}`, 'decor', { x: 1, y: 1 }, {
      assetId,
    }))).toBeUndefined();
  });

  it('chooses the nearest reachable adjacent station and rejects a blocked nearer item', () => {
    const blockedDesk = furniture('a-blocked-near', 'desk', { x: 4, y: 2 }, {
      interactionPoint: { x: 4, y: 3 },
    });
    const reachableDesk = furniture('z-reachable-far', 'desk', { x: 1, y: 1 }, {
      interactionPoint: { x: 1, y: 2 },
    });
    const blockers = [
      furniture('wall-left', 'decor', { x: 3, y: 3 }),
      furniture('wall-right', 'decor', { x: 5, y: 3 }),
      furniture('wall-up', 'decor', { x: 4, y: 2 }),
      furniture('wall-down', 'decor', { x: 4, y: 4 }),
    ];
    const station = nearestSemanticStation(
      room([blockedDesk, reachableDesk, ...blockers]),
      'terminal',
      { x: 4, y: 6 },
    );

    expect(station).toEqual({ furnitureId: 'z-reachable-far', point: { x: 1, y: 2 } });
  });

  it('uses furniture ID as a stable tie-breaker for equally near stations', () => {
    const candidateRoom = room([
      furniture('z-desk', 'desk', { x: 6, y: 2 }, { interactionPoint: { x: 6, y: 4 } }),
      furniture('a-desk', 'desk', { x: 2, y: 2 }, { interactionPoint: { x: 2, y: 4 } }),
    ]);

    expect(nearestSemanticStation(candidateRoom, 'terminal', { x: 4, y: 6 })?.furnitureId).toBe('a-desk');
  });

  it('does not reach an adjacent interaction point by walking through its station', () => {
    const station = furniture('selected-desk', 'desk', { x: 1, y: 2 }, {
      interactionPoint: { x: 1, y: 1 },
    });
    const barrier = [
      furniture('left-blocker', 'decor', { x: 0, y: 2 }),
      furniture('right-blocker', 'decor', { x: 2, y: 2 }),
    ];
    const narrowRoom = { ...room([station, ...barrier]), width: 3, height: 5 };

    expect(nearestSemanticStation(narrowRoom, 'terminal', { x: 1, y: 4 })).toBeUndefined();
  });

  it('localizes concise missing-category feedback in every supported locale', () => {
    expect(missingSemanticFurnitureCopy('en-US', 'rest')).toContain('Rest');
    expect(missingSemanticFurnitureCopy('zh-TW', 'search')).toContain('搜尋');
    expect(missingSemanticFurnitureCopy('ja-JP', 'work')).toContain('作業');
    expect(missingSemanticFurnitureCopy('ko-KR', 'work')).toContain('작업');
  });
});

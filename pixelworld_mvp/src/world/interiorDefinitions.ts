import type {
  ActivityIconKind,
  AgentAction,
  BuildingThemeId,
  Facing,
  FurnitureDefinition,
  FurnitureKind,
  InteriorDefinition,
} from './types';

const furniture = (
  id: string,
  kind: FurnitureKind,
  x: number,
  y: number,
  facing: Facing,
  supportedActions: AgentAction[],
  icon: ActivityIconKind,
): FurnitureDefinition => ({ id, kind, point: { x, y }, facing, supportedActions, icon });

const FURNITURE_FOOTPRINTS: Record<FurnitureKind, { width: number; height: number }> = {
  sofa: { width: 2, height: 2 }, chair: { width: 1, height: 1 }, television: { width: 2, height: 2 },
  bed: { width: 2, height: 3 }, bookcase: { width: 2, height: 2 }, computer: { width: 1, height: 2 },
  'map-table': { width: 3, height: 2 }, 'planning-board': { width: 2, height: 2 },
  'reading-desk': { width: 3, height: 2 }, workbench: { width: 3, height: 2 },
  'tool-wall': { width: 2, height: 2 }, 'repair-table': { width: 3, height: 2 },
  'dispatch-pod': { width: 2, height: 2 }, 'radio-console': { width: 2, height: 2 },
  'response-desk': { width: 2, height: 2 }, 'meeting-table': { width: 3, height: 2 },
  decor: { width: 1, height: 1 },
  'office-chair': { width: 1, height: 1 }, display: { width: 2, height: 2 },
  desk: { width: 3, height: 2 }, cabinet: { width: 2, height: 2 }, plant: { width: 1, height: 2 },
  'beverage-station': { width: 1, height: 2 }, printer: { width: 2, height: 2 },
};

export const furnitureFootprint = (kind: FurnitureKind): { width: number; height: number } => ({
  ...FURNITURE_FOOTPRINTS[kind],
});

export const INTERIOR_DEFINITIONS: Record<BuildingThemeId, InteriorDefinition> = {
  'rest-cabin': {
    id: 'rest-cabin', label: 'REST CABIN · 休息小屋', width: 14, height: 9, floor: 'wood', wall: 'cream',
    furniture: [
      furniture('rest-sofa-a', 'sofa', 4, 5, 'down', ['rest'], 'rest'),
      furniture('rest-sofa-b', 'sofa', 8, 5, 'down', ['rest', 'queue'], 'rest'),
      furniture('rest-tv', 'television', 6, 1, 'up', [], 'generic'),
      furniture('rest-bed-a', 'bed', 11, 3, 'right', ['offline'], 'offline'),
      furniture('rest-bed-b', 'bed', 11, 7, 'right', ['offline'], 'offline'),
      furniture('rest-coffee-table', 'decor', 6, 7, 'down', [], 'generic'),
      furniture('rest-lamp', 'decor', 1, 6, 'down', [], 'generic'),
      furniture('rest-plant', 'decor', 12, 1, 'down', [], 'generic'),
      furniture('rest-blocked-board', 'planning-board', 2, 1, 'up', ['repair'], 'repair'),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 4 }],
  },
  'research-library': {
    id: 'research-library', label: 'RESEARCH LIBRARY · 研究圖書館', width: 14, height: 9, floor: 'wood', wall: 'blue',
    furniture: [
      furniture('research-planning-a', 'planning-board', 2, 1, 'up', ['ponder', 'plan'], 'plan'),
      furniture('research-map-a', 'map-table', 5, 4, 'down', ['ponder', 'plan'], 'think'),
      furniture('research-reading-a', 'reading-desk', 2, 7, 'down', ['read'], 'read'),
      furniture('research-reading-b', 'reading-desk', 5, 7, 'down', ['read'], 'read'),
      furniture('research-computer-a', 'computer', 8, 2, 'up', ['signal'], 'web'),
      furniture('research-computer-b', 'computer', 11, 2, 'up', ['signal'], 'web'),
      furniture('research-chair-a', 'chair', 8, 4, 'up', [], 'generic'),
      furniture('research-chair-b', 'chair', 11, 4, 'up', [], 'generic'),
      furniture('research-bookcase-a', 'bookcase', 9, 6, 'right', ['signal', 'read'], 'web'),
      furniture('research-bookcase-b', 'bookcase', 12, 6, 'right', ['signal', 'read'], 'web'),
      furniture('research-cabinet', 'decor', 13, 1, 'down', [], 'generic'),
      furniture('research-plant', 'decor', 6, 1, 'down', [], 'generic'),
    ],
    overflow: [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 4 }],
  },
  'maker-workshop': {
    id: 'maker-workshop', label: 'MAKER WORKSHOP · 製作工坊', width: 14, height: 9, floor: 'tile', wall: 'brick',
    furniture: [
      furniture('maker-terminal-a', 'computer', 2, 2, 'up', ['type', 'terminal'], 'edit'),
      furniture('maker-terminal-b', 'computer', 5, 2, 'up', ['type', 'terminal'], 'tool'),
      furniture('maker-chair-a', 'chair', 2, 4, 'up', [], 'generic'),
      furniture('maker-chair-b', 'chair', 5, 4, 'up', [], 'generic'),
      furniture('maker-workbench-a', 'workbench', 8, 4, 'down', ['terminal'], 'tool'),
      furniture('maker-workbench-b', 'workbench', 11, 4, 'down', ['terminal'], 'tool'),
      furniture('maker-tool-wall-a', 'tool-wall', 9, 1, 'up', ['terminal'], 'tool'),
      furniture('maker-tool-wall-b', 'tool-wall', 12, 1, 'up', ['terminal'], 'tool'),
      furniture('maker-tool-books', 'bookcase', 12, 7, 'right', ['terminal'], 'tool'),
      furniture('maker-tool-board', 'planning-board', 8, 7, 'up', ['terminal'], 'tool'),
      furniture('maker-repair-a', 'repair-table', 2, 6, 'down', ['repair'], 'repair'),
      furniture('maker-repair-b', 'repair-table', 5, 6, 'down', ['repair'], 'repair'),
      furniture('maker-parts', 'decor', 13, 4, 'down', [], 'generic'),
      furniture('maker-crates', 'decor', 10, 7, 'down', [], 'generic'),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 6 }],
  },
  'collaboration-barn': {
    id: 'collaboration-barn', label: 'COLLABORATION BARN · 協作穀倉', width: 14, height: 9, floor: 'wood', wall: 'green',
    furniture: [
      furniture('collab-dispatch-a', 'dispatch-pod', 2, 2, 'up', ['dispatch'], 'clone'),
      furniture('collab-dispatch-b', 'dispatch-pod', 5, 2, 'up', ['dispatch'], 'clone'),
      furniture('collab-radio-a', 'radio-console', 9, 2, 'up', ['respond', 'pulse'], 'respond'),
      furniture('collab-radio-b', 'response-desk', 12, 2, 'up', ['respond'], 'respond'),
      furniture('collab-chair-a', 'chair', 2, 4, 'up', [], 'generic'),
      furniture('collab-chair-b', 'chair', 5, 4, 'up', [], 'generic'),
      furniture('collab-chair-c', 'chair', 9, 4, 'up', [], 'generic'),
      furniture('collab-chair-d', 'chair', 12, 4, 'up', [], 'generic'),
      furniture('collab-meeting', 'meeting-table', 7, 6, 'down', ['arrive', 'queue'], 'generic'),
      furniture('collab-message-board', 'decor', 7, 1, 'up', [], 'generic'),
      furniture('collab-storage-a', 'decor', 12, 7, 'down', [], 'generic'),
      furniture('collab-storage-b', 'decor', 2, 7, 'down', [], 'generic'),
    ],
    overflow: [{ x: 6, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 6 }],
  },
};

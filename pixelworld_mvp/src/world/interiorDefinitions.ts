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

export const INTERIOR_DEFINITIONS: Record<BuildingThemeId, InteriorDefinition> = {
  'rest-cabin': {
    id: 'rest-cabin', label: 'REST CABIN · 休息小屋', width: 14, height: 9, floor: 'wood', wall: 'cream',
    furniture: [
      furniture('rest-sofa-a', 'sofa', 4, 6, 'down', ['rest'], 'rest'),
      furniture('rest-sofa-b', 'sofa', 6, 6, 'down', ['rest'], 'rest'),
      furniture('rest-tv', 'television', 5, 2, 'up', [], 'generic'),
      furniture('rest-bed-a', 'bed', 10, 4, 'right', ['offline'], 'offline'),
      furniture('rest-bed-b', 'bed', 11, 6, 'right', ['offline'], 'offline'),
      furniture('rest-coffee-table', 'decor', 5, 4, 'down', [], 'generic'),
      furniture('rest-lamp', 'decor', 2, 5, 'down', [], 'generic'),
      furniture('rest-plant', 'decor', 12, 2, 'down', [], 'generic'),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 4 }],
  },
  'research-library': {
    id: 'research-library', label: 'RESEARCH LIBRARY · 研究圖書館', width: 14, height: 9, floor: 'wood', wall: 'blue',
    furniture: [
      furniture('research-planning-a', 'planning-board', 3, 2, 'up', ['ponder', 'plan'], 'plan'),
      furniture('research-map-a', 'map-table', 5, 4, 'down', ['ponder', 'plan'], 'think'),
      furniture('research-reading-a', 'reading-desk', 3, 6, 'down', ['read'], 'read'),
      furniture('research-reading-b', 'reading-desk', 5, 6, 'down', ['read'], 'read'),
      furniture('research-computer-a', 'computer', 9, 3, 'up', ['signal'], 'web'),
      furniture('research-computer-b', 'computer', 11, 3, 'up', ['signal'], 'web'),
      furniture('research-bookcase-a', 'bookcase', 9, 6, 'right', ['signal', 'read'], 'web'),
      furniture('research-bookcase-b', 'bookcase', 11, 6, 'right', ['signal', 'read'], 'web'),
      furniture('research-cabinet', 'decor', 12, 2, 'down', [], 'generic'),
      furniture('research-plant', 'decor', 7, 2, 'down', [], 'generic'),
    ],
    overflow: [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 4 }],
  },
  'maker-workshop': {
    id: 'maker-workshop', label: 'MAKER WORKSHOP · 製作工坊', width: 14, height: 9, floor: 'tile', wall: 'brick',
    furniture: [
      furniture('maker-terminal-a', 'computer', 3, 3, 'up', ['type'], 'edit'),
      furniture('maker-terminal-b', 'computer', 5, 3, 'up', ['type'], 'edit'),
      furniture('maker-workbench-a', 'workbench', 8, 4, 'down', ['terminal'], 'tool'),
      furniture('maker-workbench-b', 'workbench', 10, 4, 'down', ['terminal'], 'tool'),
      furniture('maker-tool-wall-a', 'tool-wall', 8, 2, 'up', ['terminal'], 'tool'),
      furniture('maker-tool-wall-b', 'tool-wall', 10, 2, 'up', ['terminal'], 'tool'),
      furniture('maker-repair-a', 'repair-table', 4, 6, 'down', ['repair'], 'repair'),
      furniture('maker-repair-b', 'repair-table', 6, 6, 'down', ['repair'], 'repair'),
      furniture('maker-parts', 'decor', 12, 3, 'down', [], 'generic'),
      furniture('maker-crates', 'decor', 11, 6, 'down', [], 'generic'),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 6 }],
  },
  'collaboration-barn': {
    id: 'collaboration-barn', label: 'COLLABORATION BARN · 協作穀倉', width: 14, height: 9, floor: 'wood', wall: 'green',
    furniture: [
      furniture('collab-dispatch-a', 'dispatch-pod', 3, 3, 'up', ['dispatch'], 'clone'),
      furniture('collab-dispatch-b', 'dispatch-pod', 5, 3, 'up', ['dispatch'], 'clone'),
      furniture('collab-radio-a', 'radio-console', 9, 3, 'up', ['respond'], 'respond'),
      furniture('collab-radio-b', 'response-desk', 11, 3, 'up', ['respond'], 'respond'),
      furniture('collab-meeting', 'meeting-table', 7, 6, 'down', [], 'generic'),
      furniture('collab-message-board', 'decor', 7, 2, 'up', [], 'generic'),
      furniture('collab-storage-a', 'decor', 11, 6, 'down', [], 'generic'),
      furniture('collab-storage-b', 'decor', 3, 6, 'down', [], 'generic'),
    ],
    overflow: [{ x: 6, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 6 }],
  },
};

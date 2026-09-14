import { placeOfficePrefab, officeLayoutIssues } from '../rendering/prefabGeometry';
import { interiorPath, interiorInteractionPoint } from '../rendering/interiorMotion';
import type { AgentAction, FurnitureDefinition, FurnitureKind, InteriorDefinition, WorldBuilding } from './types';
import { builtInPrefab } from '../rendering/builtInOfficePrefabs';
import { catalogItem } from '../rendering/modernOfficeCatalog';

// Authored per building. Empty central lanes connect the south door to each activity nook.
type Item = [string, FurnitureKind, number, number, number, AgentAction[]?];
const PROGRAMS: Record<string, Item[]> = {
  'arrival-lodge': [
    ['reception', 'meeting-table', 1007, 3, 3, ['arrive','queue']],
    ['dispatch', 'computer', 225, 10, 3, ['dispatch','respond','pulse']],
    ['notice', 'planning-board', 171, 6.5, 1.5],
    ['bench', 'sofa', 1004, 3, 6, ['rest']], ['supplies', 'bookcase', 1002, 11, 6],
  ],
  'thinkers-cottage': [
    ['map', 'map-table', 1007, 5, 5, ['ponder','plan']],
    ['reading', 'reading-desk', 225, 13, 3, ['read','signal']],
    ['ideas', 'planning-board', 171, 5, 1.5],
    ['armchair', 'sofa', 199, 13, 8, ['rest']], ['notes', 'bookcase', 1002, 2, 2],
  ],
  'archive-library': [
    ['index-west', 'bookcase', 1002, 2, 2], ['index-east', 'bookcase', 1002, 15, 2],
    ['reading-west', 'reading-desk', 225, 4, 6, ['read','ponder']],
    ['reading-east', 'reading-desk', 225, 13, 6, ['read','signal']],
    ['catalog', 'planning-board', 170, 8, 1.5, ['plan']], ['reading-seat', 'sofa', 199, 3, 9, ['rest']],
  ],
  'network-lab': [
    ['console-west', 'computer', 311, 4, 3, ['signal','read','terminal']],
    ['console-east', 'computer', 312, 13, 3, ['signal','ponder']],
    ['network-map', 'planning-board', 172, 8, 1.5, ['plan']],
    ['equipment', 'bookcase', 1002, 15, 8], ['lounge', 'sofa', 1004, 4, 8, ['rest']],
  ],
  'heartbeat-tower': [
    ['radio', 'radio-console', 311, 4, 3, ['pulse','respond']],
    ['dispatch', 'dispatch-pod', 312, 13, 3, ['dispatch']],
    ['meeting', 'meeting-table', 1007, 5, 8, ['arrive','queue']],
    ['clock', 'planning-board', 172, 8, 1.5], ['refreshment', 'beverage-station', 173, 15, 8],
  ],
  'offline-dormitory': [
    ['bunk-west', 'bed', 1001, 3, 3, ['offline']], ['bunk-east', 'bed', 1001, 10, 3, ['offline']],
    ['rest-seat', 'sofa', 199, 3, 6, ['rest','queue']],
    ['care', 'planning-board', 170, 10, 6, ['repair']], ['locker', 'bookcase', 1002, 6.5, 1.5],
  ],
  'maker-workshop': [
    ['drawing', 'workbench', 1007, 4, 4, ['type','terminal']],
    ['assembly', 'repair-table', 323, 13, 5, ['repair']],
    ['plan', 'planning-board', 171, 7, 1.5], ['tools', 'bookcase', 1002, 2, 1.5],
    ['terminal', 'computer', 225, 4, 8, ['type']], ['rest', 'sofa', 199, 14, 9, ['rest']],
  ],
  'tool-smithy': [
    ['workbench', 'workbench', 1007, 5, 5, ['terminal']],
    ['terminal', 'computer', 311, 13, 3, ['terminal','type']],
    ['repair', 'repair-table', 323, 13, 8, ['repair']],
    ['tool-rack', 'bookcase', 1002, 2, 2], ['orders', 'planning-board', 170, 6, 1.5],
  ],
  'awaiting-post': [
    ['waiting-west', 'sofa', 1004, 3, 5, ['queue','arrive']],
    ['waiting-east', 'sofa', 1004, 10, 5, ['queue']],
    ['post-desk', 'response-desk', 225, 3, 2, ['respond','dispatch','pulse']],
    ['notices', 'planning-board', 171, 9, 1.5], ['drinks', 'beverage-station', 173, 11, 7],
  ],
  'collaboration-barn': [
    ['guild-table', 'meeting-table', 1007, 5, 5, ['arrive','queue','dispatch']],
    ['dispatch', 'dispatch-pod', 311, 13, 3, ['dispatch','pulse']],
    ['scribe', 'response-desk', 225, 13, 8, ['respond']],
    ['quest-board', 'planning-board', 171, 6, 1.5], ['guild-sofa', 'sofa', 1004, 3, 9, ['rest']],
  ],
  'recovery-clinic': [
    ['care-west', 'repair-table', 323, 4, 4, ['repair']],
    ['care-east', 'repair-table', 323, 13, 4, ['repair']],
    ['diagnostic', 'computer', 225, 13, 8, ['type','terminal']],
    ['recovery-seat', 'sofa', 1004, 4, 8, ['rest']], ['supplies', 'bookcase', 1002, 8, 1.5],
  ],
  'rest-cabin': [
    ['sofa', 'sofa', 1004, 3, 4, ['rest','queue']],
    ['armchair', 'sofa', 199, 10, 5, ['rest']],
    ['sleeping-nook', 'bed', 1001, 10, 2, ['offline']],
    ['care-notice', 'planning-board', 170, 3, 1.25, ['repair']],
    ['tea-table', 'meeting-table', 1007, 3, 6.5],
  ],
};

function makeItem(buildingId: string, [id, kind, assetId, x, y, actions = []]: Item): FurnitureDefinition {
  const asset = catalogItem(assetId)!;
  const wall = kind === 'planning-board';
  return {
    id: `${buildingId}-${id}`, kind, assetId, point: { x, y },
    facing: 'up', supportedActions: [...actions], icon: 'generic',
    footprint: { ...asset.footprint }, visualOffset: { x: 0, y: 0 },
    layer: wall ? 'wall' : 'furniture', scale: 1, rotation: 0, zIndex: 0,
    blocksNavigation: true,
    ...(actions.length ? { interactionPoint: { x, y: y + 1.5 } } : {}),
  };
}

const officeCache = new Map<string, InteriorDefinition>();
export function authoredVillageInterior(building: WorldBuilding): InteriorDefinition | undefined {
  const cached = officeCache.get(building.id);
  if (cached) return structuredClone(cached);
  const program = PROGRAMS[building.id];
  if (!program) return undefined;
  const compact = building.interiorProfile === 'compact';
  const width = compact ? 14 : 18;
  const height = compact ? 9 : 12;
  const furniture = program.flatMap(item => {
    const base = makeItem(building.id, item);
    if (!['computer','reading-desk','response-desk','radio-console','dispatch-pod'].includes(base.kind)) return [base];
    // One complete paid-asset workstation: connected desk, screen, paperwork and rolling chair.
    const source = builtInPrefab('bench-four')!;
    const ids = ['bench-desk-sw','bench-monitor-sw','bench-chair-sw','bench-papers-sw'];
    const group = `${base.id}-office`;
    return source.items.filter(part => ids.includes(part.id)).map(part => {
      const desk = part.id === 'bench-desk-sw';
      return {
        ...part, id: desk ? base.id : `${base.id}-${part.id}`, prefabInstanceId: group,
        point: {x: base.point.x + part.point.x, y: base.point.y + part.point.y - 2},
        supportedActions: desk ? [...base.supportedActions] : [],
        ...(desk ? { interactionPoint: { x: base.point.x, y: base.point.y + 1 } } : {}),
        ...(part.supportedByIds ? { supportedByIds: [base.id] } : {}),
      };
    });
  });
  // Plants frame the entrance; each desk gets a grounded accessory rather than loose sprites.
  furniture.push(makeItem(building.id, ['plant', 'plant', 98, width - 2, 1.25]));
  furniture.push(makeItem(building.id, ['door-plant', 'plant', 99, width - 2, height - 1.5]));
  for (const shelf of [...furniture].filter(item => item.kind === 'bookcase')) {
    // Continuous three-piece office storage replaces the tiny domestic bookcase.
    shelf.assetId = 180; shelf.footprint = {...catalogItem(180)!.footprint};
    shelf.prefabInstanceId = `${shelf.id}-run`;
    for (const [dx,id] of [[-1,179],[1,181]] as const) {
      furniture.push({...makeItem(building.id,[`${shelf.id}-${id}`,'cabinet',id,shelf.point.x+dx,shelf.point.y]),prefabInstanceId:shelf.prefabInstanceId});
    }
  }
  const table = furniture.find(item => ['meeting-table','workbench','map-table'].includes(item.kind));
  if (table) {
    const accessory = makeItem(building.id, ['table-notes','decor',120,table.point.x,table.point.y]);
    accessory.scale = 2;
    accessory.point.y -= .25;
    const groupId = `${building.id}-table-setting`;
    table.prefabInstanceId = groupId;
    furniture.push({ ...accessory, prefabInstanceId: groupId, layer: 'surface', blocksNavigation: false, supportedByIds: [table.id], zIndex: 1 });
  }
  const room: InteriorDefinition = {
    id: building.themeId, label: building.label, width, height,
    floor: ['tool-smithy','network-lab','recovery-clinic'].includes(building.id) ? 'tile' : 'wood',
    wall: building.themeId === 'research-library' ? 'blue' : building.themeId === 'maker-workshop' ? 'brick' : 'cream',
    furniture, overflow: [{ x: width / 2, y: height - 2 }, { x: width / 2 - 1, y: height - 2 }],
  };
  // Choose one connected desk bank without sacrificing access to existing hook stations.
  const door = {x: Math.floor(width / 2), y: height - 1};
  const candidates = [
    {x:width/2-2,y:2}, {x:width/2-2,y:height-5}, {x:2,y:height-5},
    {x:width-5,y:height-5}, {x:width/2,y:1}, {x:2,y:2},
  ];
  const fullBank=builtInPrefab('bench-four')!;
  const smallBank={...fullBank,items:fullBank.items.filter(f=>['bench-desk-sw','bench-monitor-sw','bench-chair-sw','bench-papers-sw'].includes(f.id)),interactionAnchors:[fullBank.interactionAnchors[2]!]};
  const proposals=[...candidates.map(anchor=>({anchor,prefab:fullBank})),
    ...candidates.map(anchor=>({anchor,prefab:smallBank})),
    ...[4,6,8].flatMap(x=>[1,3].map(y=>({anchor:{x,y},prefab:smallBank})))];
  for (const {anchor,prefab} of proposals) {
    const placed = placeOfficePrefab(room,room.furniture,prefab,anchor,0);
    if (!placed.accepted) continue;
    const candidate = {...room,furniture:placed.layout};
    if (officeLayoutIssues(candidate).length) continue;
    if (!candidate.furniture.filter(f=>f.supportedActions.length).every(f=>{
      const target=interiorInteractionPoint(candidate,f);
      const end=interiorPath(candidate,door,target,f.id).at(-1);
      return end?.x===target.x&&end?.y===target.y;
    })) continue;
    // Stable IDs keep saved layouts independent of initialization order.
    const rename = new Map(placed.layout.filter(f=>!room.furniture.some(old=>old.id===f.id)).map((f,i)=>[f.id,`${building.id}-team-${i}`]));
    room.furniture=placed.layout.map(f=>({...f,id:rename.get(f.id)||f.id,
      ...(rename.has(f.id)?{prefabInstanceId:`${building.id}-team`}:{}),
      ...(f.supportedByIds?{supportedByIds:f.supportedByIds.map(id=>rename.get(id)||id)}:{})}));
    break;
  }
  officeCache.set(building.id,structuredClone(room));
  return room;
}

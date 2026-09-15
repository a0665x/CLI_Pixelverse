import {it,expect} from 'vitest';
import {officeFamily,OFFICE_PACK} from '../src/rendering/officePack';
import {catalogItem} from '../src/rendering/modernOfficeCatalog';
it('preserves Archive Library furniture identities instead of classifying its sofa as storage',()=>{expect(officeFamily(catalogItem(199)!)).toBe('sofa');expect(officeFamily(catalogItem(170)!)).toBe('board');expect(officeFamily(catalogItem(1002)!)).toBe('bookcase');expect(officeFamily(catalogItem(225)!)).toBe('computer');});
it('ships a versioned common art palette for both views',()=>{expect(OFFICE_PACK.version).toBe('1.1.0');expect(OFFICE_PACK.families).toContain('bookcase');});

import {licensedOfficeAvailable,agentSkinFor,AGENT_ATLAS,MODERN_INTERIOR_ASSETS} from '../src/rendering/assetManifest';
import {worldSpritePortrait} from '../../public/agent_identity.mjs';
it('roster matches the world rabbit coat in free mode and paid sprites otherwise',()=>{for(const id of ['worker1','worker2','alpha','child-17'])for(const role of ['main','subagent'] as const){const skin=agentSkinFor(id,role);if(!licensedOfficeAvailable()){const index=skin.sheet.split('-').at(-1);expect(worldSpritePortrait({agent:id,role},true).src).toBe(`/pixelworld/assets/free-office/rabbit-portrait-${index}.svg`);}else{const asset=[MODERN_INTERIOR_ASSETS.agent,...Object.values(AGENT_ATLAS)].find(a=>a.key===skin.sheet)!;expect(worldSpritePortrait({agent:id,role}).src).toBe('/pixelworld'+asset.path);}}});
it('keeps workstation components separate instead of stacking full computers',()=>{for(const [id,family] of [[247,'desk'],[121,'display'],[125,'display'],[124,'keyboard'],[153,'papers'],[141,'lamp'],[207,'divider'],[208,'divider']] as const)expect(officeFamily(catalogItem(id)!)).toBe(family);});

import {freeOfficePresentation} from '../src/rendering/freeOfficePresentation';
import {authoredPlacement} from '../src/rendering/interiorFurnitureScale';
it('aligns standalone monitor feet with the desk top without commercial crop offsets',()=>{
 const piece=(id:number)=>freeOfficePresentation({kind:'desk',assetId:id,point:{x:4,y:4},...authoredPlacement(id)});
 const desk=piece(247),monitor=piece(121),papers=piece(153);
 expect(desk.x).toBe(monitor.x);
 const top=desk.y-desk.height/2+desk.height*23/64;
 const screenFoot=monitor.y-monitor.height/2+monitor.height*32/64;
 expect(Math.abs(top-screenFoot)).toBeLessThan(.1);
 expect(Math.abs(papers.x-desk.x)+papers.width/2).toBeLessThan(desk.width/2);
 const neighbour=freeOfficePresentation({kind:'desk',assetId:247,point:{x:5,y:4},...authoredPlacement(247)});
 expect(neighbour.x-neighbour.width/2).toBeGreaterThanOrEqual(desk.x+desk.width/2);
});

import {it,expect} from 'vitest';
import {officeFamily,OFFICE_PACK} from '../src/rendering/officePack';
import {catalogItem} from '../src/rendering/modernOfficeCatalog';
it('preserves Archive Library furniture identities instead of classifying its sofa as storage',()=>{expect(officeFamily(catalogItem(199)!)).toBe('sofa');expect(officeFamily(catalogItem(170)!)).toBe('board');expect(officeFamily(catalogItem(1002)!)).toBe('bookcase');expect(officeFamily(catalogItem(225)!)).toBe('computer');});
it('ships a versioned common art palette for both views',()=>{expect(OFFICE_PACK.version).toBe('1.0.0');expect(OFFICE_PACK.families).toContain('bookcase');});

import {agentSkinFor,AGENT_ATLAS,MODERN_INTERIOR_ASSETS} from '../src/rendering/assetManifest';
import {worldSpritePortrait} from '../../public/agent_identity.mjs';
it('roster uses exactly the world sprite sheet for main and subagents',()=>{for(const id of ['worker1','worker2','alpha','child-17'])for(const role of ['main','subagent'] as const){const skin=agentSkinFor(id,role),asset=[MODERN_INTERIOR_ASSETS.agent,...Object.values(AGENT_ATLAS)].find(a=>a.key===skin.sheet)!;expect(worldSpritePortrait({agent:id,role}).src).toBe('/pixelworld'+asset.path);}});

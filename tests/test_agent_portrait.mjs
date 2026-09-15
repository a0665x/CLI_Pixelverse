import test from 'node:test';
import assert from 'node:assert/strict';
import {worldSpritePortrait} from '../public/agent_identity.mjs';
import {applyAgentPortrait} from '../public/agent_portrait.mjs';
test('uses the exact live coat and atlas frame, not a separately inferred portrait',()=>{
 const sprite=worldSpritePortrait({agent:'worker-17'},true,{sheet:'woodland-rabbit-3',frame:22});
 assert.equal(sprite.src,'/pixelworld/assets/free-office/rabbit-3.svg');assert.equal(sprite.frame,22);
 const image={style:{}};applyAgentPortrait(image,sprite);
 assert.equal(image.style.objectPosition,'-128px -320px');assert.equal(image.style.objectFit,'none');
 applyAgentPortrait(image,{src:'/model.png'});assert.equal(image.style.objectPosition,'');assert.equal(image.style.zoom,'');
});
test('missing live frames use a matching idle rabbit and reject invalid frame numbers',()=>{
 assert.equal(worldSpritePortrait({agent:'a'},true).frame,0);
 assert.equal(worldSpritePortrait({agent:'a'},true,{sheet:'woodland-rabbit-2',frame:88}).frame,0);
});

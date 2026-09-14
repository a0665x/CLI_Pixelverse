import test from 'node:test';import assert from 'node:assert/strict';
import {agentIdentity,rabbitIdentity} from '../public/agent_identity.mjs';
test('uses stable coat and short code for the same rabbit across views',()=>{assert.deepEqual(rabbitIdentity('codex:1'),rabbitIdentity('codex:1'));assert.match(rabbitIdentity('codex:1').color,/^#[0-9a-f]{6}$/);});
test('links only explicit parents, inheriting the correct project among multiple mains',()=>{
 const agents=[{agent:'a',name:'Main A',project_name:'Alpha'},{agent:'b',name:'Main B',project_name:'Beta'}];
 const child=agentIdentity({agent:'child',role:'subagent',parent_agent_id:'b'},agents);
 assert.equal(child.parentName,'Main B');assert.equal(child.project,'Beta');assert.equal(child.role,'sub');
 assert.equal(agentIdentity({agent:'orphan',role:'subagent'},agents).parentName,'');
});

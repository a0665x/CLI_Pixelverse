import test from 'node:test';
import assert from 'node:assert/strict';
import {agentActivity,activityLabel} from '../public/agent_activity.mjs';
import {projectionText} from '../public/agent_session_projection.mjs';
test('reported activity drives distinct rhythms and localized labels',()=>{
 const read=agentActivity({state:'working',pixel_state:'reading_files'});
 const mcp=agentActivity({state:'working',pixel_state:'tool_call',tool_name:'mcp__github__search'});
 const skill=agentActivity({state:'working',pixel_state:'invoking_skill'});
 assert.equal(read.kind,'reading');assert.equal(mcp.kind,'mcp');assert.equal(skill.kind,'skill');
 assert.ok(mcp.rate>read.rate);assert.notEqual(mcp.rate,skill.rate);
 assert.equal(activityLabel(read,'zh-TW'),'讀取資料');assert.equal(activityLabel(read,'en-US'),'Reading');
});
test('idle/offline/approval override stale tool names; prose cannot activate skills',()=>{
 assert.equal(agentActivity({state:'idle',pixel_state:'tool_call',tool_name:'mcp__old'}).kind,'idle');
 assert.equal(agentActivity({state:'offline',pixel_state:'invoking_skill'}).kind,'offline');
 assert.equal(agentActivity({state:'working',requires_approval:true,tool_name:'mcp__old'}).kind,'waiting');
 assert.equal(agentActivity({state:'working',task:'Use a skill and read files'}).kind,'working');
});
test('projection keeps public text literal, excludes reasoning and bounds retained output',()=>{
 assert.equal(projectionText([{role:'reasoning',text:'private'},{role:'assistant',text:'<script>literal</script>'},{role:'tool',text:'line1\nline2'}]),'● <script>literal</script>\n\n$ line1\nline2');
 assert.equal(projectionText([{role:'tool',text:'a'.repeat(100000)}]).length,64000);
});
test('long-running hooks retain actual tool identity and completion returns to working',()=>{
 const agent={state:'working',pixel_state:'browsing',tool_label:'',recent_actions:[{tool_name:'mcp__example__lookup',tool_phase:'started'}]};
 assert.equal(agentActivity(agent).kind,'mcp');
 agent.recent_actions[0].tool_phase='completed';assert.equal(agentActivity(agent).kind,'working');
});

test('switching projection ignores late responses, preserves manual scroll and aborts on close',async()=>{
 const {createSessionProjection}=await import('../public/agent_session_projection.mjs');
 class Node{
  constructor(){this.dataset={};this.children=[];this.listeners={};this.textContent='';this.scrollTop=0;this.scrollHeight=500;this.clientHeight=100;}
  append(...nodes){this.children.push(...nodes);}setAttribute(){}replaceChildren(){this.children=[];}
  addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}
 }
 const root=new Node();root.ownerDocument={createElement:()=>new Node()};
 const requests=[],timers=new Map();let seq=0;
 const view=createSessionProjection({root,locale:()=> 'en-US',fetcher:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),setTimer:(fn)=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id)});
 view.select({id:'A'});view.select({id:'B'});
 assert.equal(requests[0].options.signal.aborted,true);
 requests[0].resolve({ok:true,json:async()=>({available:true,messages:[{role:'assistant',text:'OLD AGENT'}]})});
 requests[1].resolve({ok:true,json:async()=>({available:true,messages:[{role:'assistant',text:'NEW AGENT'}]})});
 await new Promise(resolve=>setImmediate(resolve));
 const output=root.children[2],follow=root.children[3];assert.match(output.textContent,/NEW AGENT/);assert.doesNotMatch(output.textContent,/OLD AGENT/);
 output.scrollTop=23;output.listeners.scroll();assert.equal(follow.hidden,false);
 const [pollId,poll]=[...timers.entries()][0];timers.delete(pollId);poll();
 requests[2].resolve({ok:true,json:async()=>({available:true,messages:[{role:'assistant',text:'NEW OUTPUT'}]})});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(output.scrollTop,23);
 view.close();assert.equal(requests[2].options.signal.aborted,true);assert.equal(timers.size,0);
});

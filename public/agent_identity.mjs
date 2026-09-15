export const RABBIT_COATS = ['#ffffff','#e4edff','#ffe0dc','#e3f1d9','#e9dcfa','#f8e9c9'];
export function rabbitIdentity(id='') {
 const hash=[...String(id)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 return {index:hash%RABBIT_COATS.length,color:RABBIT_COATS[hash%RABBIT_COATS.length],code:hash.toString(36).toUpperCase().slice(-4).padStart(4,'0')};
}
export function agentIdentity(agent={},agents=[]) {
 const id=String(agent.agent||agent.id||'');
 const parentId=String(agent.parent_agent_id||'');
 const parent=agents.find(a=>String(a.agent||a.id)===parentId);
 return {id,name:String(agent.name||id),role:agent.role==='subagent'?'sub':agent.role==='branch_session'?'branch':'main',
  parentId,parentName:parentId?String(parent?.name||parentId):'',
  project:String(agent.project_name||agent.projectName||parent?.project_name||parent?.projectName||''),
  projectPath:String(agent.project_path||agent.projectPath||parent?.project_path||''),...rabbitIdentity(id)};
}

export function worldSkinIndex(id=''){
 const sequence=String(id).match(/(\d+)$/)?.[1];if(sequence)return (Math.max(1,Number(sequence))-1)%3;
 let hash=2166136261;for(const c of String(id)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)%3;
}
export function worldSpritePortrait(agent={},free=false,live){
 if(free){const index=live&&/^woodland-rabbit-[0-5]$/.test(live.sheet)?Number(live.sheet.slice(-1)):rabbitIdentity(agent.agent||agent.id||'').index;return {src:`/pixelworld/assets/free-office/rabbit-${index}.svg`,frame:Number.isInteger(live?.frame)&&live.frame>=0&&live.frame<32?live.frame:0,pixelClass:'rabbit-portrait'};}
 const sub=['subagent','branch_session','sub','branch'].includes(agent.role);
 if(!sub)return {src:'/pixelworld/assets/limezu/modern-interiors-free/Adam_16x16.png',pixelClass:'world-adam-portrait'};
 const file=['ninja-blue','samurai-blue','samurai-green'][worldSkinIndex(agent.agent||agent.id||'')];
 return {src:`/pixelworld/assets/ninja-adventure/${file}.png`,pixelClass:'world-ninja-portrait'};
}

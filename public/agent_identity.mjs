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

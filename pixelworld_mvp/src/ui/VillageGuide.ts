import type {WorldScene} from '../scenes/WorldScene';
import {agentIdentity} from '../../../public/agent_identity.mjs';
import {villageCopy,type VillageLocale} from '../i18n/villageLocale';
import {buildingIdForCommandRoom} from '../live/backendSnapshot';
const guides=new WeakMap<WorldScene,VillageGuide>();
const texts={
 'zh-TW':{guide:'村莊導覽',search:'搜尋 Agent、專案或主 Agent',main:'主 Agent',sub:'子 Agent',branch:'分支',parent:'所屬主 Agent',unknown:'尚未提供',outside:'村莊外／移動中',track:'追蹤',clear:'取消追蹤',empty:'目前沒有人',project:'專案'},
 'en-US':{guide:'Village guide',search:'Find Agent, project or parent',main:'Main',sub:'Subagent',branch:'Branch',parent:'Parent',unknown:'Not reported',outside:'Outside / travelling',track:'Track',clear:'Stop tracking',empty:'No occupants',project:'Project'},
 'ja-JP':{guide:'村の案内',search:'Agent・プロジェクト・親を検索',main:'メイン',sub:'サブ',branch:'分岐',parent:'親 Agent',unknown:'未報告',outside:'屋外／移動中',track:'追跡',clear:'追跡解除',empty:'滞在者なし',project:'プロジェクト'},
 'ko-KR':{guide:'마을 안내',search:'Agent, 프로젝트, 부모 검색',main:'메인',sub:'하위',branch:'분기',parent:'부모 Agent',unknown:'미제공',outside:'야외 / 이동 중',track:'추적',clear:'추적 중지',empty:'입주자 없음',project:'프로젝트'}
};
export const guideFor=(world:WorldScene)=>guides.get(world);
export class VillageGuide {
 private root=document.createElement('aside');private toggle=document.createElement('button');private panel=document.createElement('section');private search=document.createElement('input');private list=document.createElement('div');private tracking=document.createElement('button');
 private rows:Array<ReturnType<typeof agentIdentity>&{building:string;destination:string;task:string}>=[];
 private infos=new Map<string,{label:string;title:string}>();
 private last=0;private signature='';private selected='';
 constructor(private world:WorldScene){
  guides.set(world,this);this.root.className='village-guide';this.toggle.setAttribute('aria-expanded','false');this.panel.hidden=true;this.search.type='search';this.list.className='village-guide-list';this.tracking.hidden=true;
  this.toggle.onclick=()=>{this.panel.hidden=!this.panel.hidden;this.toggle.setAttribute('aria-expanded',String(!this.panel.hidden));if(!this.panel.hidden)this.search.focus();};this.search.oninput=()=>this.render();
  this.tracking.onclick=()=>{this.selected='';this.tracking.hidden=true;this.render();};this.panel.append(this.search,this.list);this.root.append(this.toggle,this.tracking,this.panel);document.querySelector('#app-shell')?.append(this.root);
  world.events.on('postupdate',this.update);world.events.once('shutdown',()=>{world.events.off('postupdate',this.update);this.root.remove();guides.delete(world);});
 }
 private copy(){return texts[document.documentElement.lang as keyof typeof texts]||texts['en-US'];}
 private name(id:string){const copy=villageCopy(document.documentElement.lang as VillageLocale);return copy.buildings[id as keyof typeof copy.buildings]||id;}
 private purpose(id:string){const copy=villageCopy(document.documentElement.lang as VillageLocale);return [...new Set(this.world.worldDefinition.stations.filter(s=>s.buildingId===id).flatMap(s=>s.interactionSlots.map(slot=>copy.actions[slot.action])))].filter(Boolean).join(' · ');}
 private detail(row:typeof this.rows[number]){const c=this.copy();return `${c[row.role]} · ${row.name} #${row.code}\n${c.project}: ${row.project||c.unknown}${row.role==='sub'?`\n${c.parent}: ${row.parentName||c.unknown}`:''}${row.task?`\n${row.task}`:''}`;}
 buildingInfo(id:string){let info=this.infos.get(id);if(!info){const occupants=this.rows.filter(r=>r.building===id);info={label:`${this.name(id)} · ${occupants.length}`,title:[this.name(id),this.purpose(id),occupants.length?occupants.map(r=>this.detail(r)).join('\n\n'):this.copy().empty].join('\n')};this.infos.set(id,info);}return {...info,tracked:this.trackedBuilding()===id};}
 agentLabel(id:string){const r=this.rows.find(r=>r.id===id);return r?`${this.copy()[r.role]} · ${r.name} #${r.code}`:id;}
 agentTitle(id:string){const r=this.rows.find(r=>r.id===id);return r?this.detail(r):id;}
 trackedBuilding(){const row=this.rows.find(r=>r.id===this.selected);return row?.building||row?.destination||'';}
 private update=(now:number)=>{
  if(now-this.last<500)return;this.last=now;const ctx=this.world.immersionContext(),agents=ctx.snapshot?.agents??[];
  this.rows=agents.filter(a=>ctx.agents.some(actor=>actor.agentId===a.agent)).map(a=>{const p=ctx.agents.find(actor=>actor.agentId===a.agent)!.presence();return {...agentIdentity(a,agents),building:p.kind==='inside'?p.buildingId:'',destination:a.room_key?buildingIdForCommandRoom(a.room_key):'',task:a.task||''};});
  const key=JSON.stringify([this.rows,document.documentElement.lang]);if(key!==this.signature){this.signature=key;this.infos.clear();this.render();}
  this.world.worldDefinition.buildings.forEach(b=>{const label=document.querySelector<HTMLElement>(`.world-building-label[data-building-id="${b.id}"]`);if(label){const info=this.buildingInfo(b.id);if(label.textContent!==info.label)label.textContent=info.label;label.title=info.title;label.classList.toggle('guide-tracked',info.tracked);}});
  document.querySelectorAll<HTMLElement>('.world-agent-status[data-agent-id]').forEach(el=>{el.title=this.agentTitle(el.dataset.agentId!);el.dataset.identity=this.agentLabel(el.dataset.agentId!);});
  const row=this.rows.find(r=>r.id===this.selected);this.tracking.hidden=!row;if(row)this.tracking.textContent=`◆ ${row.name} → ${this.name(row.building||row.destination)||this.copy().outside} · ${this.copy().clear}`;
 };
 private render(){const c=this.copy();this.toggle.textContent=`⌖ ${c.guide}`;this.search.placeholder=c.search;this.search.setAttribute('aria-label',c.search);this.list.replaceChildren();
  const filter=this.search.value.toLowerCase();for(const building of [...this.world.worldDefinition.buildings.map(b=>b.id),''].sort((a,b)=>this.rows.filter(r=>r.building===b).length-this.rows.filter(r=>r.building===a).length)){
   const rows=this.rows.filter(r=>r.building===building&&[r.name,r.id,r.project,r.projectPath,r.parentName,r.parentId].join(' ').toLowerCase().includes(filter));if(filter&&!rows.length)continue;
   const block=document.createElement('section'),heading=document.createElement('strong'),use=document.createElement('p');heading.textContent=building?this.buildingInfo(building).label:`${c.outside} · ${rows.length}`;use.textContent=building?this.purpose(building):'';block.append(heading,use);
   for(const row of rows){const button=document.createElement('button');button.className='guide-agent';button.textContent=`${this.detail(row)}\n${c.track}${!row.building&&row.destination?' → '+this.name(row.destination):''}`;button.style.borderLeftColor=row.color;button.setAttribute('aria-pressed',String(row.id===this.selected));button.onclick=()=>{this.selected=row.id;this.signature='';this.panel.hidden=true;this.toggle.setAttribute('aria-expanded','false');(document.activeElement as HTMLElement)?.blur();this.render();};block.append(button);}this.list.append(block);
  }
 }
}

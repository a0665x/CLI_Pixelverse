import * as T from 'three';
import type { FurnitureDefinition, InteriorDefinition } from '../world/types';
import type { BackendAgentSnapshot } from '../live/backendSnapshot';

export const workstationYaw=(f:FurnitureDefinition)=>({up:0,down:Math.PI,left:Math.PI/2,right:-Math.PI/2})[f.facing];
export const integratedScreenKinds=['computer','workbench','repair-table','reading-desk','response-desk','dispatch-pod','radio-console'];
export function workstationDefinitions(interior:InteriorDefinition) {
  return interior.furniture.filter(f=>f.kind==='display'||integratedScreenKinds.includes(f.kind)).map(screen=>({
    screen, stationIds:screen.kind==='display'?(screen.supportedByIds?.filter(id=>interior.furniture.some(f=>f.id===id))??[]):[screen.id],
  }));
}
/** Seat only explicitly grouped chairs; custom loose furniture is never silently rebound. */
export function workstationSeats(interior:InteriorDefinition) {
  const seats=new Map<string,{chairId:string;point:{x:number;y:number}}>();
  for(const chair of interior.furniture.filter(f=>['chair','office-chair'].includes(f.kind)&&f.prefabInstanceId)){
    const desk=interior.furniture.filter(f=>f.kind==='desk'&&f.prefabInstanceId===chair.prefabInstanceId&&f.facing===chair.facing&&!seats.has(f.id))
      .sort((a,b)=>Math.hypot(a.point.x-chair.point.x,a.point.y-chair.point.y)-Math.hypot(b.point.x-chair.point.x,b.point.y-chair.point.y))[0];
    if(desk?.interactionPoint&&Math.hypot(desk.point.x-chair.point.x,desk.point.y-chair.point.y)<2.5)seats.set(desk.id,{chairId:chair.id,point:{...desk.interactionPoint}});
  }return seats;
}
export function hookLines(agent?:BackendAgentSnapshot):string[] {
  if(!agent)return [];
  const lines=[agent.task,agent.activity_hint,agent.status_label||agent.state,agent.tool_label];
  for(const event of (agent.recent_actions??[]).slice(-8)) {
    // Only public hook fields. Never execute or interpret hook content as markup.
    lines.push(...['tool_name','message','preview','output'].map(k=>typeof event[k]==='string'?event[k] as string:undefined));
  }
  return [...new Set(lines.filter((s):s is string=>typeof s==='string'&&Boolean(s.trim())))].map(s=>s.slice(0,4000));
}
const copy={
  'en-US':{inspect:'Inspect screen',title:'Workstation',empty:'No Agent at this workstation',source:'Live hook feed · Public task and tool events',missing:'No public output received yet',close:'Back to village',left:'Agent has left this workstation',prompt:'E · Inspect screen'},
  'zh-TW':{inspect:'查看螢幕',title:'工作站',empty:'目前沒有 Agent 使用這個工作站',source:'即時 Hook · 公開任務與工具事件',missing:'尚未收到公開輸出',close:'返回村莊',left:'Agent 已離開這個工作站',prompt:'E · 查看螢幕'},
  'ja-JP':{inspect:'画面を見る',title:'ワークステーション',empty:'この席に Agent はいません',source:'ライブ Hook · 公開タスクとツールイベント',missing:'公開出力はまだありません',close:'村に戻る',left:'Agent はこの席を離れました',prompt:'E · 画面を見る'},
  'ko-KR':{inspect:'화면 보기',title:'워크스테이션',empty:'이 자리에 Agent가 없습니다',source:'실시간 Hook · 공개 작업 및 도구 이벤트',missing:'공개 출력이 아직 없습니다',close:'마을로 돌아가기',left:'Agent가 이 자리를 떠났습니다',prompt:'E · 화면 보기'},
};
export const workstationCopy=()=>copy[document.documentElement.lang as keyof typeof copy]??copy['en-US'];
export interface ScreenOccupant {id:string; furnitureId?:string|undefined; walking?:boolean|undefined}
export class WorkstationScreens {
  readonly group=new T.Group();
  readonly screens: Array<{id:string;stationIds:string[];mesh:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;texture:T.CanvasTexture;canvas:HTMLCanvasElement;agentId?:string|undefined;signature?:string}>;
  private last=0;
  constructor(interior:InteriorDefinition){
    this.screens=workstationDefinitions(interior).map(({screen,stationIds})=>{
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=448;
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const mesh=new T.Mesh(new T.PlaneGeometry(.65,.4),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
      const yaw=workstationYaw(screen),depth=screen.kind==='display'?.052:-.09;mesh.rotation.y=yaw;mesh.position.set(screen.point.x+Math.sin(yaw)*depth,screen.kind==='display'?1.2:1.18,screen.point.y+Math.cos(yaw)*depth);
      mesh.userData.screenId=screen.id;this.group.add(mesh);return {id:screen.id,stationIds,mesh,texture,canvas};
    });
  }
  update(now:number,occupants:ScreenOccupant[],agents:BackendAgentSnapshot[]){
    if(now-this.last<350)return;this.last=now;
    for(const screen of this.screens){
      screen.agentId=occupants.find(o=>!o.walking&&o.furnitureId&&screen.stationIds.includes(o.furnitureId))?.id;
      const agent=agents.find(a=>a.agent===screen.agentId),c=workstationCopy();
      const lines=hookLines(agent),name=agent?.name||screen.agentId||c.empty,signature=JSON.stringify([name,lines,c.source]);
      if(screen.signature===signature)continue;screen.signature=signature;
      const ctx=screen.canvas.getContext('2d')!;ctx.fillStyle='#101f29';ctx.fillRect(0,0,768,448);
      ctx.fillStyle=agent?'#8ce0bd':'#849398';ctx.fillRect(24,26,10,10);ctx.font='bold 25px sans-serif';ctx.fillText(name.slice(0,40),48,47);
      ctx.fillStyle='#7195a3';ctx.font='16px sans-serif';ctx.fillText(c.source,25,80);ctx.fillRect(25,99,718,1);
      ctx.font='20px monospace';ctx.fillStyle='#cee0d7';
      const rows=(lines.length?lines:[agent?c.missing:c.empty]).flatMap(s=>s.split('\n').flatMap(line=>line.match(/.{1,48}/gu)??[''])).slice(0,11);
      rows.forEach((line,i)=>ctx.fillText(line,25,132+i*26));screen.texture.needsUpdate=true;
    }
  }
  dispose(){for(const s of this.screens){s.mesh.geometry.dispose();s.mesh.material.dispose();s.texture.dispose();}this.group.removeFromParent();}
}

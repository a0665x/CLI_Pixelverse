import {FoodEffects} from './foodEffects';
import {characterMoveAllowed,characterSupport,type CharacterBody} from './characterCollision';
import {playerHeading} from './playerHeading';
import {PlatformMotion} from './platformMotion';
import {GAIT_SPEED,nextRabbitGait,type RabbitGait} from './rabbitGait';
import {villagePlayerAllowed} from './villageCollision';
import {roomBodyAllowed} from './furniturePhysics';
import { inspectionCopy } from '../i18n/inspectionLocale';
import { immersionText as t } from '../i18n/immersionLocale';
import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { AGENT_SKINS } from '../rendering/assetManifest';
import { agentFrameForSkin } from '../rendering/agentAnimation';
import { navigationBlockedCellKeys } from '../rendering/interiorPlacement';
import type { Facing } from '../world/types';
import { choiceIndex, clearSight, movePlayer, type PlayerPoint } from './playerMotion';

type Choice = 'inspect' | 'steer' | 'interrupt';
interface Capability { state?:string; available: boolean; turnId?: string; reason?: string }
const labels = ['查看工作','插入指令','打斷並改派'];
const actions: Choice[] = ['inspect','steer','interrupt'];
const skin = AGENT_SKINS.main;
function copyTo(node:HTMLElement,source:string):void {node.dataset.copy=source;node.textContent=t(source);}
const SUMMON_MS = 1600;

export class ImmersionController {
  private active=false;
  private foodEffects=new FoodEffects();
  private foodScale=1;
  private feeding=document.createElement('div');
  private feedToggle=document.createElement('button');
  private feedMenu=document.createElement('div');
  private feedStatus=document.createElement('span');
  private interactionQuestion=document.createElement('p');
  private cameraYaw=0;
  private visibleActors:CharacterBody[]=[];
  setVisibleActors(actors:CharacterBody[]):void {this.visibleActors=actors;}

  private walking=false;
  private gait:RabbitGait='walk';
  private heading=0;
  private elevation=0;
  private platform:PlatformMotion|undefined;
  private jumpRequested=false;
  private hopTime=0;
  private flashlight=false;
  private controls=document.createElement("div");
  private idleTime=0;
  private inspectionOpen=false;
  setInspectionOpen(open:boolean):void {this.inspectionOpen=open;this.keys.clear();this.walking=false;if(open)this.hidePanel();}
  setCameraYaw(yaw:number):void {this.cameraYaw=yaw;}
  viewState() {return {food:this.foodEffects.sample(performance.now()),foodScale:this.foodScale,active:this.active, point:{...(this.roomPoint||this.point)}, summonPoint:this.summonPoint,impactAge:performance.now()-(this.landingDeadline-SUMMON_MS*.45),roomId:this.roomId, facing:this.facing, walking:this.walking, gait:this.gait, heading:this.heading, elevation:this.elevation, flashlight:this.flashlight, landing:this.landing/SUMMON_MS, target:this.target};}
  private readonly localize=()=>{
    this.root.setAttribute('aria-label',t('降臨審查員'));
    this.toggle.textContent=this.active?t('離開巡檢'):t('✦ 降臨審查員');
    this.options.setAttribute('aria-label',t('選擇互動'));
    this.options.querySelectorAll('button').forEach((b,i)=>b.textContent=t(labels[i]!));
    if(this.target&&!this.busy&&!this.modal)this.showTarget(this.target);
    if(this.target){const agent=this.world.immersionContext().snapshot?.agents.find(a=>a.agent===this.target);this.title.textContent=`${inspectionCopy().event} · ${agent?.name||this.target}`;this.interactionQuestion.textContent=`${inspectionCopy().ask} ${t('← → 選擇，Enter 確認')}`;}
    this.feeding.querySelectorAll<HTMLElement>('[data-copy]').forEach(node=>node.textContent=t(node.dataset.copy!));
    this.content.querySelectorAll<HTMLElement>('[data-copy]').forEach(node=>{
      const source=node.dataset.copy!;
      if(node instanceof HTMLTextAreaElement)node.placeholder=t(source);
      else node.textContent=t(source);
    });
  };
  private point: PlayerPoint;
  private summonPoint:PlayerPoint={x:0,y:0};
  private roomPoint: PlayerPoint | undefined;
  private roomId='';
  private outside!: Phaser.GameObjects.Image;
  private visitor: Phaser.GameObjects.Image | undefined;
  private visitorParent: Phaser.GameObjects.Container | undefined;
  private effects!: Phaser.GameObjects.Graphics;
  private clock=0;
  private inspectAt=0;
  private landing=0;
  private landingDeadline=0;
  private facing: Facing='down';
  private keys=new Set<string>();
  private sessionTimer:ReturnType<typeof setTimeout>|undefined;
  private target='';
  private dismissed='';
  private selected=0;
  private menuFocused=false;
  private modal=false;
  private busy=false;
  private generation=0;
  private capability: Capability={available:false};
  private capabilityReady: Promise<void> = Promise.resolve();
  private reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  private root=document.createElement('section');
  private toggle=document.createElement('button');
  private panel=document.createElement('div');
  private title=document.createElement('strong');
  private options=document.createElement('div');
  private content=document.createElement('div');
  private hint=document.createElement('p');
  private roomCollision=new Set<string>();
  private collisionAt=0;
  private lastTick=0;
  private readonly tick=(time:number,delta:number)=>{
    const elapsed=this.lastTick?time-this.lastTick:delta;this.lastTick=time;
    this.update(document.documentElement.dataset.view==='3d'?elapsed:delta);
  };
  private readonly blur=()=>this.keys.clear();
  private readonly keyup=(e:KeyboardEvent)=>this.keys.delete(e.code);
  private readonly keydown=(e:KeyboardEvent)=>{
    if(!this.active || e.isComposing || this.inspectionOpen) return;
    const editing=(e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]');
    if(e.code==='Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if(this.modal) this.closeContent(); else if(this.target) {this.dismissed=this.target;this.hidePanel();}
      else if(this.roomId) this.world.immersionContext().cutaway?.close();
      return;
    }
    if(editing) return;
    if(this.modal || this.inspectionOpen) return;
    if(e.code==='KeyL'&&document.documentElement.dataset.view==='3d'){e.preventDefault();if(!e.repeat)this.flashlight=!this.flashlight;return;}
    if(e.code==='Space'&&document.documentElement.dataset.view==='3d'){e.preventDefault();if(!e.repeat)this.jumpRequested=true;return;}
    if(e.code==='KeyR'&&document.documentElement.dataset.view==='3d'){e.preventDefault();if(!e.repeat)this.gait=nextRabbitGait(this.gait);return;}
    if(this.target && !this.panel.hidden && e.code==='Enter'&&!this.menuFocused){e.preventDefault();this.menuFocused=true;this.keys.clear();this.options.querySelectorAll('button')[this.selected]?.focus();return;}
    if(this.target && this.menuFocused && !this.panel.hidden && ['ArrowLeft','ArrowRight','Enter'].includes(e.code)) {
      e.preventDefault();e.stopImmediatePropagation();
      if(e.repeat && e.code==='Enter') return;
      if(e.code==='Enter') this.choose(actions[this.selected]!);
      else {this.selected=choiceIndex(this.selected,e.code==='ArrowLeft'?-1:1);this.markChoice();}
      return;
    }
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();this.menuFocused=false;(document.activeElement as HTMLElement)?.blur();this.keys.add(e.code);
    }
  };
  constructor(private readonly world: WorldScene) {
    this.point={...world.worldDefinition.spawn};
    this.root.id='immersion-ui'; this.root.setAttribute('aria-label',t('降臨審查員'));
    this.toggle.type='button';this.toggle.id='immersion-toggle';this.toggle.textContent=t('✦ 降臨審查員');
    this.toggle.setAttribute('aria-pressed','false');this.toggle.onclick=()=>this.setActive(!this.active);
    this.panel.className='immersion-panel';this.panel.hidden=true;
    this.options.className='immersion-options';this.options.setAttribute('role','group');this.options.setAttribute('aria-label',t('選擇互動'));
    labels.forEach((label,index)=>{
      const b=document.createElement('button');b.type='button';b.textContent=t(label);b.dataset.choice=actions[index];
      b.onclick=()=>{this.selected=index;this.markChoice();this.choose(actions[index]!);};this.options.append(b);
    });
    this.content.className='immersion-content';this.content.hidden=true;
    this.hint.className='immersion-hint';this.hint.hidden=true;
    this.interactionQuestion.className='interaction-question';this.interactionQuestion.setAttribute('role','status');
    this.panel.append(this.title,this.interactionQuestion,this.options,this.content);
    this.controls.className='inspector-controls';this.controls.hidden=true;
    for(const [key,code] of [['W','KeyW'],['A','KeyA'],['S','KeyS'],['D','KeyD'],['Space','Space'],['L','KeyL']]){
      const button=document.createElement('button');button.type='button';button.textContent=key!;button.dataset.code=code!;
      const release=()=>this.keys.delete(code!);
      button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.keydown(new KeyboardEvent('keydown',{code:code!}));};
      button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
      this.controls.append(button);
    }
    this.feeding.className='inspector-feeding';this.feedToggle.type='button';copyTo(this.feedToggle,'投餵食物');
    this.feedMenu.hidden=true;this.feedMenu.className='inspector-food-menu';this.feedToggle.setAttribute('aria-expanded','false');
    this.feedToggle.onclick=()=>{this.feedMenu.hidden=!this.feedMenu.hidden;this.feedToggle.setAttribute('aria-expanded',String(!this.feedMenu.hidden));this.feedToggle.blur();};
    for(const [food,label,icon] of [['carrot','胡蘿蔔 · 加速 30 秒','🥕'],['hay','甘草堆 · 變大 30 秒','🌾']] as const){
      const button=document.createElement('button');button.type='button';copyTo(button,label);button.dataset.food=food;button.title=icon;
      button.onclick=()=>{if(!this.active)return;this.foodEffects.feed(food,performance.now());this.feedMenu.hidden=true;this.feedToggle.setAttribute('aria-expanded','false');button.blur();};this.feedMenu.append(button);
    }
    this.feeding.append(this.feedToggle,this.feedMenu,this.feedStatus);this.feeding.hidden=true;
    this.root.append(this.feeding);
    this.root.append(this.toggle,this.hint,this.panel,this.controls);document.querySelector('#app-shell')?.append(this.root);
    this.outside=world.add.image(0,0,skin.sheet,3).setOrigin(.5,.82).setScale(1.1).setTint(0xffe0a3).setVisible(false);
    this.effects=world.add.graphics().setDepth(9000);
    window.addEventListener('keydown',this.keydown,true);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.blur);
    window.addEventListener('pixelverse:locale',this.localize);
    world.events.on('postupdate',this.tick);world.events.once('shutdown',()=>this.destroy());
  }
  private setActive(active:boolean):void {
    if(this.busy) return;
    this.active=active;this.feeding.hidden=!active;if(!active){this.foodEffects.clear();this.foodScale=1;this.feedMenu.hidden=true;this.feedToggle.setAttribute('aria-expanded','false');}document.documentElement.dataset.immersion=String(active);this.toggle.setAttribute('aria-pressed',String(active));
    this.toggle.textContent=active?t('離開巡檢'):t('✦ 降臨審查員');this.keys.clear();
    this.controls.hidden=!active;this.hopTime=0;this.idleTime=0;this.hint.hidden=!active;this.outside.setVisible(active);this.effects.clear();
    if(active) {
      const enteredRoom=this.world.immersionContext().cutaway?.visitorSurface();
      if(!enteredRoom)this.world.immersionContext().cutaway?.close();this.point={...this.world.worldDefinition.spawn};
      const agents=this.world.immersionContext().agents;
      this.point=[{x:this.point.x+1,y:this.point.y},{x:this.point.x-1,y:this.point.y},this.point].find(p=>this.allowed(p)&&agents.every(a=>a.presence().kind==='inside'||Math.hypot(a.sprite.x/16-.5-p.x,a.sprite.y/16-.5-p.y)>.7))||this.point;
      this.summonPoint={...this.point};this.effects.setDepth(9000);this.landing=this.reduced.matches||enteredRoom?1:SUMMON_MS;this.landingDeadline=performance.now()+this.landing;this.clock=0;this.roomId='';
      this.hint.textContent=t('召喚中…');
    } else {this.world.visitorBody=undefined;this.world.immersionContext().cutaway?.setVisitorBody(undefined);this.clearVisitor();this.hidePanel();this.world.immersionContext().cutaway?.close();}
    this.toggle.blur();
  }
  private allowed=(p:PlayerPoint)=>document.documentElement.dataset.view==='3d'?(villagePlayerAllowed(this.world.worldDefinition,this.world.navigationGrid,p)&&(this.gait!=='bound'||villagePlayerAllowed(this.world.worldDefinition,this.world.navigationGrid,{x:p.x+Math.sin(this.heading)*.28,y:p.y+Math.cos(this.heading)*.28}))):this.world.navigationGrid.isWalkable({x:Math.round(p.x),y:Math.round(p.y)});
  private clearVisitor():void {this.platform=undefined;this.hopTime=0;this.elevation=0;this.jumpRequested=false;this.visitor?.destroy();this.visitor=undefined;this.visitorParent=undefined;this.roomPoint=undefined;this.roomId='';}
  private update(delta:number):void {
    if(!this.active) return;
    if(document.documentElement.dataset.view!=='3d'&&this.platform){
      this.roomPoint={...this.platform.groundPoint};this.platform=undefined;this.elevation=0;this.jumpRequested=false;
    }
    const dt=Math.min(Math.max(delta,0),150);this.clock+=dt;
    this.effects.clear();
    if(this.landing>0) {
      this.landing=Math.max(0,this.landingDeadline-performance.now());
      const progress=1-this.landing/SUMMON_MS,x=this.point.x*16+8,y=this.point.y*16+8;
      const fall=Math.max(0,1-Math.pow(Math.min(1,progress/.55),2));
      this.outside.setPosition(x,y-220*fall).setDepth(9001);
      this.effects.fillStyle(0x384338,.22).fillEllipse(x,y+3,22,8);
      if(!this.reduced.matches && fall>0) {
        const bodyY=y-220*fall;
        this.effects.fillStyle(0x9b6142,.85).fillEllipse(x,bodyY-8,25,24);
        this.effects.lineStyle(2,0xffd68a,.8).strokeEllipse(x,bodyY-8,28,27);
        this.effects.lineStyle(1,0xfbe6b7,.7).strokeEllipse(x,y+3,30+progress*20,10+progress*7);
        this.effects.lineStyle(4,0xffc978,.6).lineBetween(x,y-220*fall-8,x-10,y-220*fall-50);
      }
      if(progress>=.55 && !this.reduced.matches) {
        const t=(progress-.55)/.45;
        this.effects.lineStyle(2,0xffdf9a,1-t).strokeEllipse(x,y+3,10+t*70,5+t*25);
        for(let i=0;i<12;i++) {
          const a=i*Math.PI/6,r=8+t*(17+i%3*6);
          const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.4-Math.sin(t*Math.PI)*18;
          this.effects.fillStyle(i%2?0x8d7252:0xe0bc77,1-t).fillTriangle(px-3,py+2,px,py-4,px+4,py+3);
          this.effects.lineStyle(1,0x86654b,(1-t)*.8).lineBetween(x+Math.cos(a)*4,y+3+Math.sin(a)*2,x+Math.cos(a)*16,y+3+Math.sin(a)*7);
        }
      }
      return;
    }
    const context=this.world.immersionContext();

    const surface=context.cutaway?.visitorSurface();
    if(surface) {
      if(this.roomId!==surface.buildingId) {
        this.clearVisitor();this.roomId=surface.buildingId;
        this.elevation=0;this.jumpRequested=false;
        this.roomPoint={x:Math.floor(surface.interior.width/2),y:surface.interior.height-1};this.collisionAt=0;this.hidePanel();
      }
      if(this.clock>this.collisionAt) {
        this.roomCollision=navigationBlockedCellKeys(surface.interior.furniture, {x:-10,y:-10});this.collisionAt=this.clock+250;
      }
      if(this.visitorParent!==surface.parent || !this.visitor?.scene) {
        this.visitor?.destroy();
        this.visitor=this.world.add.image(0,0,skin.sheet,3).setOrigin(.5,.82).setTint(0xffe0a3);
        surface.parent.add(this.visitor);this.visitorParent=surface.parent;
      }
      this.outside.setVisible(false);
    } else {
      if(this.roomId) {
        const home=this.world.worldDefinition.buildings.find(b=>b.id===this.roomId);
        if(home) this.point={...home.entrance.outside};
        this.clearVisitor();this.hidePanel();this.keys.clear();this.elevation=0;
      }
      this.outside.setVisible(true);
    }
    const inputX=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const inputY=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    const dx=inputX*Math.cos(this.cameraYaw)+inputY*Math.sin(this.cameraYaw);
    const dy=-inputX*Math.sin(this.cameraYaw)+inputY*Math.cos(this.cameraYaw);
    const walking=!this.modal && !this.inspectionOpen && Boolean(dx||dy);
    this.walking=walking;
    const food=this.foodEffects.sample(performance.now());
    this.foodScale+=(food.size-this.foodScale)*(1-Math.exp(-dt*.008));
    this.feedStatus.textContent=[food.speedSeconds?`🥕 ${t('加速中')} ${food.speedSeconds}s`:'',food.sizeSeconds?`🌾 ${t('變大中')} ${food.sizeSeconds}s`:''].filter(Boolean).join(' · ');
    const speed=(document.documentElement.dataset.view==='3d'?GAIT_SPEED[this.gait]:3.5)*food.speed;
    this.outside.setScale((skin.renderScale??1)*this.foodScale);

    const before={...(this.roomPoint||this.point)};
    const bodyRoom=surface?.buildingId??'';
    const bodies:CharacterBody[]=document.documentElement.dataset.view==='3d'?this.visibleActors:surface?surface.agents.map(a=>({...a,roomId:bodyRoom})):context.agents.filter(a=>a.presence().kind==='outside').map(a=>({id:a.agentId,roomId:'',x:a.sprite.x/16-.5,y:a.sprite.y/16-.5}));
    const bodyAllowed=(from:PlayerPoint,to:PlayerPoint,height=this.elevation)=>characterMoveAllowed({id:'inspector',roomId:bodyRoom,...from,height},to,bodies);

    if(walking)this.heading=playerHeading(this.heading,inputX,inputY,this.cameraYaw);
    if(walking) this.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
    const indoorAllowed=(p:PlayerPoint)=>document.documentElement.dataset.view==='3d'&&surface?(roomBodyAllowed(surface.interior,p)&&(this.gait!=='bound'||roomBodyAllowed(surface.interior,{x:p.x+Math.sin(this.heading)*.28,y:p.y+Math.cos(this.heading)*.28}))):Boolean(surface && p.x>=0 && p.y>=0 && p.x<surface.interior.width-.5 && p.y<surface.interior.height-.5 && !this.roomCollision.has(`${Math.round(p.x)},${Math.round(p.y)}`));
    if(surface && this.roomPoint) {
      if(document.documentElement.dataset.view==='3d'){
        this.platform??=new PlatformMotion(surface.interior,this.roomPoint);
        this.platform.step(walking?dx:0,walking?dy:0,speed,dt/1000,this.jumpRequested&&!this.modal&&!this.inspectionOpen,bodyAllowed,(point,height)=>characterSupport({id:'inspector',roomId:bodyRoom,...point},height,bodies));
        this.roomPoint={...this.platform.point};this.elevation=this.platform.height;
      }else{this.platform=undefined;if(walking)this.roomPoint=movePlayer(this.roomPoint,dx,dy,dt*.001*speed*3/3.5,p=>indoorAllowed(p)&&bodyAllowed(this.roomPoint!,p));}
      const p=this.roomPoint;
      this.visitor!.setPosition(surface.origin.x+(p.x+.5)*surface.cell,surface.origin.y+(p.y+.5)*surface.cell)
        .setScale((skin.renderScale??1)*this.foodScale*surface.cell/22).setDepth(3000+surface.origin.y+(p.y+.5)*surface.cell+.999)
        .setFrame(agentFrameForSkin(skin,this.facing,walking,this.clock));
      if(walking && dy>0 && p.y>surface.interior.height-1.2 && Math.abs(p.x-Math.floor(surface.interior.width/2))<.65) context.cutaway?.close();
    } else {
      if(walking) this.point=movePlayer(this.point,dx,dy,dt*.001*speed,p=>this.allowed(p)&&bodyAllowed(this.point,p));
      this.outside.setPosition(this.point.x*16+8,this.point.y*16+8).setDepth(this.point.y*16+9)
        .setFrame(agentFrameForSkin(skin,this.facing,walking,this.clock));
      this.effects.setDepth(-705).fillStyle(0xe5cb87,.65).fillEllipse(this.point.x*16+8,this.point.y*16+12,14,5);
      const impactAge=performance.now()-(this.landingDeadline-SUMMON_MS*.45);
      if(impactAge>=0&&impactAge<4000&&!this.reduced.matches){const x=this.summonPoint.x*16+8,y=this.summonPoint.y*16+10;this.effects.setDepth(2).lineStyle(1,0x4d3c2c,Math.min(1,(4000-impactAge)/1500));for(let i=0;i<9;i++){const a=i*2.4,r=12+i%3*4;this.effects.lineBetween(x,y,x+Math.sin(a)*r,y+Math.cos(a)*r*.5);}}
      if(walking && dy<0) {
        const door=this.world.worldDefinition.buildings.find(b=>Math.abs(this.point.x-b.entrance.threshold.x)<.55 && Math.abs(this.point.y-b.entrance.threshold.y)<(document.documentElement.dataset.view==='3d'?1.35:.65));
        if(door) {context.cutaway?.open(door.id);this.keys.clear();return;}
      }
    }
    const is3D=document.documentElement.dataset.view==='3d';
    if(is3D&&!surface&&this.jumpRequested&&!this.hopTime&&!this.modal&&!this.inspectionOpen)this.hopTime=.001;
    if(this.hopTime){this.hopTime+=dt;this.elevation=.7*Math.sin(Math.PI*Math.min(1,this.hopTime/560));if(this.hopTime>=560){this.hopTime=0;this.elevation=0;}}
    if(!is3D){this.hopTime=0;this.elevation=0;}
    this.jumpRequested=false;
    this.controls.hidden=!is3D||this.modal||this.inspectionOpen;
    this.idleTime=(walking||this.hopTime)?0:this.idleTime+dt;
    this.controls.dataset.idle=String(this.idleTime>1800);
    this.controls.title=inspectionCopy().controls;this.controls.setAttribute('aria-label',inspectionCopy().controls);this.controls.dataset.hint=inspectionCopy().controls;
    for(const button of this.controls.querySelectorAll('button')){const code=button.dataset.code!;button.dataset.pressed=String(this.keys.has(code)||(code==='Space'&&Boolean(this.hopTime||(this.platform&&!this.platform.grounded)))||(code==='KeyL'&&this.flashlight));if(code==='KeyL')button.setAttribute('aria-pressed',String(this.flashlight));}
    this.root.dataset.flashlight=String(this.flashlight);
    this.walking=walking&&Math.hypot((this.roomPoint||this.point).x-before.x,(this.roomPoint||this.point).y-before.y)>.00001;
    this.root.dataset.heading=String(this.heading);
    this.root.dataset.gait=this.gait;this.root.dataset.elevation=String(this.elevation);this.root.dataset.perch=this.platform?.support||'';
    this.hint.textContent=inspectionCopy().role+' · '+(surface?t('WASD 移動 · 從門口向下離開 · Esc 返回'):t('WASD 移動 · 向上走入門口 · 靠近 Agent 交談'));
    if(document.documentElement.dataset.view==='3d')this.hint.textContent+=' · '+inspectionCopy().gaits+' · '+inspectionCopy()[this.gait]+(surface?' · '+inspectionCopy().perch:'');
    this.world.visitorBody={id:'inspector',roomId:this.roomId,...(this.roomPoint||this.point),height:this.elevation};
    context.cutaway?.setVisitorBody(this.world.visitorBody);
    this.root.dataset.playerX=String((this.roomPoint||this.point).x);this.root.dataset.playerY=String((this.roomPoint||this.point).y);this.root.dataset.room=this.roomId;
    if(this.modal || this.inspectionOpen) return;
    const p=surface?this.roomPoint!:this.point;
    const candidates=document.documentElement.dataset.view==='3d'?this.visibleActors:surface?surface.agents:context.agents.filter(a=>a.presence().kind==='outside').map(a=>({id:a.agentId,x:a.sprite.x/16-.5,y:a.sprite.y/16-.5}));
    const nearest=candidates.map(a=>({...a,distance:Math.hypot(a.x-p.x,a.y-p.y)}))
      .filter(a=>a.distance<(a.id===this.target?2.4:1.9) && clearSight(p,a,q => Math.hypot(q.x-a.x,q.y-a.y)<.65 || (surface?indoorAllowed(q):this.allowed(q))))
      .sort((a,b)=>a.distance-b.distance)[0];
    if(!nearest) {if(this.target)this.hidePanel();this.dismissed='';return;}
    if(nearest.id===this.dismissed) return;
    if(nearest.id!==this.target) this.showTarget(nearest.id);
    this.root.dataset.playerX=String(p.x);this.root.dataset.playerY=String(p.y);this.root.dataset.room=this.roomId;
  }
  private showTarget(id:string):void {
    if(this.target!==id)this.world.immersionContext().agents.find(a=>a.agentId===this.target)?.setConversationHeld(false);
    this.world.immersionContext().agents.find(a=>a.agentId===id)?.setConversationHeld(true);
    this.target=id;this.selected=0;this.menuFocused=false;this.panel.hidden=false;this.options.hidden=false;this.content.hidden=true;this.modal=false;
    const agent=this.world.immersionContext().snapshot?.agents.find(a=>a.agent===id);
    this.title.textContent=`${inspectionCopy().event} · ${agent?.name||id}`;this.interactionQuestion.textContent=`${inspectionCopy().ask} ${t('← → 選擇，Enter 確認')}`;
    this.markChoice();this.capability={available:false,reason:t('正在確認控制連線…')};
    const version=++this.generation;
    this.capabilityReady=fetch(`/api/agent-control/${encodeURIComponent(id)}`).then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then((cap:Capability)=>{if(this.generation===version){this.capability=cap;const buttons=this.options.querySelectorAll('button');buttons[1]!.textContent=t(cap.available&&!cap.turnId?'繼續對話':'插入指令');buttons[2]!.disabled=cap.available&&!cap.turnId;}})
      .catch(()=>{if(this.generation===version)this.capability={available:false,reason:t('此 Agent 尚未連接控制通道，目前可查看工作。')};});
  }
  private markChoice():void { [...this.options.querySelectorAll('button')].forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===this.selected));b.tabIndex=i===this.selected?0:-1;}); }
  private hidePanel():void {clearTimeout(this.sessionTimer);this.world.immersionContext().agents.find(a=>a.agentId===this.target)?.setConversationHeld(false);this.generation++;this.target='';this.modal=false;this.panel.hidden=true;this.content.replaceChildren();this.keys.clear();}
  private closeContent():void {if(this.busy)return;clearTimeout(this.sessionTimer);this.modal=false;this.content.hidden=true;this.options.hidden=false;this.keys.clear();if(this.target){this.showTarget(this.target);this.options.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();}}
  private workText():string {
    const agent=this.world.immersionContext().snapshot?.agents.find(a=>a.agent===this.target);
    return agent?[agent.task||agent.activity_hint||agent.status_label||agent.state||t('目前沒有工作摘要'),
      ...(agent.recent_actions||[]).slice(0,4).map(a=>String(a.preview||a.message||a.tool_name||''))].filter(Boolean).join('\n')
      :t('此 Agent 已離線或尚未提供工作摘要。');
  }
  private async choose(choice:Choice):Promise<void> {
    if(!this.target||this.modal)return;
    this.modal=true;this.keys.clear();this.options.hidden=true;this.content.hidden=false;this.content.replaceChildren();
    const back=document.createElement('button');back.type='button';back.textContent=t('返回選項');back.dataset.copy='返回選項';back.onclick=()=>this.closeContent();
    if(choice==='inspect') {
      const text=document.createElement('p');text.className='immersion-speech';text.setAttribute('role','status');
      text.textContent=this.workText();
      this.content.append(text,back);
      const target=this.target,version=this.generation;
      const refresh=async()=>{try{const response=await fetch(`/api/agent-session/${encodeURIComponent(target)}`);if(!response.ok)throw new Error();const session=await response.json();if(version!==this.generation||!this.modal)return;
        const messages=(session.messages||[]).map((m:{role:string;text:string})=>`${m.role}: ${m.text}`).join('\n\n');
        text.textContent=[session.threadId?`Session: ${session.threadId}`:'',session.available?t(session.state==='idle'?'等待下一輪對話':'正在執行'):t('此 Agent 僅支援查看，尚未綁定控制通道。'),messages||this.workText()].filter(Boolean).join('\n\n');
      }catch{if(version===this.generation)text.textContent=this.workText();}finally{if(version===this.generation&&this.modal)this.sessionTimer=setTimeout(refresh,3000);}};
      void refresh();return;
    }
    const version=this.generation;
    await this.capabilityReady;
    if(version!==this.generation||!this.modal)return;
    const action=this.capability.available&&!this.capability.turnId?'start':choice;
    const form=document.createElement('form');const label=document.createElement('label');
    const caption=document.createElement('span');copyTo(caption,action==='start'?'繼續對話':choice==='steer'?'補充這一輪的工作指令':'中斷目前工作後的新指令');label.append(caption);
    const input=document.createElement('textarea');input.rows=3;input.maxLength=12000;input.required=true;input.placeholder=t('輸入要交給這位 Agent 的指令…');input.dataset.copy='輸入要交給這位 Agent 的指令…';label.append(input);
    const status=document.createElement('p');status.setAttribute('role','status');
    const submit=document.createElement('button');submit.type='submit';copyTo(submit,action==='start'?'送出對話':choice==='steer'?'送出插入指令':'送出並打斷');
    submit.disabled=!this.capability.available;copyTo(status,this.capability.available?(action==='start'?'等待下一輪對話':choice==='interrupt'?'送出後才中斷；已完成的檔案修改不會自動撤回。':'插入當前工作，不另開對話。'):'此 Agent 僅支援查看，尚未綁定控制通道。');
    const target=this.target,turnId=this.capability.turnId||'';
    form.onsubmit=async e=>{
      e.preventDefault();if(this.busy||!input.value.trim()||submit.disabled)return;
      this.busy=true;submit.disabled=true;back.disabled=true;this.toggle.disabled=true;copyTo(status,'正在等候 Agent 確認…');
      try {
        const response=await fetch(`/api/agent-control/${encodeURIComponent(target)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,text:input.value.trim(),expected_turn_id:turnId,request_id:crypto.randomUUID()})});
        const result=await response.json();
        if(!response.ok)throw new Error(t('未能送達，請重新確認 Agent 狀態。'));
        copyTo(status,action==='start'?'對話已送出':choice==='steer'?'Agent 已接受補充指令。':'已確認中斷，並送入新指令。');input.disabled=true;
      } catch(error) {copyTo(status,'未能送達，請重新確認 Agent 狀態。');}
      finally {this.busy=false;back.disabled=false;this.toggle.disabled=false;}
    };
    if(!this.capability.available){const help=document.createElement('p');help.textContent=t('請以可對話模式啟動 Codex')+' — hook_bridge.sh --agent codex --control --launch';form.append(help);}
    form.append(label,status,submit);this.content.append(form,back);input.focus();
  }
  destroy():void {
    this.hidePanel();
    window.removeEventListener('pixelverse:locale',this.localize);
    delete document.documentElement.dataset.immersion;
    this.world.visitorBody=undefined;this.world.immersionContext().cutaway?.setVisitorBody(undefined);
    this.generation++;window.removeEventListener('keydown',this.keydown,true);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.blur);
    this.world.events.off('postupdate',this.tick);this.root.remove();this.outside.destroy();this.effects.destroy();this.clearVisitor();
  }
}

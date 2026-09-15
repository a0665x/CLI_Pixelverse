import {FrameProbe} from '../diagnostics/frameProbe';
import {rabbitPortraits} from './rabbitPortraits';
import {FoodRain} from './foodRain';
import {createGuideSmoke,smokeRoute} from './guideSmoke';
import {characterMoveAllowed,type CharacterBody} from '../player/characterCollision';
import {guideFor} from '../ui/VillageGuide';
import {viewOccluded} from './occlusion';
import {woodlandDetails} from './woodlandDetails';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {setRabbitOccluded} from './people';
import {ActorNavigation,ActorWalker} from '../player/actorNavigation';
import {roomBodyAllowed} from '../player/furniturePhysics';
import {riverSamples,villagePlayerAllowed} from '../player/villageCollision';
import {resolveFollowPosition,zoomFollow} from './followCamera';
import {inspectionCopy} from '../i18n/inspectionLocale';
import {disposeSurfaceMaterials} from './surfaceMaterials';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { WorldScene } from '../scenes/WorldScene';
import type { ImmersionController } from '../player/ImmersionController';
import {createHuman,animateHuman,loadPeopleAssets,disposeHuman,disposePeopleAssets} from './people';
export const prepareVillageAssets=loadPeopleAssets;
import { WorkstationScreens, workstationCopy, hookLines } from './workstations';
import { dayNightAt } from '../world/dayNight';
import { PATH_TEXTURE } from '../rendering/villagePaths';
import { villageCopy, type VillageLocale } from '../i18n/villageLocale';
import { box, cylinder, tree, house, roomModel, batchStatic, disposeGroup, disposeModelMaterials, material } from './models';

/** View over the existing simulation: hooks, navigation and room occupants remain authoritative. */
export class Village3D {
  private playerFacing=new T.Quaternion();
  private upAxis=new T.Vector3(0,1,0);
  private navigation=new WeakMap<object,ActorNavigation>();
  private actorTelemetryAt=0;
  private occlusionAt=0;
  readonly root=document.createElement('section');
  private scene=new T.Scene();
  private camera=new T.PerspectiveCamera(44,1,.1,250);
  private renderer:T.WebGLRenderer;
  private guideLine=createGuideSmoke();
  private guideLineAt=0;
  private composer:EffectComposer;
  private edgeSmoothing=new ShaderPass(FXAAShader);
  private controls:OrbitControls;
  private overview=new T.Group();
  private room:T.Group|undefined;
  private roomId='';
  private roomSignature='';
  private workstations:WorkstationScreens|undefined;
  private proximity=document.createElement('aside');
  private proximityTitle=document.createElement('strong');
  private proximityQuestion=document.createElement('p');
  private proximityInspect=document.createElement('button');
  private proximityDismiss=document.createElement('button');
  private dismissedScreen='';
  private proximityId='';
  private focusRing=new T.Mesh(new T.RingGeometry(.58,.63,48),new T.MeshBasicMaterial({color:0xe5cf99,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));
  private updateProximity(now:number){
    const state=this.immersion.viewState(),near=this.nearbyScreen(),c=inspectionCopy();
    if(!near)this.dismissedScreen='';
    const visible=Boolean(near)&&!state.target&&!this.inspectedScreen&&near!.id!==this.dismissedScreen;
    this.proximity.hidden=!visible;this.focusRing.visible=Boolean(state.active&&(near||state.target))&&!this.inspectedScreen;
    const actor=state.target?this.actors.get(state.target):undefined;
    if(this.focusRing.visible){const point=actor?.position??near?.mesh.position;if(point)this.focusRing.position.set(point.x,.045,point.z);this.focusRing.scale.setScalar(this.reduced.matches?1:1+Math.sin(now*.004)*.04);}
    if(!visible)return;
    if(this.proximityId!==near!.id){this.proximityId=near!.id;this.proximity.dataset.trigger=near!.id;}
    const title=`${c.event} · ${c.screen}`;if(this.proximityTitle.textContent!==title)this.proximityTitle.textContent=title;
    for(const [node,text] of [[this.proximityQuestion,c.ask],[this.proximityInspect,`E · ${c.inspect}`],[this.proximityDismiss,c.continue]] as const){if(node.textContent!==text)node.textContent=text;}
    this.proximityInspect.onclick=()=>this.inspectScreen(near!.id);this.proximityDismiss.onclick=()=>{this.dismissedScreen=near!.id;this.proximity.hidden=true;this.renderer.domElement.focus();};
  }

  private screenDialog=document.createElement('dialog');
  private screenTitle=document.createElement('h2');
  private screenSource=document.createElement('p');
  private screenContent=document.createElement('pre');
  private screenBack=document.createElement('button');
  private inspectedScreen='';
  private cameraBeforeScreen:{position:T.Vector3;target:T.Vector3}|undefined;
  private inspectedAgent:string|undefined;
  private focusBeforeScreen:HTMLElement|undefined;
  private screenKey=(e:KeyboardEvent)=>{
    if(this.enabled&&this.screenDialog.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.closeScreen();return;}
    if(!this.enabled||this.screenDialog.open||e.repeat||e.isComposing||(e.target as HTMLElement)?.closest('input,textarea,dialog,[contenteditable="true"]'))return;
    if(e.code==='KeyE'){const nearest=this.nearbyScreen();if(nearest){e.preventDefault();this.inspectScreen(nearest.id);}}
  };
  private nearbyScreen(){
    const state=this.immersion.viewState();if(!state.active)return undefined;
    return this.workstations?.screens.filter(s=>Math.hypot(s.mesh.position.x-state.point.x,s.mesh.position.z-state.point.y)<2.2)
      .sort((a,b)=>Math.hypot(a.mesh.position.x-state.point.x,a.mesh.position.z-state.point.y)-Math.hypot(b.mesh.position.x-state.point.x,b.mesh.position.z-state.point.y))[0];
  }
  private inspectScreen(id:string){
    const screen=this.workstations?.screens.find(s=>s.id===id);if(!screen)return;
    if(this.immersion.viewState().active&&Math.hypot(screen.mesh.position.x-this.immersion.viewState().point.x,screen.mesh.position.z-this.immersion.viewState().point.y)>2.2)return;
    this.cameraBeforeScreen={position:this.camera.position.clone(),target:this.controls.target.clone()};
    this.inspectedScreen=id;this.inspectedAgent=screen.agentId;this.focusBeforeScreen=document.activeElement as HTMLElement;
    this.immersion.setInspectionOpen(true);this.refreshScreen();this.screenDialog.showModal();this.screenBack.focus();
  }
  private closeScreen(){
    if(!this.inspectedScreen)return;this.inspectedScreen='';this.inspectedAgent=undefined;this.screenDialog.close();this.immersion.setInspectionOpen(false);
    if(this.cameraBeforeScreen){this.camera.position.copy(this.cameraBeforeScreen.position);this.controls.target.copy(this.cameraBeforeScreen.target);this.controls.update();this.cameraBeforeScreen=undefined;}
    if(this.focusBeforeScreen?.isConnected)this.focusBeforeScreen.focus();
  }
  private refreshScreen(){
    if(!this.inspectedScreen)return;
    const screen=this.workstations?.screens.find(s=>s.id===this.inspectedScreen);if(!screen){this.closeScreen();return;}
    const c=workstationCopy(),agents=this.world.immersionContext().snapshot?.agents??[];
    // Lock the inspected identity: a colleague taking this seat cannot replace the feed under the reader.
    if(!this.inspectedAgent&&screen.agentId)this.inspectedAgent=screen.agentId;
    const agent=agents.find(a=>a.agent===this.inspectedAgent);
    this.screenTitle.textContent=`${c.title} · ${agent?.name||this.inspectedAgent||c.empty}`;
    this.screenSource.textContent=c.source+(this.inspectedAgent&&screen.agentId!==this.inspectedAgent?` · ${c.left}`:'');
    const text=hookLines(agent).join('\n\n')||(this.inspectedAgent?c.missing:c.empty);
    if(this.screenContent.textContent!==text)this.screenContent.textContent=text;
    this.screenBack.textContent=c.close+' · Esc';
  }

  private actors=new Map<string,T.Group>();
  private foodRain=new FoodRain();
  private player=createHuman('inspector',true);
  private snack=new T.Group();
  private snackCarrot=new T.Group();
  private snackHay=new T.Group();
  private sun=new T.DirectionalLight(0xffe7b3,3);
  private sky=new T.HemisphereLight(0xb3cbd2,0x616b44,2);
  private flashlightModel!:T.Mesh;
  private torch=new T.SpotLight(0xffeac3,0,18,.43,.65,1.4);
  private beam=new T.Mesh(new T.CylinderGeometry(.035,1.8,7,32,1,true),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){float fade=pow(vUv.y,1.7)*pow(sin(vUv.x*3.14159),2.0);gl_FragColor=vec4(1.0,0.88,0.66,fade*0.035);}'}));
  private indoorLight=new T.PointLight(0xffe1b1,0,30,1.4);
  private lanterns:T.PointLight[]=[];
  private water:T.Mesh|undefined;
  private fx=new T.Group();
  private fragments:T.Mesh[]=[];
  private shock:T.Mesh;
  private meteor:T.Mesh;
  private cracks=new T.Group();
  private labels=document.createElement('div');
  private labelNodes=new Map<string,HTMLElement>();
  private hud=document.createElement('div');
  private close=document.createElement('button');
  private clock=document.createElement('output');
  private help=document.createElement('p');
  private resizeObserver:ResizeObserver;
  private enabled=false;
  private frame=0;
  private last=0;
  private wasActive=false;
  private cameraDistance=16;
  private pitch=.65;
  private yaw=0;
  private pointer:{x:number;y:number;startX:number;startY:number}|undefined;
  private reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resize=()=>{
    const w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);this.composer.setSize(w,h);const ratio=this.renderer.getPixelRatio();this.edgeSmoothing.uniforms.resolution!.value.set(1/(w*ratio),1/(h*ratio));this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  };
  constructor(private world:WorldScene,private immersion:ImmersionController) {
    this.root.id='village-3d';this.root.hidden=true;
    this.proximity.className='inspection-event';this.proximity.hidden=true;this.proximity.setAttribute('aria-live','polite');
    this.proximityInspect.type=this.proximityDismiss.type='button';this.proximity.append(this.proximityTitle,this.proximityQuestion,this.proximityInspect,this.proximityDismiss);this.root.append(this.proximity);
    this.focusRing.rotation.x=-Math.PI/2;this.focusRing.visible=false;this.scene.add(this.focusRing);
    this.renderer=new T.WebGLRenderer({antialias:false,alpha:false,stencil:true,powerPreference:'high-performance'});
    const gl=this.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    const software=debug&&/swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    window.parent.postMessage({type:'pixelverse.rabbit.portraits',sources:rabbitPortraits(this.renderer)},location.origin);
    this.renderer.setPixelRatio(software?.85:Math.min(window.devicePixelRatio,1.5));this.renderer.shadowMap.enabled=!software;this.root.dataset.renderQuality=software?'software':'full';
    this.renderer.info.autoReset=false;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene.background=new T.Color(0xa7bec1);this.scene.fog=new T.FogExp2(0xa7bec1,.009);
    this.sun.position.set(12,30,14);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{left:-32,right:32,top:24,bottom:-24,near:1,far:100});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.035;
    this.sun.target.position.set(24,0,14);this.guideLine.renderOrder=900;this.scene.add(this.guideLine,this.foodRain.group);
    this.scene.add(this.sun,this.sun.target,this.sky,this.overview,this.player,this.torch,this.torch.target,this.indoorLight,this.fx);
    this.torch.castShadow=true;this.torch.shadow.mapSize.set(512,512);this.torch.shadow.bias=-.0005;this.player.visible=false;
    this.buildVillage();
    const carrot=cylinder(this.snackCarrot,0,0,0,.07,.32,0xea963c,.012);carrot.rotation.z=-.4;
    for(let i=0;i<3;i++){const leaf=cylinder(this.snackCarrot,(i-1)*.035,-.20,0,.015,.14,0x77935b);leaf.rotation.z=(i-1)*.4;}
    for(let i=0;i<8;i++){const stalk=cylinder(this.snackHay,(i%3-1)*.028,0,Math.floor(i/3)*.02,.012,.25,0xccb86d);stalk.rotation.z=(i%3-1)*.12;}
    this.snack.add(this.snackCarrot,this.snackHay);this.player.add(this.snack);
    this.beam.rotation.x=-Math.PI/2;this.beam.position.set(.14,.27,3.5);this.player.add(this.beam);
    const flashlight=cylinder(this.scene,0,0,0,.045,.18,0x4b514b);flashlight.rotation.x=Math.PI/2;this.flashlightModel=flashlight;flashlight.visible=false;
    this.meteor=new T.Mesh(new T.IcosahedronGeometry(.68,0),material(0xb98750));this.fx.add(this.meteor);
    this.fx.add(this.cracks);for(let i=0;i<12;i++){const a=i*2.4,r=.8+i%3*.3;const points=[new T.Vector3(0,.035,0),new T.Vector3(Math.sin(a)*r*.5,.035,Math.cos(a)*r*.5),new T.Vector3(Math.sin(a+.2)*r,.035,Math.cos(a+.2)*r)];this.cracks.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x49372a,transparent:true})));}
    this.shock=new T.Mesh(new T.RingGeometry(.9,1,64),new T.MeshBasicMaterial({color:0xffd992,transparent:true,opacity:0,side:T.DoubleSide}));this.shock.rotation.x=-Math.PI/2;this.fx.add(this.shock);
    for(let i=0;i<20;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.07+i%3*.035,0),material(i%2?0xa88b61:0xe0bd7b));this.fragments.push(m);this.fx.add(m);}
    this.camera.position.set(29,35,44);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(23,0,14);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minDistance=5;this.controls.maxDistance=68;
    this.controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};this.controls.screenSpacePanning=false;this.controls.zoomToCursor=true;this.controls.update();
    this.composer=new EffectComposer(this.renderer);this.composer.renderTarget1.stencilBuffer=true;this.composer.renderTarget2.stencilBuffer=true;this.composer.addPass(new RenderPass(this.scene,this.camera));if(!software)this.composer.addPass(new UnrealBloomPass(new T.Vector2(800,600),.18,.5,1.05));this.composer.addPass(new OutputPass());this.composer.addPass(this.edgeSmoothing);
    this.labels.className='village-3d-labels';this.hud.className='village-3d-hud';this.close.type='button';this.close.onclick=()=>world.immersionContext().cutaway?.close();
    const reset=document.createElement('button');reset.type='button';reset.dataset.cameraReset='true';reset.textContent=({'zh-TW':'重設視角','ja-JP':'視点を戻す','ko-KR':'시점 초기화'} as Record<string,string>)[document.documentElement.lang]||'Reset camera';reset.onclick=()=>{this.yaw=0;this.pitch=.65;this.cameraDistance=16;if(!this.immersion.viewState().active){const center=this.room?this.controls.target.clone().setY(0):new T.Vector3(23,0,14);this.controls.target.copy(center);this.camera.position.copy(center).add(this.room?new T.Vector3(0,16,15):new T.Vector3(6,35,30));this.controls.update();}};this.hud.append(this.clock,reset,this.close);this.help.className='village-3d-help';
    this.screenDialog.className='workstation-dialog';this.screenDialog.setAttribute('aria-labelledby','workstation-title');this.screenTitle.id='workstation-title';
    this.screenBack.type='button';this.screenBack.onclick=()=>this.closeScreen();this.screenDialog.addEventListener('cancel',e=>{e.preventDefault();this.closeScreen();});
    this.screenDialog.append(this.screenTitle,this.screenSource,this.screenContent,this.screenBack);this.root.append(this.screenDialog);
    window.addEventListener('keydown',this.screenKey,true);
    this.root.append(this.renderer.domElement,this.labels,this.hud,this.help);document.querySelector('#app-shell')!.append(this.root);
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(this.root);
    const canvas=this.renderer.domElement;canvas.tabIndex=0;
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{this.pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();});
    canvas.addEventListener('pointermove',e=>{if(!this.pointer)return;if(this.immersion.viewState().active){this.yaw-=(e.clientX-this.pointer.x)*.006;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-this.pointer.y)*.004,.15,1.45);}this.pointer.x=e.clientX;this.pointer.y=e.clientY;});
    canvas.addEventListener('pointerup',e=>{
      if(this.pointer&&Math.hypot(e.clientX-this.pointer.startX,e.clientY-this.pointer.startY)<5&&this.workstations){
        const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
        const hit=ray.intersectObjects(this.workstations.screens.map(s=>s.mesh))[0];if(hit)this.inspectScreen(hit.object.userData.screenId);
      }this.pointer=undefined;
    });canvas.addEventListener('pointercancel',()=>this.pointer=undefined);
    canvas.addEventListener('wheel',e=>{if(this.immersion.viewState().active){e.preventDefault();this.cameraDistance=zoomFollow(this.cameraDistance,e.deltaY);}},{passive:false});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new Event('pixelverse:3d-unavailable'));});
  }
  private groundHeight(x:number,z:number):number {
    for(const b of this.world.worldDefinition.scenery.bridges){if(Math.abs(z-b.y)>=.65)continue;const edge=Math.max(b.x-.5-x,x-(b.x+b.width-.5),0);if(edge<=.6)return .02+.33*(1-edge/.6);}
    return .02;
  }
  private buildVillage() {
    const w=this.world.worldDefinition,staticWorld=new T.Group();
    const ground=box(staticWorld,w.width/2-.5,-.32,w.height/2-.5,w.width+2,.6,w.height+2,0x87926b);
    const paint=document.createElement('canvas');paint.width=512;paint.height=512;
    const brush=paint.getContext('2d')!;brush.fillStyle='#b2b68b';brush.fillRect(0,0,512,512);
    for(let i=0;i<18000;i++){const x=(i*137.13)%512,y=(i*73.71)%512;brush.fillStyle=i%3?'#73845b18':'#e3daac18';brush.fillRect(x,y,2+i%4,1+i%3);}
    const texture=new T.CanvasTexture(paint);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,3);ground.material.map=texture;
    box(staticWorld,w.width/2-.5,-1.15,w.height/2-.5,w.width+1,1.1,w.height+1,0x635e49);
    const source=this.world.textures.get(PATH_TEXTURE)?.getSourceImage();
    if(source){const tex=new T.CanvasTexture(source as HTMLCanvasElement);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
      const path=new T.Mesh(new T.PlaneGeometry(w.width,w.height),new T.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,roughness:1}));path.rotation.x=-Math.PI/2;path.position.set(w.width/2-.5,.014,w.height/2-.5);path.receiveShadow=true;this.overview.add(path);}
    const river=riverSamples(w);
    const strip=(width:number,y:number,color:number)=>{const vertices:number[]=[],indices:number[]=[];for(let i=0;i<=240;i++){const p=river[i]!;vertices.push(p.x-width/2,y,p.z,p.x+width/2,y,p.z);if(i<240){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.32,metalness:.35,side:T.DoubleSide}));m.receiveShadow=true;this.overview.add(m);return m;};
    strip(3.35,.018,0xaaa484);this.water=strip(2.85,.033,0x67949a);
    for(const bridge of w.scenery.bridges){const z=bridge.y;
      for(const side of [-1,1])for(let j=0;j<6;j++){const edge=side<0?bridge.x-.5:bridge.x+bridge.width-.5;box(staticWorld,edge+side*(j+.5)*.1,.02+.33*(1-(j+.5)/6)-.06,z,.105,.12,1.25,0x9f855e);}
for(let i=0;i<16;i++)box(staticWorld,bridge.x-.5+(i+.5)*bridge.width/16,.25,z,bridge.width/16-.02,.16,1.25,i%2?0x9f855e:0xa99169);
      for(const side of [-1,1]){box(staticWorld,bridge.x+(bridge.width-1)/2,.86,z+side*.61,bridge.width+.4,.11,.1,0x736044);for(let i=0;i<4;i++)box(staticWorld,bridge.x-.4+i*(bridge.width-.2)/3,.57,z+side*.61,.12,1.05,.12,0x776344);}}
    w.buildings.forEach((b,i)=>house(staticWorld,b,i));w.scenery.trees.forEach((t,i)=>tree(staticWorld,t.trunk.x,t.trunk.y,i));
    for(let i=0;i<360;i++){const x=(Math.sin(i*127.1)*43758.5453%1+1)%1*w.width,z=(Math.sin(i*311.7)*9631.17%1+1)%1*w.height;
      if(!this.world.navigationGrid.isWalkable({x:Math.round(x),y:Math.round(z)})||w.terrain.some(t=>t.kind!=='grass'&&Math.abs(t.bounds.x-x)<1&&Math.abs(t.bounds.y-z)<1))continue;
      const m=box(staticWorld,x,.09,z,.045,.18,.035,i%3?0x647943:0xa4a270);m.rotation.z=.2;}
    for(const f of w.scenery.cropFields)for(let x=f.x;x<f.x+f.width;x++)for(let z=f.y;z<f.y+f.height;z++){box(staticWorld,x,.04,z,.9,.07,.8,0x867651);for(let j=0;j<3;j++)cylinder(staticWorld,x-.25+j*.25,.3,z,.11,.5,0x98a26a,.03);}
    w.scenery.decorations.forEach((d,i)=>{const {x,y:z}=d.point;if(d.kind==='bench'){box(staticWorld,x,.5,z,1.4,.15,.5,0x9c845b);box(staticWorld,x,.8,z-.2,1.4,.4,.1,0x8d7757);for(const a of [-.5,.5])box(staticWorld,x+a,.22,z,.1,.45,.4,0x5b5d49);}else if(d.kind==='crate')box(staticWorld,x,.3,z,.65,.6,.65,0x94815d);else if(d.kind==='rock'){const m=new T.Mesh(new T.SphereGeometry(.32+i%3*.04,12,8),material(0x999d88));m.position.set(x,.13,z);m.scale.y=.65;staticWorld.add(m);}});
    for(const [i,b] of w.buildings.entries()){const x=b.entrance.outside.x+1.05,z=b.entrance.outside.y;cylinder(staticWorld,x,1.15,z,.045,2.3,0x4a5145);box(staticWorld,x,2.35,z,.3,.38,.3,0xffd398,true);box(staticWorld,x,2.6,z,.45,.12,.45,0x535645);
      if(i%2===0){const light=new T.PointLight(0xffcc83,0,7,2);light.position.set(x,2.25,z);this.lanterns.push(light);this.overview.add(light);}}
    this.overview.add(batchStatic(staticWorld));this.overview.add(woodlandDetails(w));
  }
  setEnabled(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;this.world.sys.setVisible(!enabled);this.root.hidden=!enabled;this.pointer=undefined;
    if(enabled){this.resize();this.last=performance.now();this.frame=requestAnimationFrame(this.update);}else{this.closeScreen();cancelAnimationFrame(this.frame);this.immersion.setCameraYaw(0);}}
  private frameProbe=new FrameProbe();
  private readonly update=(now:number)=>{
    const started=performance.now(),interval=now-this.last;
    if(!this.enabled)return;
    const dt=Math.min((now-this.last)/1000,.05);this.last=now;
    const state=this.immersion.viewState(),context=this.world.immersionContext(),surface=context.cutaway?.visitorSurface();
    const nextId=surface?.buildingId||'',signature=surface?JSON.stringify(surface.interior.furniture):'';
    if(nextId!==this.roomId||signature!==this.roomSignature){this.closeScreen();this.workstations?.dispose();this.workstations=undefined;this.roomId=nextId;this.roomSignature=signature;if(this.room)disposeGroup(this.room);this.room=undefined;
      if(surface){this.navigation.delete(surface.interior);this.room=batchStatic(roomModel(surface.interior,this.world.worldDefinition.buildings.findIndex(b=>b.id===nextId)));this.scene.add(this.room);this.workstations=new WorkstationScreens(surface.interior);this.scene.add(this.workstations.group);}
      this.overview.visible=!surface;this.yaw=0;this.pitch=.65;
      if(!state.active){const center=surface?new T.Vector3(surface.interior.width/2,0,surface.interior.height/2):new T.Vector3(23,0,14);this.controls.target.copy(center);this.camera.position.copy(center).add(surface?new T.Vector3(0,16,15):new T.Vector3(6,35,30));this.controls.update();}}
    this.foodRain.group.visible=!surface;this.foodRain.update(state.drops,performance.now(),(x,y)=>this.groundHeight(x,y));
    const cycle=dayNightAt(Date.now()),skyColor=new T.Color(0x101d31).lerp(new T.Color(0xb7c8c4),cycle.daylight);
    this.scene.background=skyColor;(this.scene.fog as T.FogExp2).color.copy(this.scene.background);
    (this.scene.fog as T.FogExp2).density=surface?.012:.009+(1-cycle.daylight)*.008;
    this.sky.intensity=surface?.65+cycle.daylight*1.2:.75+cycle.daylight*1.25;this.sun.intensity=surface?.3+cycle.daylight*1.3:.4+cycle.daylight*2.56;this.sun.color.set(cycle.daylight>.8?0xffecc5:0xa3b6e3);
    const center=surface?new T.Vector3(surface.interior.width/2,0,surface.interior.height/2):new T.Vector3(24,0,14);
    this.sun.target.position.copy(center);this.sun.position.copy(center).add(new T.Vector3(Math.cos(cycle.phase*6.28)*24,12+Math.abs(cycle.elevation)*24,-14));
    this.lanterns.forEach(l=>l.intensity=(1-cycle.daylight)*18);this.indoorLight.intensity=surface?16+(1-cycle.daylight)*12:0;this.indoorLight.position.copy(center).setY(3.4);
    if(this.water&&!this.reduced.matches)this.water.position.y=Math.sin(now*.0007)*.006;
    this.controls.enabled=!state.active&&!this.inspectedScreen;if(state.active&&!this.wasActive){const offset=this.camera.position.clone().sub(this.controls.target);this.cameraDistance=T.MathUtils.clamp(offset.length(),2,60);this.yaw=Math.atan2(offset.x,offset.z);this.pitch=T.MathUtils.clamp(Math.atan2(offset.y,Math.hypot(offset.x,offset.z)),.15,1.45);}this.wasActive=state.active;
    const p=new T.Vector3(state.point.x,surface?.02+state.elevation:this.groundHeight(state.point.x,state.point.y)+state.elevation,state.point.y),angles={up:Math.PI,down:0,left:-Math.PI/2,right:Math.PI/2};
    this.player.scale.setScalar(state.foodScale);this.player.visible=state.active;this.player.position.copy(p);this.playerFacing.setFromAxisAngle(this.upAxis,state.heading);this.player.quaternion.slerp(this.playerFacing,this.reduced.matches?1:1-Math.exp(-dt*20));this.root.dataset.playerHeading=String(state.heading);this.root.dataset.playerYaw=String(Math.atan2(2*(this.player.quaternion.w*this.player.quaternion.y),1-2*this.player.quaternion.y*this.player.quaternion.y));animateHuman(this.player,now/1000,state.walking,state.food.eating>0,false,dt,state.gait);
    this.snack.visible=state.food.eating>0;this.snackCarrot.visible=state.food.food==='carrot';this.snackHay.visible=!this.snackCarrot.visible;this.snack.position.set(.08,.43,.23);this.snack.scale.setScalar(Math.min(1,state.food.eating*2));this.snack.rotation.z=Math.sin(now*.024)*.12;
    const fall=Math.max(0,1-Math.pow(Math.min(1,(1-state.landing)/.55),2));if(state.active)this.player.position.y+=fall*14;
    this.fx.visible=state.active&&!surface&&(state.landing>0||state.impactAge<4000)&&!this.reduced.matches;
    if(this.fx.visible){const origin=new T.Vector3(state.summonPoint.x,.04,state.summonPoint.y);this.meteor.visible=fall>0;this.meteor.position.copy(this.player.position).add(new T.Vector3(0,.7,0));const impact=T.MathUtils.clamp(state.impactAge/720,0,1);this.shock.position.copy(origin).setY(.06);this.shock.scale.setScalar(.4+impact*4);(this.shock.material as T.MeshBasicMaterial).opacity=fall>0?0:1-impact;
      this.cracks.position.copy(origin);this.cracks.visible=state.impactAge>=0;this.cracks.children.forEach(c=>{((c as T.Line).material as T.LineBasicMaterial).opacity=T.MathUtils.clamp((4000-state.impactAge)/1500,0,1);});
      this.fragments.forEach((f,i)=>{f.visible=fall===0&&impact<1;const a=i*2.4,r=.5+impact*(1.5+i%4*.4);f.position.set(origin.x+Math.cos(a)*r,.15+Math.sin(impact*Math.PI)*(1+i%3*.3),origin.z+Math.sin(a)*r);f.rotation.set(impact*5,i,impact*3);f.scale.setScalar(1-impact);});}
    if(state.active&&!this.inspectedScreen){const target=p.clone().add(new T.Vector3(0,.43,0)),desired=target.clone().add(new T.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.cameraDistance));
      resolveFollowPosition(target,desired,this.world.worldDefinition,surface?.interior);
      this.camera.position.lerp(desired,this.reduced.matches?1:1-Math.exp(-dt*9));this.root.dataset.cameraDistance=String(this.camera.position.distanceTo(target));this.root.dataset.cameraZoom=String(this.cameraDistance);this.camera.lookAt(target);this.root.dataset.cameraPosition=this.camera.position.toArray().join(',');this.root.dataset.cameraTarget=target.toArray().join(',');this.controls.target.copy(target);this.immersion.setCameraYaw(this.yaw);
    }else if(!this.inspectedScreen)this.controls.update();
    this.torch.intensity=state.active&&state.flashlight?36:0;this.flashlightModel.visible=state.flashlight;this.beam.visible=this.torch.intensity>0;this.player.userData.hand.getWorldPosition(this.torch.position);this.flashlightModel.position.copy(this.torch.position);this.flashlightModel.rotation.set(Math.PI/2,0,-state.heading);const a=state.heading;this.torch.target.position.copy(p).add(new T.Vector3(Math.sin(a)*8,.3,Math.cos(a)*8));
    this.root.dataset.night=String(cycle.night);this.root.dataset.flashlight=String(this.torch.intensity>0);this.root.dataset.room=this.roomId;this.root.dataset.gait=state.gait;this.root.dataset.inspectorModel=this.player.userData.variant;this.root.dataset.inspectorHeight=String(this.player.userData.height);
    const locale=document.documentElement.lang as VillageLocale,copy=villageCopy(locale);
    this.clock.textContent=`${cycle.night?'☾':'☀'} ${String(Math.floor(cycle.hour)).padStart(2,'0')}:${String(Math.floor(cycle.hour%1*60)).padStart(2,'0')} · 60 min`;
    this.close.hidden=!surface;this.close.textContent=copy.cutaway.actions.close;this.help.hidden=state.active;
    this.help.textContent=({'zh-TW':'左鍵平移 · 右鍵旋轉 · 滾輪縮放 · 點房屋名稱進入','en-US':'Left drag to pan · Right drag to orbit · Scroll to zoom · Click a house to enter','ja-JP':'左ドラッグ移動 · 右ドラッグ回転 · ホイールズーム','ko-KR':'왼쪽 드래그 이동 · 오른쪽 드래그 회전 · 휠 확대'} as Record<string,string>)[locale]||'Left drag to pan · Right drag to orbit · Scroll to zoom';
    const ids=new Set(context.agents.map(a=>a.agentId));for(const [id,g] of this.actors)if(!ids.has(id)){disposeHuman(g);this.actors.delete(id);}
    const navSource=surface?.interior??this.world.worldDefinition;
    let nav=this.navigation.get(navSource);
    if(!nav){nav=new ActorNavigation(navSource.width,navSource.height,surface?(p=>roomBodyAllowed(surface.interior,p)):(p=>villagePlayerAllowed(this.world.worldDefinition,this.world.navigationGrid,p)));this.navigation.set(navSource,nav);}

    for(const actor of context.agents){let g=this.actors.get(actor.agentId);if(!g){g=createHuman(actor.agentId);this.scene.add(g);this.actors.set(actor.agentId,g);}
      const indoor=surface?.agents.find(a=>a.id===actor.agentId);g.visible=surface?Boolean(indoor):actor.presence().kind==='outside';if(!g.visible)continue;
      const desired={x:indoor?.motion?.point.x??indoor?.x??actor.sprite.x/16-.5,y:indoor?.motion?.point.y??indoor?.y??actor.sprite.y/16-.5};
      if(g.userData.navigation!==nav){
        const peers:CharacterBody[]=[...this.actors].filter(([id,other])=>id!==actor.agentId&&other.visible&&other.userData.navigation===nav).map(([id,other])=>({id,roomId:surface?.buildingId??'',x:other.position.x,y:other.position.z}));
        if(state.active)peers.push({id:'inspector',roomId:state.roomId,...state.point,height:state.elevation});
        const walker=new ActorWalker(nav,desired,p=>characterMoveAllowed({id:actor.agentId,roomId:surface?.buildingId??'',...p},p,peers));
        g.userData.navigation=nav;g.userData.walker=walker;
        g.position.set(walker.point.x,surface?.02:this.groundHeight(walker.point.x,walker.point.y),walker.point.y);
      }
      // Outdoor position is authoritative: a second slower planner used to lag behind
      // the door arrival and disappear mid-path when the 2D controller entered.
      const dx=desired.x-g.position.x,dz=desired.y-g.position.z;
      const movement=actor.isConversationHeld()?{point:{x:g.position.x,y:g.position.z},moving:false,heading:g.rotation.y}
        :surface?(g.userData.walker as ActorWalker).step(desired,dt,(from,to)=>characterMoveAllowed({id:actor.agentId,roomId:surface.buildingId,...from},to,[
          ...[...this.actors].filter(([id,other])=>id!==actor.agentId&&other.visible&&other.userData.navigation===nav).map(([id,other])=>({id,roomId:surface.buildingId,x:other.position.x,y:other.position.z})),
          ...(state.active?[{id:'inspector',roomId:state.roomId,...state.point,height:state.elevation}]:[]),
        ]))
        :{point:desired,moving:Math.hypot(dx,dz)>.001,heading:Math.atan2(dx,dz)};
      const {x,y:z}=movement.point,moved=movement.moving;
      g.position.set(x,surface?.02:this.groundHeight(x,z),z);
      const working=Boolean(indoor)&&!moved&&!['rest','offline','queue'].includes(actor.interiorSnapshot().action);
      g.userData.activity=moved?'walking':actor.interiorSnapshot().action;
      // Actual displacement controls facing; lagging yaw made sharp turns look like reverse walking.
      if(moved)g.rotation.y=movement.heading;
      else if(indoor)g.rotation.y=angles[indoor.motion?.facing??'up'];
      // Stand at a collision-safe workstation approach. Seating needs an explicit seat contact,
      // not merely a furniture assignment (which previously raised actors into empty space).
      animateHuman(g,now/1000,moved,working,false,dt);
    }
    const guide=guideFor(this.world),tracked=guide?.trackedAgent();
    this.guideLine.material.uniforms.time!.value=now/1000;this.guideLine.material.uniforms.motion!.value=this.reduced.matches?0:1;
    this.guideLine.visible=Boolean(tracked)&&!surface;
    if(this.guideLine.visible&&now-this.guideLineAt>500){
      this.guideLineAt=now;
      const building=this.world.worldDefinition.buildings.find(b=>b.id===guide?.trackedBuilding());
      const targetActor=context.agents.find(a=>a.agentId===tracked);
      const end=building?.entrance.outside??(targetActor?{x:targetActor.sprite.x/16-.5,y:targetActor.sprite.y/16-.5}:undefined);
      const start=state.active?state.point:this.world.worldDefinition.spawn;
      const points=end?nav.route(start,end):[];
      this.guideLine.geometry.dispose();this.guideLine.geometry=smokeRoute(points.map(q=>new T.Vector3(q.x,this.groundHeight(q.x,q.y)+.12,q.y)));
    }
    this.immersion.setVisibleActors([...this.actors].filter(([,g])=>g.visible).map(([id,g])=>({id,x:g.position.x,y:g.position.z,roomId:surface?.buildingId??'',height:0})));
    if(now-this.actorTelemetryAt>1000){this.actorTelemetryAt=now;this.root.dataset.actors=JSON.stringify(context.agents.map(a=>{const g=this.actors.get(a.agentId);return {id:a.agentId,presence:a.presence(),visible:g?.visible,position:g?.position.toArray(),activity:g?.userData.activity};}));}
    this.workstations?.update(now,(surface?.agents??[]).map(a=>({id:a.id,furnitureId:a.motion?.furnitureId,walking:this.actors.get(a.id)?.userData.activity==='walking'})),context.snapshot?.agents??[]);
    this.refreshScreen();
    if(this.inspectedScreen){const screen=this.workstations?.screens.find(s=>s.id===this.inspectedScreen);if(screen){
      const target=screen.mesh.position.clone(),normal=new T.Vector3(0,.22,1.6).applyAxisAngle(new T.Vector3(0,1,0),screen.mesh.rotation.y);
      this.camera.position.lerp(target.clone().add(normal),this.reduced.matches?1:1-Math.exp(-dt*8));this.camera.lookAt(target);
    }}
    if(state.active&&!this.inspectedScreen){
      const target=this.player.position.clone().add(new T.Vector3(0,.43,0)),direction=target.clone().sub(this.camera.position),distance=direction.length();
      const ray=new T.Raycaster(this.camera.position,direction.normalize(),.05,Math.max(.05,distance-.2));
      if(now-this.occlusionAt>100){
        this.occlusionAt=now;
        // Query pre-batched part bounds, including canopy volume, without scanning decorative triangles.
        this.root.dataset.occluded=String(viewOccluded(surface&&this.room?this.room:this.overview,ray));
      }
      setRabbitOccluded(this.player,false);
    }else setRabbitOccluded(this.player,false);
    this.updateProximity(now);this.syncLabels(copy);this.renderer.info.reset();this.composer.render();const metrics=this.frameProbe.record(interval,performance.now()-started,now);if(metrics)this.root.dataset.performance=JSON.stringify({...metrics,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});this.frame=requestAnimationFrame(this.update);
  };
  private syncLabels(copy:ReturnType<typeof villageCopy>){
    const active=new Set<string>();
    const label=(id:string,text:string,point:T.Vector3,className:string,click?:()=>void)=>{active.add(id);let node=this.labelNodes.get(id);if(!node){node=document.createElement('button');(node as HTMLButtonElement).type='button';node.className=className;node.dataset.entity=id;this.labels.append(node);this.labelNodes.set(id,node);}if(node.textContent!==text)node.textContent=text;node.onclick=click||null;const p=point.project(this.camera);node.hidden=p.z>1||p.z<-1||Math.abs(p.x)>1||Math.abs(p.y)>1;node.style.left=`${(p.x*.5+.5)*100}%`;node.style.top=`${(-p.y*.5+.5)*100}%`;};
    if(this.immersion.viewState().active&&this.root.dataset.occluded==='true')label('inspector-position','◆ '+inspectionCopy().role,this.player.position.clone().add(new T.Vector3(0,.9,0)),'inspector-position-marker');
    const guide=guideFor(this.world);
    if(!this.room)for(const b of this.world.worldDefinition.buildings){const info=guide?.buildingInfo(b.id);if(this.immersion.viewState().active&&!info?.tracked)continue;label(b.id,info?info.label+(info.residents?'\n'+info.residents:''):b.label,new T.Vector3(b.bounds.x+2,4.7,b.bounds.y+1.5),'house-3d-label',()=>this.world.immersionContext().cutaway?.open(b.id));const node=this.labelNodes.get(b.id)!;if(node.title!==(info?.title||''))node.title=info?.title||'';node.classList.toggle('guide-tracked',Boolean(info?.tracked));}
    for(const [id,g] of this.actors)if(g.visible){const record=this.world.immersionContext().snapshot?.agents.find(a=>a.agent===id);label(`agent:${id}`,guide?.agentLabel(id)||record?.name||id,g.position.clone().setY(1.25),'agent-3d-label');this.labelNodes.get(`agent:${id}`)!.title=guide?.agentTitle(id)||'';this.labelNodes.get(`agent:${id}`)!.dataset.activity=g.userData.activity;this.labelNodes.get(`agent:${id}`)!.dataset.model=g.userData.variant;}
    const nearest=this.nearbyScreen(),immersed=this.immersion.viewState().active;
    if(!this.inspectedScreen)for(const screen of this.workstations?.screens??[]){
      if(immersed&&screen.id!==nearest?.id)continue;
      label(`screen:${screen.id}`,immersed?workstationCopy().prompt:'▣',screen.mesh.position.clone().add(new T.Vector3(0,.38,0)),'screen-3d-label',()=>this.inspectScreen(screen.id));
      const node=this.labelNodes.get(`screen:${screen.id}`)!;node.dataset.agent=screen.agentId??'';node.setAttribute('aria-label',workstationCopy().inspect);node.title=workstationCopy().inspect;
    }
    for(const [id,node] of this.labelNodes)if(!active.has(id)){node.remove();this.labelNodes.delete(id);}
  }
  destroy(){this.foodRain.dispose();this.guideLine.geometry.dispose();this.guideLine.material.dispose();this.setEnabled(false);this.closeScreen();window.removeEventListener('keydown',this.screenKey,true);this.workstations?.dispose();this.resizeObserver.disconnect();this.controls.dispose();this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();disposeGroup(this.scene);this.scene.traverse(o=>{if(o instanceof T.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m instanceof T.MeshStandardMaterial)m.map?.dispose();m.dispose();}}});this.sun.shadow.dispose();this.torch.shadow.dispose();disposeModelMaterials();disposePeopleAssets();disposeSurfaceMaterials();this.renderer.dispose();this.root.remove();}
}

import * as T from 'three';
import {createHuman,animateHuman,disposeHuman,loadPeopleAssets,disposePeopleAssets} from './people';
const host=document.querySelector<HTMLElement>('#stage')!,status=document.querySelector<HTMLElement>('#status')!;
async function start(){
 await loadPeopleAssets();
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xe9e2d2);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,20);camera.position.set(0,.93,2.8);camera.lookAt(0,.38,0);
 const sky=new T.HemisphereLight(0xf5f3e8,0xb8ac8c,2.4),sun=new T.DirectionalLight(0xffeccb,2.6);sun.position.set(-2,4,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:12});sun.shadow.normalBias=.02;scene.add(sky,sun);
 const ground=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xe9e2d2,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const inspector=createHuman('inspector',true);inspector.position.x=-.55;scene.add(inspector);
 let variant=3,agent=createHuman('preview-agent-3');agent.position.x=.55;scene.add(agent);
 let angled=false;document.getElementById('angle')!.onclick=()=>{angled=!angled;inspector.rotation.y=agent.rotation.y=angled?-.45:0;};
 let mode='idle';for(const id of ['idle','walk','work'])document.getElementById(id)!.onclick=()=>{mode=id;for(const other of ['idle','walk','work'])document.getElementById(other)!.setAttribute('aria-pressed',String(other===id));};
 document.getElementById('colour')!.onclick=()=>{disposeHuman(agent);agent=createHuman(`preview-agent-${++variant}`);agent.position.x=.55;agent.rotation.y=angled?-.45:0;scene.add(agent);};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 status.textContent='These are the runtime models: Honey inspector and coloured Honey Agents. In the village, their height is about 0.7 units against a 2-unit door.';
 let last=performance.now(),frame=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');const render=(now:number)=>{const dt=Math.min(.1,(now-last)/1000);last=now;const t=reduced.matches?0:now/1000;animateHuman(inspector,t,mode==='walk',mode==='work',false,dt);animateHuman(agent,t,mode==='walk',mode==='work',false,dt);renderer.render(scene,camera);frame=requestAnimationFrame(render);};frame=requestAnimationFrame(render);
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();disposeHuman(inspector);disposeHuman(agent);disposePeopleAssets();ground.geometry.dispose();(ground.material as T.Material).dispose();sun.shadow.dispose();renderer.dispose();},{once:true});
}
start().catch(error=>{status.textContent=`Preview could not load: ${error instanceof Error?error.message:String(error)}`;console.error(error);});

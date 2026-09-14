import * as T from 'three';
import {loadPeopleAssets,createHuman,animateHuman} from './people';
import {applyHoneyPose,sampleHoneyPose,type RabbitGait} from './honeyMotion';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const zh=navigator.language.toLowerCase().startsWith('zh');
const host=document.querySelector<HTMLElement>('#stage')!,status=document.querySelector<HTMLElement>('#status')!;
if(zh){document.documentElement.lang='zh-Hant';document.querySelector('#intro')!.textContent='骨架與步態檢查 · 拖曳旋轉、滾輪縮放';document.querySelector('#reference')!.textContent='你的參考圖';for(const [id,label] of Object.entries({front:'正面',side:'側面',back:'背面',reset:'重設視角'}))document.getElementById(id)!.textContent=label;}
async function start(){
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xe9e2d2);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.05,50),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1.2;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;
 scene.add(new T.HemisphereLight(0xfff8ec,0x96896f,2));const sun=new T.DirectionalLight(0xffecd0,2.4);sun.position.set(-3,5,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.015;scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xd8cfbd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 await loadPeopleAssets();const root=createHuman('preview',true);root.scale.setScalar(2);scene.add(root);
 const skeleton=new T.SkeletonHelper(root);skeleton.visible=false;scene.add(skeleton);
 let mode:RabbitGait|'idle'='idle',paused=false,phase=0;
 const nav=document.createElement('nav');host.after(nav);
 for(const [key,label] of Object.entries(zh?{idle:'站立',walk:'慢走',hop:'雙腳跳',bound:'四肢疾跑'}:{idle:'Idle',walk:'Walk',hop:'Hop',bound:'Bound'})){const button=document.createElement('button');button.textContent=label;button.dataset.mode=key;button.setAttribute('aria-pressed',String(key==='idle'));button.onclick=()=>{mode=key as typeof mode;host.dataset.gait=mode;for(const option of nav.querySelectorAll('[data-mode]'))option.setAttribute('aria-pressed',String((option as HTMLElement).dataset.mode===mode));};nav.append(button);}
 const pause=document.createElement('button');pause.textContent=zh?'暫停／播放':'Pause / Play';pause.onclick=()=>{paused=!paused;};nav.append(pause);
 const joints=document.createElement('button');joints.textContent=zh?'顯示／隱藏骨架':'Show / hide skeleton';joints.onclick=()=>{skeleton.visible=!skeleton.visible;};nav.append(joints);
 const scrub=document.createElement('input');scrub.type='range';scrub.min='0';scrub.max='1';scrub.step='.01';scrub.setAttribute('aria-label','Animation phase');scrub.oninput=()=>{paused=true;phase=Number(scrub.value);};nav.append(scrub);
 controls.target.set(0,.78,0);
 const view=(x:number,z:number)=>{const distance=Math.max(3.6,3/Math.max(.3,camera.aspect));camera.position.set(x/3.6*distance,1.05,z/3.6*distance);controls.target.set(0,.68,mode==='bound'?.5:0);controls.update();};
 document.getElementById('front')!.onclick=()=>view(0,3.6);document.getElementById('side')!.onclick=()=>view(3.6,0);document.getElementById('back')!.onclick=()=>view(0,-3.6);document.getElementById('reset')!.onclick=()=>view(1.2,3.4);view(1.2,3.4);
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 status.textContent=zh?'25 個關節 · 52,000 三角面 · 原始 PBR 貼圖 · 三種步態':'25 joints · 52,000 triangles · Original PBR textures · Three gaits';host.dataset.loaded='true';
 let frame=0,last=performance.now();const render=()=>{const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;if(paused)applyHoneyPose(root.userData.bindings,sampleHoneyPose(phase,mode==='idle'?'walk':mode,mode==='idle'?0:1));else{animateHuman(root,now/1000,mode!=='idle',false,false,dt,mode==='idle'?'walk':mode);phase=root.userData.cycle;scrub.value=String(phase);}controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);};render();
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();const textures=new Set<T.Texture>(),materials=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>{for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());sun.shadow.dispose();renderer.dispose();},{once:true});
}
start().catch(error=>{status.textContent=String(error);console.error(error);});

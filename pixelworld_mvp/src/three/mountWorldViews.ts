import {VillageGuide} from '../ui/VillageGuide';
import type { WorldScene } from '../scenes/WorldScene';
import type { ImmersionController } from '../player/ImmersionController';
import type { Village3D } from './Village3D';
import { dayNightAt } from '../world/dayNight';
import {licensedOfficeAvailable} from '../rendering/assetManifest';

export function mountWorldViews(world:WorldScene,immersion:ImmersionController) {
  let view:Village3D|undefined,requested='2d',generation=0;
  const notice=document.createElement('p');notice.className='view-error';notice.hidden=true;notice.setAttribute('role','status');document.querySelector('#app-shell')?.append(notice);
  new VillageGuide(world);
  const localError=()=>({'zh-TW':'這個裝置無法啟用 3D，已保留 2D 視角。','en-US':'3D is unavailable on this device. The 2D view is still available.','ja-JP':'この端末では 3D を利用できません。2D を表示します。','ko-KR':'이 기기에서 3D 를 사용할 수 없습니다. 2D 를 표시합니다.'} as Record<string,string>)[document.documentElement.lang]||'3D unavailable. Please use 2D.';
  const publish=(mode:string)=>{window.parent.postMessage({type:'pixelverse.view.changed',mode},window.location.origin);document.documentElement.dataset.view=mode;};
  const switchView=async(mode:string)=>{
    if(mode!=='2d'&&mode!=='3d')return;requested=mode;const version=++generation;notice.hidden=true;
    if(mode==='2d'){view?.setEnabled(false);publish('2d');if(!licensedOfficeAvailable()){notice.textContent=document.documentElement.lang==='zh-TW'?'完整 2D 家具需另行安裝 Modern Office 素材；請依 README 安裝引導。3D 不需購買素材。':'Full 2D furniture requires the optional Modern Office pack. Follow the README asset guide, or use the included 3D world.';notice.hidden=false;}return;}
    try {const {Village3D,prepareVillageAssets}=await import('./Village3D');if(version!==generation)return;
      if(prepareVillageAssets)await prepareVillageAssets();if(version!==generation)return;
      view??=new Village3D(world,immersion);if(version!==generation)return;view.setEnabled(true);publish('3d');
    }catch{view?.setEnabled(false);requested='2d';publish('2d');notice.textContent=localError();notice.hidden=false;}
  };
  const receive=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='pixelverse.view.set')void switchView(event.data.mode);};
  const lost=()=>{void switchView('2d');view?.destroy();view=undefined;notice.textContent=localError();notice.hidden=false;};
  window.addEventListener('message',receive);window.addEventListener('pixelverse:3d-unavailable',lost);
  let standalone:HTMLElement|undefined;
  if(window.parent===window){standalone=document.createElement('nav');standalone.className='standalone-view-switch';for(const mode of ['2d','3d']){const b=document.createElement('button');b.textContent=mode.toUpperCase();b.onclick=()=>void switchView(mode);standalone.append(b);}document.querySelector('#app-shell')?.append(standalone);}
  // Phaser overlay stays in world coordinates, so light follows player and camera zoom.
  const night=world.add.graphics().setDepth(8990);
  let last=0;
  const tick=(time:number)=>{if(time-last<100)return;last=time;night.clear();if(requested==='3d')return;
    const cycle=dayNightAt(Date.now()),s=immersion.viewState();if(cycle.daylight>=1||s.roomId)return;
    const alpha=(1-cycle.daylight)*.5,w=world.worldDefinition.width*16,h=world.worldDefinition.height*16;
    if(!s.active){night.fillStyle(0x14233f,alpha).fillRect(0,0,w,h);return;}
    // Tile-sized darkness samples approximate a soft handheld pool without tinting the UI.
    const px=s.point.x*16+8,py=s.point.y*16+8;
    for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const distance=Math.hypot(x+4-px,y+4-py);night.fillStyle(0x14233f,alpha*Math.min(1,Math.max(.08,(distance-15)/55))).fillRect(x,y,8,8);}
  };
  world.events.on('postupdate',tick);window.parent.postMessage({type:'pixelverse.view.ready'},location.origin);
  if(window.parent===window)void switchView('3d');
  world.events.once('shutdown',()=>{generation++;view?.destroy();night.destroy();notice.remove();standalone?.remove();window.removeEventListener('message',receive);window.removeEventListener('pixelverse:3d-unavailable',lost);world.events.off('postupdate',tick);});
}

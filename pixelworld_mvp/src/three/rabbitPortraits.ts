import * as T from 'three';
import {createHuman,animateHuman,disposeHuman} from './people';
import {rabbitIdentity} from '../../../public/agent_identity.mjs';
/** Render the actual skinned village asset and coat materials once, not reference art. */
export function rabbitPortraits(renderer:T.WebGLRenderer):string[]{
 const scene=new T.Scene();scene.background=new T.Color(0xe6decb);scene.add(new T.HemisphereLight(0xffffff,0x7d8a72,2.4));const key=new T.DirectionalLight(0xffefcf,3);key.position.set(-2,4,3);scene.add(key);
 const camera=new T.OrthographicCamera(-.52,.52,.55,-.55,.1,10);camera.position.set(.2,.60,3);camera.lookAt(0,.46,0);
 const target=new T.WebGLRenderTarget(128,128),prior=renderer.getRenderTarget(),pixels=new Uint8Array(128*128*4),canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!,image=c.createImageData(128,128),sources:string[]=[];
 target.texture.colorSpace=T.SRGBColorSpace;
 try{for(let index=0;index<6;index++){let id='';for(let n=0;;n++){id=`portrait-${n}`;if(rabbitIdentity(id).index===index)break;}const rabbit=createHuman(id);scene.add(rabbit);animateHuman(rabbit,0,false,false);rabbit.updateMatrixWorld(true);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);for(let y=0;y<128;y++)image.data.set(pixels.subarray((127-y)*512,(128-y)*512),y*512);c.putImageData(image,0,0);sources.push(canvas.toDataURL('image/png'));disposeHuman(rabbit);}}
 finally{renderer.setRenderTarget(prior);target.dispose();}
 return sources;
}

import * as T from 'three';
const cache=new Map<string,T.MeshStandardMaterial>();
/** Original repeatable texture maps; generated once, shared across every room. */
export function surfaceMaterial(kind:'wood'|'plaster'|'fabric',color:number,repeatX=1,repeatY=1){
 const key=`${kind}:${color}:${repeatX}:${repeatY}`;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!;
 const bump=document.createElement('canvas');bump.width=bump.height=512;const b=bump.getContext('2d')!;
 ctx.fillStyle='#eee7d8';ctx.fillRect(0,0,512,512);b.fillStyle='#888';b.fillRect(0,0,512,512);
 let seed=47;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 if(kind==='wood'){
  for(let row=0;row<4;row++){const y=row*128;ctx.fillStyle=`hsl(38 22% ${84+random()*4}%)`;ctx.fillRect(0,y,512,128);
   for(let j=0;j<18;j++){const yy=y+random()*128,x=random()*512;ctx.strokeStyle=`rgba(68,48,28,${random()*.055})`;ctx.beginPath();ctx.moveTo(x,yy);ctx.bezierCurveTo(x+55,yy-2,x+145,yy+3,x+220,yy);ctx.stroke();}
   ctx.fillStyle='#baaa8e';ctx.fillRect(0,y,512,1);b.fillStyle='#333';b.fillRect(0,y,512,1);
   const seam=(row%3)*165+40;ctx.fillStyle='#baaa8e';ctx.fillRect(seam,y,1,128);b.fillStyle='#444';b.fillRect(seam,y,1,128);
  }
 }else for(let i=0;i<5000;i++){const x=random()*512,y=random()*512,v=Math.floor(110+random()*70);ctx.fillStyle=`rgba(${v},${v},${v},.055)`;ctx.fillRect(x,y,kind==='fabric'?2:1,1);b.fillStyle=`rgb(${v},${v},${v})`;b.fillRect(x,y,1,1);}
 if(kind==='fabric'){ctx.strokeStyle='#ffffff16';for(let x=0;x<512;x+=4){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}}
 const texture=new T.CanvasTexture(canvas),bumpMap=new T.CanvasTexture(bump);texture.colorSpace=T.SRGBColorSpace;
 for(const map of [texture,bumpMap]){map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=4;}
 const material=new T.MeshStandardMaterial({color,map:texture,bumpMap,bumpScale:kind==='wood'?.004:.002,roughness:.92});cache.set(key,material);return material;
}
export function disposeSurfaceMaterials(){cache.forEach(m=>{m.map?.dispose();m.bumpMap?.dispose();m.dispose();});cache.clear();}

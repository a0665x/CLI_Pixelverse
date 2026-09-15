import {officeFamily,freeOfficeTexture} from './officePack';
import {VILLAGE_FURNITURE_CATALOG} from './villageFurnitureCatalog';
import type Phaser from 'phaser';
import {MODERN_OFFICE_CATALOG,catalogFurnitureSemantic,type ModernOfficeCatalogItem} from './modernOfficeCatalog';
import {MODERN_OFFICE_ASSETS} from './modernOfficeManifest';
/** Original pixel furniture, drawn from primitives; no commercial sprite pixels are read. */
export function drawFreeOffice(c:CanvasRenderingContext2D,item:ModernOfficeCatalogItem){
 const b=item.opaqueBounds,w=b.width,h=b.height,semantic=catalogFurnitureSemantic(item.id);
 c.save();c.translate(b.x,b.y);c.imageSmoothingEnabled=false;
 const rect=(x:number,y:number,rw:number,rh:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(rw)),Math.max(1,Math.round(rh)));};
 // Keep the authored envelope for old placements and overlays, with distinct original interiors.
 rect(0,0,w,h,'#485849');rect(1,1,w-2,h-2,'#a58b62');
 if(item.category==='screens-electronics'||semantic==='work'){
  rect(1,1,w-2,h*.67,'#384e4a');rect(2,2,w-4,h*.49,'#91b9a5');
  for(let i=0;i<3;i++)rect(3,3+i*3,w*(.65-i*.12),1,'#e2e9c7');rect(w*.43,h*.65,w*.14,h*.22,'#58655b');rect(w*.2,h*.86,w*.6,h*.1,'#d0c7a4');
 }else if(item.category==='storage-partitions'){
  rect(2,1,w-4,h-3,'#617c69');for(let row=0;row<3;row++){const y=2+row*(h-3)/3;for(let i=0;i<Math.max(1,Math.floor(w/5));i++)rect(3+i*4,y,2,(h-3)/3-2,['#d1b777','#9eb2a1','#c9916d'][i%3]!);rect(1,y+(h-3)/3-1,w-2,1,'#dcc39a');}
 }else if(item.category==='seating-plants'){
  if(semantic==='rest'){rect(1,1,w-2,h*.35,'#98ab8b');rect(2,h*.4,w-4,h*.42,'#789580');rect(w*.48,h*.42,1,h*.4,'#bed0a0');rect(0,h*.32,2,h*.6,'#b1bf98');rect(w-2,h*.32,2,h*.6,'#b1bf98');}
  else {rect(w*.22,h*.63,w*.56,h*.34,'#bb8057');for(let i=0;i<5;i++){c.fillStyle=i%2?'#86a56b':'#587e52';c.beginPath();c.ellipse(w/2+Math.sin(i*2.4)*w*.23,h*.35+Math.cos(i*2.4)*h*.16,Math.max(1,w*.22),Math.max(1,h*.18),i,0,Math.PI*2);c.fill();}}
 }else{
  rect(1,1,w-2,h*.55,'#cbb38b');rect(2,2,w-4,1,'#eee0b6');rect(2,h*.57,Math.max(2,w*.14),h*.4,'#7b7054');rect(w*.75,h*.57,Math.max(2,w*.14),h*.4,'#7b7054');
  if(h>12&&w>12){rect(w*.52,3,w*.3,h*.22,'#e5dfbf');rect(w*.12,3,w*.2,h*.16,'#6c907f');}
 }
 c.restore();
}
export function installFreeOfficeArt(scene:Phaser.Scene){
 if(!scene.textures?.createCanvas)return;
 const paint=(c:CanvasRenderingContext2D,item:ModernOfficeCatalogItem)=>{const source=scene.textures.get?.(freeOfficeTexture(officeFamily(item)))?.getSourceImage();if(source){const b=item.opaqueBounds;c.drawImage(source as HTMLImageElement,b.x,b.y,b.width,b.height);}else drawFreeOffice(c,item);};
 for(const item of [...MODERN_OFFICE_CATALOG,...VILLAGE_FURNITURE_CATALOG]){
 const key=`woodland-piece-${item.id}`;
 if(!scene.textures.exists(key)){const source=scene.textures.get?.(freeOfficeTexture(officeFamily(item)))?.getSourceImage();const texture=scene.textures.createCanvas(key,64,64);if(texture&&source){texture.context.drawImage(source as HTMLImageElement,0,0,64,64);texture.refresh();}}
if(scene.textures.exists(item.key))continue;const texture=scene.textures.createCanvas(item.key,item.sourceWidth??32,item.sourceHeight??48);if(texture){paint(texture.context,item);texture.refresh();}}
 for(const asset of Object.values(MODERN_OFFICE_ASSETS.furniture)){if(scene.textures.exists(asset.key))continue;const id=Number(asset.path.match(/Singles_(\d+)/)?.[1]);const item=MODERN_OFFICE_CATALOG.find(x=>x.id===id);if(item){const texture=scene.textures.createCanvas(asset.key,item.sourceWidth??32,item.sourceHeight??48);if(texture){paint(texture.context,item);texture.refresh();}}}
}

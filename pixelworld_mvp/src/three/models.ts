import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {surfaceMaterial} from './surfaceMaterials';
import * as T from 'three';
import { workstationYaw, workstationSeats, integratedScreenKinds } from './workstations';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FurnitureDefinition, InteriorDefinition, WorldBuilding } from '../world/types';

// Original, generated geometry. No downloaded or paid 3D assets.
const villageWalls=[0xe0d0ab,0xd2d5b7,0xd8c9b7,0xc9d3ce];
const villageTimber=0x715744;
const materials = new Map<string,T.MeshStandardMaterial>();
export function material(color:number, glow=false) {
  const key=`${color}:${glow}`;
  if(!materials.has(key)) materials.set(key,new T.MeshStandardMaterial({color,roughness:.78,metalness:glow?.1:0,emissive:glow?color:0,emissiveIntensity:glow?1:0}));
  return materials.get(key)!;
}
export function box(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:number,glow=false) {
  const mesh=new T.Mesh((Math.min(w,h,d)>.06&&Math.max(w,h,d)<30?new RoundedBoxGeometry(w,h,d,1,Math.min(.065,Math.min(w,h,d)*.22)):new T.BoxGeometry(w,h,d)),material(color,glow));
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function cylinder(parent:T.Object3D,x:number,y:number,z:number,r:number,h:number,color:number,top=r) {
  const mesh=new T.Mesh(new T.CylinderGeometry(top,r,h,16),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function orb(parent:T.Object3D,x:number,y:number,z:number,r:number,color:number) {
  const mesh=new T.Mesh(new T.SphereGeometry(r,16,12),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
export function plant(parent:T.Object3D,x:number,z:number,scale=1) {
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cylinder(g,0,.2,0,.19,.4,0x9b6347,.25);
  cylinder(g,0,.58,0,.03,.65,0x65583b);
  for(let i=0;i<6;i++) {const a=i*2.4;const leaf=orb(g,Math.cos(a)*.18,.6+i*.065,Math.sin(a)*.18,.23,i%2?0x597b49:0x799655);leaf.scale.set(.7,.6,1.6);leaf.rotation.y=-a;}
}
export function tree(parent:T.Object3D,x:number,z:number,index:number) {
  cylinder(parent,x,1.1,z,.2,2.3,0x66503b,.12);
  for(let i=0;i<4;i++) orb(parent,x+Math.sin(i*2.4)*.6,2.4+i*.2,z+Math.cos(i*2.4)*.5,1.05,[0x627347,0x7c874d,0x516c48,0x87924e][(i+index)%4]!);
  for(let i=0;i<8;i++){const a=i*2.4;orb(parent,x+Math.sin(a)*.85,2.6+(i%3)*.35,z+Math.cos(a)*.85,.48,[0x7c905b,0x8c9d67,0x657d53][i%3]!);}
  for(let i=0;i<3;i++) {const root=box(parent,x+Math.sin(i*2)*.14,.11,z+Math.cos(i*2)*.14,.13,.16,.9,0x66503b);root.rotation.y=i*2;}
}
function archPanel(parent:T.Object3D,x:number,y:number,z:number,width:number,height:number,depth:number,color:number){
 const r=width/2,shape=new T.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,height-r);shape.absarc(0,height-r,r,0,Math.PI,false);shape.lineTo(-r,0);
 const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.022,bevelThickness:.014,bevelSegments:2,steps:1,curveSegments:16});
 const mesh=new T.Mesh(geometry,material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function house(parent:T.Object3D,b:WorldBuilding,index:number) {
  const {x,y,width:w,height:d}=b.bounds;const g=new T.Group();g.position.set(x+w/2-.5,0,y+d/2-.5);g.userData.buildingId=b.id;parent.add(g);
  const plaster=villageWalls[((index%4)+4)%4]!;
  const roof=[0x687f81,0x748780,0x8e7963,0x637b86][index%4]!;
  box(g,0,.17,0,w,.34,d,0x797a68);box(g,0,1.25,0,w-.2,2.2,d-.2,plaster);
  for(const xx of [-w/2+.08,w/2-.08]) for(const zz of [-d/2+.08,d/2-.08])box(g,xx,1.25,zz,.16,2.35,.16,0x655142);
  archPanel(g,0,.18,d/2-.03,1.22,2.05,.08,0x715744);
  archPanel(g,0,.20,d/2+.06,1.02,1.89,.025,0xa18559);
  for(let i=0;i<5;i++)box(g,-.40+i*.20,.89,d/2+.11,.012,1.34,.015,0x856b49);
  for(const yy of [.55,1.1])box(g,-.32,yy,d/2+.15,.22,.05,.035,0x514b3f);
  cylinder(g,.25,.95,d/2+.1,.045,.07,0xb89a55).rotation.x=Math.PI/2;
  for(const xx of [-1.45,1.45]) {
    archPanel(g,xx,.99,d/2-.04,1.03,1.06,.10,0x715744);
    archPanel(g,xx,1.05,d/2+.07,.83,.88,.025,0xd8c799).name='window';
    box(g,xx,1.4,d/2+.085,.04,.7,.04,0x675840);box(g,xx,1.4,d/2+.085,.8,.04,.04,0x675840);
    box(g,xx,.94,d/2+.13,1.12,.12,.38,0x756250);
    for(let i=0;i<4;i++)orb(g,xx-.35+i*.22,1.02,d/2+.13,.14,0x55764e);
  }
  const pitch=.55;const half=d/2+.32;const roofLen=half/Math.cos(pitch);
  for(const side of [-1,1]) {
    const p=box(g,0,2.38+Math.sin(pitch)*roofLen/2,side*half/2,w+.65,.18,roofLen,roof);p.rotation.x=side*pitch;
    const columns=Math.ceil((w+.65)/.58),tileWidth=(w+.65)/columns;
    for(let row=0;row<8;row++)for(let col=0;col<columns;col++){
      const t=(row+.5)/8,xx=-(w+.65)/2+(col+.5)*tileWidth;
      const tile=box(g,xx,2.43+(1-t)*Math.sin(pitch)*roofLen,side*t*half,tileWidth-.022,.09,roofLen/8*1.07,(row+col)%4===0?0x83948b:roof);tile.rotation.x=side*pitch;
    }
  }
  box(g,0,3.6,0,w+.72,.14,.16,roof);
  // Gable under the ridge, avoiding open roof ends.
  const shape=new T.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,1.25);shape.closePath();
  for(const side of [-1,1]) {const m=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:plaster,side:T.DoubleSide}));m.rotation.y=Math.PI/2;m.position.set(side*(w/2-.1),2.25,0);g.add(m);}
  box(g,-w/2+1,3.25,-.4,.55,1.4,.6,0x807a68);box(g,-w/2+1,4,-.4,.7,.12,.72,0x5e6259);
  box(g,0,.12,d/2+.32,1.35,.24,.75,0x9c9985);
  plant(g,-w/2+.35,d/2+.1,.8);plant(g,w/2-.35,d/2+.1,.65);
  for(let xx=-w/2+.3;xx<w/2;xx+=.58)box(g,xx,.20,d/2+.025,.54,.26,.18,Math.round(xx*10)%2?0xa6a58a:0xb8b29a);
  // Climbing foliage stays attached to the facade, outside the entrance lane.
  for(let i=0;i<12;i++){const xx=w/2-.35+Math.sin(i*1.8)*.14,yy=.48+i*.15;orb(g,xx,yy,d/2+.10,.13,i%3?0x6f8750:0x91a36b);if(i%3===0)orb(g,xx-.12,yy+.05,d/2+.21,.055,0xebd6b3);}
  if(typeof document!=='undefined')g.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial){const c=o.material.color.getHex();if(c===plaster)o.material=surfaceMaterial('plaster',c,2,2);else if([0x715744,0xa18559,0x655142,0x756250].includes(c))o.material=surfaceMaterial('wood',c,1,1);}});
  return g;
}
function desk(parent:T.Object3D,kind:string) {
  box(parent,0,.78,0,1.8,.12,.85,0xa58c64);
  for(const x of [-.72,.72]) {box(parent,x,.38,0,.09,.75,.65,0x3d4949);box(parent,x,.08,0,.35,.07,.7,0x3d4949);}
  if(!['meeting-table','map-table','desk'].includes(kind)) {
    box(parent,0,1.17,-.14,.79,.5,.065,0x263333);box(parent,0,1.18,-.098,.69,.39,.01,0x609caa,true);
    box(parent,0,.94,-.15,.055,.25,.055,0x343e40);box(parent,0,.855,-.15,.32,.03,.22,0x414e4b);
    box(parent,-.1,.866,.23,.55,.03,.17,0x354545);
    for(let r=0;r<3;r++)for(let c=0;c<8;c++)box(parent,-.33+c*.065,.886,.18+r*.045,.043,.005,.022,0x9ea9a1);
    box(parent,.45,.867,.23,.13,.04,.17,0x354545);
    box(parent,.69,.25,-.15,.25,.45,.42,0x344141);
    for(let i=0;i<3;i++)box(parent,.69,.25+i*.05,.065,.15,.015,.01,0x739384);
  } else {
    box(parent,0,.86,0,1.25,.02,.55,0xd9d4bc);
    for(let i=0;i<5;i++)box(parent,-.5+i*.2,.877,.02,.09,.005,.34,0xa8b4a0);
  }
  cylinder(parent,.65,.93,.18,.065,.16,0xe5d7bb);
  for(let i=0;i<3;i++)box(parent,-.62,.86+i*.012,.08,.27,.009,.34,0xd7d2bb);
  cylinder(parent,-.7,1.2,-.27,.023,.68,0x384747);
  const lamp=cylinder(parent,-.61,1.5,-.27,.16,.12,0xd0b16c,.06);lamp.rotation.z=-.3;
}
function chair(parent:T.Object3D) {
  cylinder(parent,0,.28,0,.045,.5,0x41494a);box(parent,0,.48,0,.5,.12,.5,0x647878);box(parent,0,.77,.22,.5,.5,.1,0x647878);
  for(let i=0;i<5;i++){const b=box(parent,0,.08,0,.08,.07,.65,0x3c4547);b.rotation.y=i*Math.PI/5;}
  for(const x of [-.3,.3])box(parent,x,.65,0,.055,.1,.4,0x434d4d);
}
export function furnishing(parent:T.Object3D,f:FurnitureDefinition) {
  const g=new T.Group();g.position.set(f.point.x,0,f.point.y);g.rotation.y=(f.rotation||0)*Math.PI/180;parent.add(g);
  const k=f.kind;
  if(['display','chair','office-chair',...integratedScreenKinds].includes(k))g.rotation.y=workstationYaw(f);
  if(k==='desk')g.scale.set(.55,1,.8);
  if(k==='cabinet'||(k==='bookcase'&&f.assetId===180))g.scale.x=.74;
  if(['computer','desk','workbench','repair-table','reading-desk','response-desk','dispatch-pod','radio-console','meeting-table','map-table'].includes(k)) desk(g,k);
  else if(['chair','office-chair'].includes(k))chair(g);
  else if(k==='plant')plant(g,0,0);
  else if(k==='cabinet'&&f.layer==='surface') {
    box(g,0,1.12,0,1.25,.48,.08,0x718c88);
    box(g,0,1.38,0,1.3,.04,.1,0x93a59a);
  } else if(k==='bookcase'||k==='cabinet') {
    box(g,0,.95,-.25,1.35,1.9,.12,0x88775e);box(g,0,1.92,0,1.43,.06,.6,0x9a8869);
    for(const x of [-.65,.65])box(g,x,.95,0,.08,1.9,.6,0x9a8869);
    for(let row=0;row<4;row++) {box(g,0,.12+row*.5,0,1.3,.06,.6,0x9a8869);for(let j=0;j<7;j++)box(g,-.5+j*.16,.32+row*.5,.02,.115,.3+(j%3)*.03,.35,[0x667e7e,0xa77a5b,0x9c9c72,0xd0c3a1][(j+row)%4]!);}
  } else if(k==='sofa') {
    box(g,0,.35,0,1.8,.5,.8,0x68847a);box(g,0,.8,-.34,1.8,.6,.18,0x58776d);
    for(const x of [-.83,.83])box(g,x,.6,0,.18,.45,.9,0x58776d);
    for(const x of [-.4,.4])box(g,x,.64,0,.74,.1,.63,0x83a090);
    box(g,.55,.85,-.1,.36,.35,.14,0xc7ac72);
  } else if(k==='bed') {
    box(g,0,.25,0,1.3,.4,2,0x877052);box(g,0,.53,0,1.25,.2,1.95,0xe1d8bf);box(g,0,.66,-.64,.95,.18,.4,0xf1e8cd);box(g,0,.66,.35,1.25,.06,1.15,0x6f9391);
  } else if(k==='planning-board'||k==='tool-wall') {
    box(g,0,1.8,0,1.7,1,.1,0x8e7659);box(g,0,1.8,.065,1.56,.87,.02,0xd6d8c5);
    for(let i=0;i<6;i++)box(g,-.55+(i%3)*.45,1.55+Math.floor(i/3)*.37,.085,.28,.21,.01,[0xc5ad68,0x82a5a0,0xb99783][i%3]!);
  } else if(k==='beverage-station'||k==='printer') {
    box(g,0,.5,0,.8,1,.65,0xb9beb0);box(g,0,1.15,0,.65,.3,.5,0x414e4b);box(g,0,1.32,.1,.47,.02,.31,0xe1dfce);cylinder(g,.15,1.45,-.1,.12,.24,0x9bafa5);
  } else if(k==='display') {
    box(g,0,1.2,0,.75,.5,.08,0x263333);box(g,0,1.2,.045,.65,.4,.01,0x172b33);
    cylinder(g,0,.99,0,.035,.3,0x3c484a);box(g,0,.855,0,.32,.03,.22,0x3c484a);
    box(g,0,.86,.26,.58,.03,.18,0x34434a);
    for(let r=0;r<3;r++)for(let c=0;c<9;c++)box(g,-.24+c*.059,.88,.21+r*.044,.04,.007,.022,0x9aaba7);
    box(g,.39,.865,.25,.1,.035,.15,0x34434a);
  } else if(k==='television') {
    box(g,0,.35,0,1.2,.7,.48,0x88775e);box(g,0,1.03,0,1.1,.65,.12,0x344141);box(g,0,1.03,.065,.96,.52,.012,0x527d83);
  } else if(f.layer==='floor') {
    box(g,0,.018,0,Math.max(.5,f.footprint?.width??1),.02,Math.max(.5,f.footprint?.height??1),0x789085);
  } else if(f.layer==='wall') {
    box(g,0,1.65,0,.85,.65,.08,0x715744);box(g,0,1.65,.045,.73,.53,.01,0xabb89b);
  } else if(f.layer==='surface'||f.supportedByIds?.length) {
    // Desktop accessories have an authored support height, never a generic floating cube.
    for(let i=0;i<3;i++)box(g,0,.855+i*.06,0,.3,.055,.32,[0x6e8880,0xaa8862,0xd0c6a9][i]!);
  } else {
    // Standalone catalog decorations get a grounded cabinet, not paper at desk height.
    box(g,0,.38,0,.72,.76,.52,0x927854);box(g,0,.78,0,.78,.06,.56,0xb29b73);
    for(const x of [-.16,.16])box(g,x,.41,.27,.27,.6,.025,0xa48c68);
  }
  return g;
}
export function roomModel(interior:InteriorDefinition,index:number) {
  const g=new T.Group(),w=interior.width,d=interior.height;
  box(g,w/2-.5,-.16,d/2-.5,w,.3,d,0x575f52);
  const floor=box(g,w/2-.5,.006,d/2-.5,w,.02,d,0xc6ae86);
  if(typeof document!=='undefined')floor.material=surfaceMaterial('wood',0xc6ae86,w/8,d/8);
  const wall=villageWalls[((index%4)+4)%4]!;
  box(g,w/2-.5,1.65,-.58,w,3.3,.16,wall);box(g,-.58,1.3,d/2-.5,.16,2.6,d,wall);box(g,w-.42,1.3,d/2-.5,.16,2.6,d,wall);
  for(const z of [-.46]){box(g,w/2-.5,.12,z,w,.2,.08,villageTimber);box(g,w/2-.5,3.25,z,w,.14,.16,villageTimber);}
  // Match the exterior's timber posts, cross windows and planted sills.
  for(const x of [-.44,w-.56])box(g,x,1.6,-.43,.18,3.2,.2,villageTimber);
  for(const x of [-.46,w-.54])box(g,x,.14,d/2-.5,.1,.23,d,villageTimber);
  for(let x=2;x<w-2;x+=5) {
    archPanel(g,x,1.62,-.45,2,1.40,.10,villageTimber);
    archPanel(g,x,1.67,-.34,1.76,1.20,.025,0xc5d9bd);
    box(g,x,2.25,-.32,.07,1.1,.05,villageTimber);
    box(g,x,2.25,-.32,1.8,.07,.05,villageTimber);
    box(g,x,1.6,-.27,2.15,.12,.45,0xa58c64);
    const pot=new T.Group();pot.position.set(x+.65,1.66,-.23);g.add(pot);plant(pot,0,0,.38);
  }
  // Entrance mat leaves a clear central circulation lane.
  box(g,Math.floor(w/2),.025,d-1,2,.025,1.2,0x6e8680);
  box(g,3.5,.027,d>9?8:6,4.5,.02,2.6,0x6e8880);
  for(const x of [1.3,5.7])box(g,x,.04,d>9?8:6,.05,.007,2.5,0xc5c1a3);
  for(const z of [(d>9?8:6)-1.22,(d>9?8:6)+1.22])box(g,3.5,.04,z,4.4,.007,.05,0xc5c1a3);
  for(const z of [2.8,d-3])box(g,w/2-.5,3.18,z,w,.18,.17,villageTimber);
  const seats=[...workstationSeats(interior).values()];
  for(let x=3;x<w-1;x+=5){box(g,x,3.18,2,.9,.09,.3,0x485653);box(g,x,3.12,2,.78,.025,.22,0xffe9bc,true);}
  interior.furniture.forEach(f=>{
    // Keep visual bodies at exactly the coordinates consumed by collision/navigation.
    // A screen/seat association must not silently relocate only the rendered chair.
    if(f.layer==='surface'&&f.kind==='decor'){
      const support=interior.furniture.find(s=>s.id!==f.id&&s.layer!=='surface'&&(f.supportedByIds?.includes(s.id)||Math.hypot(s.point.x-f.point.x,s.point.y-f.point.y)<.55));
      if(!support)return;
      const item=furnishing(g,f);if(support.kind==='bed'||support.kind==='sofa')item.position.y=-.15;
    }else furnishing(g,f);
  });
  if(typeof document!=='undefined')g.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial){
    const color=o.material.color.getHex();
    if([0xa58c64,0x9a8869,0x88775e,0x877052].includes(color))o.material=surfaceMaterial('wood',color,1,.5);
    else if([0x647878,0x68847a,0x58776d,0x83a090].includes(color))o.material=surfaceMaterial('fabric',color,2,2);
    else if(color===wall)o.material=surfaceMaterial('plaster',wall,2,2);
  }});
  return g;
}
/** Rounded, articulated human rig. Joint pivots are at anatomical attachment points. */
export function character(color:number, identity='player') {
  const seed=[...identity].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
  const skin=[0xd8b293,0xae8064,0x825b46,0xe0beaa][seed%4]!;
  const hair=[0x302a27,0x584333,0x6c6256,0x25292b][(seed>>>3)%4]!;
  const g=new T.Group(),body=new T.Group();g.add(body);
  function ellipsoid(parent:T.Object3D,x:number,y:number,z:number,rx:number,ry:number,rz:number,c:number) {
    const m=new T.Mesh(new T.SphereGeometry(1,20,14),material(c));m.position.set(x,y,z);m.scale.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function limb(parent:T.Object3D,x:number,y:number,length:number,r:number,c:number){
    const joint=new T.Group();joint.position.set(x,y,0);parent.add(joint);
    const mesh=new T.Mesh(new T.CapsuleGeometry(r,Math.max(.01,length-r*.6),5,12),material(c));mesh.position.y=-length/2;mesh.castShadow=true;joint.add(mesh);return joint;
  }
  // Tapered coat, collar, seams and layered shirt retain a readable silhouette at game scale.
  const profile=[new T.Vector2(.18,.73),new T.Vector2(.22,.77),new T.Vector2(.19,.93),new T.Vector2(.23,1.15),new T.Vector2(.19,1.23),new T.Vector2(.095,1.27)];
  const coat=new T.Mesh(new T.LatheGeometry(profile,24),material(color));coat.scale.z=.68;coat.castShadow=true;body.add(coat);
  ellipsoid(body,0,.75,0,.18,.13,.13,0x34434a);
  ellipsoid(body,0,1.27,0,.074,.1,.07,skin);
  box(body,0,1.08,.143,.045,.26,.018,0xd9d3c1);
  for(const x of [-.07,.07]) {const collar=box(body,x,1.22,.12,.095,.13,.025,color);collar.rotation.z=x<0?-.42:.42;}
  for(let i=0;i<3;i++)ellipsoid(body,.035,.88+i*.09,.145,.012,.012,.008,0xbeb5a0);
  const head=new T.Group();head.position.y=1.44;head.scale.set(.94,.88,.94);body.add(head);
  ellipsoid(head,0,0,0,.135,.182,.122,skin);
  ellipsoid(head,0,-.062,.031,.109,.106,.103,skin);
  ellipsoid(head,0,.112,-.024,.142,.092,.124,hair);
  ellipsoid(head,0,.015,-.09,.129,.137,.054,hair);
  for(const x of [-.137,.137])ellipsoid(head,x,-.005,0,.027,.045,.025,skin);
  ellipsoid(head,0,-.015,.126,.024,.039,.035,skin);
  for(const x of [-.048,.048]) {ellipsoid(head,x,.022,.112,.019,.009,.006,0xd8c8af);ellipsoid(head,x,.022,.121,.009,.01,.006,0x333331);}
  ellipsoid(head,0,-.072,.123,.035,.007,.007,0x996b5b);
  const legs=[limb(body,-.105,.75,.34,.083,0x34434a),limb(body,.105,.75,.34,.083,0x34434a)];
  const knees=legs.map(l=>limb(l,0,-.34,.33,.065,0x39484d));
  knees.forEach(k=>ellipsoid(k,0,-.33,.06,.082,.064,.157,0x303638));
  const arms=[limb(body,-.235,1.19,.27,.071,color),limb(body,.235,1.19,.27,.071,color)];
  const elbows=arms.map(l=>limb(l,0,-.27,.25,.053,color));
  elbows.forEach(e=>ellipsoid(e,0,-.277,.008,.044,.07,.03,skin));
  // Combine rigid clothing / face details without merging across animated joints.
  for(const part of [body,head]){
    const buckets=new Map<T.Material,T.Mesh[]>();
    for(const child of [...part.children])if(child instanceof T.Mesh&&!Array.isArray(child.material)){const list=buckets.get(child.material)??[];list.push(child);buckets.set(child.material,list);}
    for(const [mat,meshes] of buckets){
      if(meshes.length<2)continue;
      const geoms=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
      const merged=mergeGeometries(geoms);geoms.forEach(geo=>geo.dispose());if(!merged)continue;
      meshes.forEach(m=>{part.remove(m);m.geometry.dispose();});const mesh=new T.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;part.add(mesh);
    }
  }
  const height=.97+(seed%7)*.009;g.scale.set(1+(seed%3)*.035,height,1);
  g.userData={body,legs,arms,knees,elbows,head,phase:(seed%100)/17};return g;
}
export function animateCharacter(g:T.Group,time:number,walking:boolean,working:boolean,seated=false,dt?:number) {
  const blend=dt===undefined?1:1-Math.exp(-dt*16);
  const approach=(from:number,to:number)=>T.MathUtils.lerp(from,to,blend);
  const {legs,arms,body,knees,elbows,head,phase}=g.userData;
  const t=time*7.5+phase,swing=walking?Math.sin(t)*.48:0;
  legs.forEach((l:T.Group,i:number)=>{l.rotation.x=approach(l.rotation.x,seated?-1.25:(i?-swing:swing));knees[i].rotation.x=approach(knees[i].rotation.x,seated?1.25:(walking?Math.max(0,Math.sin(t+i*Math.PI))*.7:.025));});
  arms.forEach((a:T.Group,i:number)=>{a.rotation.x=approach(a.rotation.x,working?-.65+(Math.sin(time*4+phase+i)*.025):(i?swing:-swing)*.65);a.rotation.z=i?-.055:.055;elbows[i].rotation.x=approach(elbows[i].rotation.x,working?-1.05+Math.sin(time*9+i)*.065:-.12-Math.max(0,i?swing:-swing)*.25);});
  body.position.y=approach(body.position.y,(seated?-.23:0)+(walking?Math.abs(Math.sin(t))*.025:Math.sin(time*1.6+phase)*.005));
  body.rotation.z=walking?Math.sin(t)*.018:0;body.rotation.x=approach(body.rotation.x,working?.15:0);
  head.rotation.x=working?.12:Math.sin(time*.65+phase)*.025;
  head.rotation.y=walking?0:Math.sin(time*.4+phase)*.06;
}
/** Merge static geometry by material: furniture richness must not cost thousands of draw calls. */
export function batchStatic(group:T.Group) {
  group.updateMatrixWorld(true);
  const buckets=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof T.Mesh && !Array.isArray(o.material)){const geom=o.geometry.clone();geom.applyMatrix4(o.matrixWorld);const list=buckets.get(o.material)||[];list.push(geom);buckets.set(o.material,list);}});
  const result=new T.Group();
  for(const [mat,geoms] of buckets){
    // Extruded/rounded parts are non-indexed; preserve them alongside indexed primitives.
    if(geoms.some(g=>g.index))for(const g of geoms)if(!g.index)g.setIndex(Array.from({length:g.attributes.position!.count},(_,i)=>i));
    const merged=mergeGeometries(geoms);if(merged){const m=new T.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;result.add(m);}geoms.forEach(g=>g.dispose());}
  group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  return result;
}
export function disposeGroup(group:T.Object3D) {group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});group.removeFromParent();}

export function disposeModelMaterials() {
  for(const mat of materials.values()){mat.map?.dispose();mat.dispose();}
  materials.clear();
}

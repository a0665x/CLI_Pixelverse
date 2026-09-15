import type {FurnitureDefinition} from '../world/types';
import {officeFamily,freeOfficeTexture} from './officePack';
import {authoredPlacement} from './interiorFurnitureScale';
import {catalogItem} from './modernOfficeCatalog';
/** Grid-space dimensions for original artwork; commercial sprite offsets do not apply. */
export function freeOfficePresentation(f:Pick<FurnitureDefinition,'kind'|'point'|'assetId'|'scale'>){
 const catalog=f.assetId===undefined?undefined:catalogItem(f.assetId);
 const family=catalog?officeFamily(catalog):({ 'office-chair':'chair','reading-desk':'computer','beverage-station':'coffee'} as Record<string,string>)[f.kind]||f.kind;
 const sizes:Record<string,number[]>={desk:[1,1.2,0,-.25],computer:[1.8,1.5,0,-.35],display:[.7,.7,0,-.45],keyboard:[.6,.2,0,-.05],papers:[.32,.24,-.3,-.04],lamp:[.28,.55,.3,-.4],divider:f.assetId===207?[.12,1.6,0,0]:[1.1,.15,0,0],chair:[.7,.95,0,-.18],sofa:[2,1.2,0,-.15],bed:[1.3,2.15,0,-.05],bookcase:[1.05,1.55,0,-.5],cabinet:[1.05,1.1,0,-.25],board:[1.6,1.4,0,-.25],plant:[.6,1,0,-.3],printer:[.8,.9,0,-.2],coffee:[.8,.9,0,-.2]};
 const [width=1,height=1,dx=0,dy=0]=sizes[family]??[1,1,0,0];
 const ratio=(f.scale??authoredPlacement(f.assetId).scale)/authoredPlacement(f.assetId).scale;
 return {texture:catalog?`woodland-piece-${catalog.id}`:freeOfficeTexture(family),width:width*ratio,height:height*ratio,x:f.point.x+.5+dx*ratio,y:f.point.y+.5+dy*ratio};
}

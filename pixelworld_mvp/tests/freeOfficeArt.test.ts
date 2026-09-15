import {it,expect} from 'vitest';
import {installFreeOfficeArt} from '../src/rendering/freeOfficeArt';
import {MODERN_OFFICE_CATALOG} from '../src/rendering/modernOfficeCatalog';
import {MODERN_OFFICE_ASSETS} from '../src/rendering/modernOfficeManifest';
it('supplies every legacy office texture key without fetching commercial images',()=>{
 const generated=new Map<string,number>();let current='';const context={save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){generated.set(current,(generated.get(current)??0)+1);},fillRect(){generated.set(current,(generated.get(current)??0)+1);}};
 const scene={textures:{exists:(key:string)=>generated.has(key),createCanvas:(key:string)=>{current=key;generated.set(key,0);return {context,refresh(){}};}}};
 installFreeOfficeArt(scene as never);
 for(const item of [...MODERN_OFFICE_CATALOG,...Object.values(MODERN_OFFICE_ASSETS.furniture)])expect(generated.get(item.key)).toBeGreaterThan(3);
 const count=generated.size;installFreeOfficeArt(scene as never);expect(generated.size).toBe(count);
});

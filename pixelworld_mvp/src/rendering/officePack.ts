import manifest from '../../../private_assets/free-office/manifest.json';
import type {ModernOfficeCatalogItem} from './modernOfficeCatalog';
export const OFFICE_PACK=manifest;
export function officeFamily(item:Pick<ModernOfficeCatalogItem,'id'|'category'>):string{
 const id=item.id;
 const known:Record<number,string>={121:'display',125:'display',124:'keyboard',153:'papers',141:'lamp',207:'divider',208:'divider',247:'desk',248:'desk',249:'desk',98:'plant',99:'plant',100:'plant',129:'display',170:'board',171:'board',172:'board',173:'coffee',175:'cabinet',176:'bookcase',177:'printer',180:'bookcase',193:'desk',199:'sofa',200:'sofa',1001:'bed',1002:'bookcase',1003:'plant',1004:'sofa',1005:'cabinet',1006:'chair',1007:'desk'};
 if(known[id])return known[id]!;
 if(id>=101&&id<=116)return 'chair';if(id>=210&&id<=224)return 'sofa';
 return ({'surfaces':'desk','seating-plants':'plant','screens-electronics':'display','storage-partitions':'bookcase','workstations':'computer'} as Record<string,string>)[item.category]||'desk';
}
export const freeOfficeTexture=(family:string)=>`woodland-office-${family}`;

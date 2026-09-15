export const RABBIT_COATS:string[];
export function rabbitIdentity(id?:string):{index:number;color:string;code:string};
export function agentIdentity(agent?:any,agents?:any[]):{id:string;name:string;role:'main'|'sub'|'branch';parentId:string;parentName:string;project:string;projectPath:string;index:number;color:string;code:string};
export function worldSkinIndex(id?:string):number;
export function worldSpritePortrait(agent?:any,free?:boolean,live?:{sheet:string;frame:number}):{src:string;pixelClass:string;frame?:number};

import type { InteriorDefinition } from '../world/types';
import { furnitureAlphaMaskVersion } from './furnitureAlphaMasks';

let activeFrame:WeakMap<InteriorDefinition,string>|undefined;
function roomSignature(room:InteriorDefinition){
 const found=activeFrame?.get(room);if(found!==undefined)return found;
 const signature=`${furnitureAlphaMaskVersion()}:${JSON.stringify(room)}`;activeFrame?.set(room,signature);return signature;
}

/** Mutable editor layouts are supported: content or alpha-mask changes invalidate all queries.
 * Weak ownership releases closed layouts, and a cap bounds distinct origins/rosters per room. */
export function createRoomMemo<T>() {
  const rooms=new WeakMap<InteriorDefinition,{signature:string;values:Map<string,T>}>();
  return (room:InteriorDefinition,key:string,compute:()=>T):T=>{
    const signature=roomSignature(room);
    let cache=rooms.get(room);
    if(!cache||cache.signature!==signature){cache={signature,values:new Map()};rooms.set(room,cache);}
    if(cache.values.has(key))return cache.values.get(key)!;
    const value=compute();if(cache.values.size>=256)cache.values.delete(cache.values.keys().next().value!);
    cache.values.set(key,value);return value;
  };
}

export function withRoomMemoFrame<T>(run:()=>T):T{const previous=activeFrame;activeFrame??=new WeakMap();try{return run();}finally{activeFrame=previous;}}

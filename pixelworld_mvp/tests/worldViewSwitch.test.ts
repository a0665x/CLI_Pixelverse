import { afterEach,describe,expect,it,vi } from 'vitest';
const view=vi.hoisted(()=>({created:0,fail:false,enabled:vi.fn(),destroy:vi.fn()}));
vi.mock('../src/three/Village3D',()=>({prepareVillageAssets:async()=>{},Village3D:class {
  constructor(){if(view.fail)throw new Error('WebGL unavailable');view.created++;}
  setEnabled=view.enabled;destroy=view.destroy;
}}));
import { mountWorldViews } from '../src/three/mountWorldViews';
import type { WorldScene } from '../src/scenes/WorldScene';
import type { ImmersionController } from '../src/player/ImmersionController';
function fixture(){
  const listeners=new Map<string,(event:any)=>void>();
  const parent={postMessage:vi.fn()};
  const children:any[]=[];
  const element=()=>({hidden:false,textContent:'',setAttribute:vi.fn(),append:vi.fn(),remove:vi.fn()});
  const document={documentElement:{lang:'en-US',dataset:{} as Record<string,string>},createElement:element,querySelector:()=>({append:(n:any)=>children.push(n)})};
  vi.stubGlobal('document',document);vi.stubGlobal('location',{origin:'https://village.test'});
  vi.stubGlobal('window',{parent,location:{origin:'https://village.test'},addEventListener:(key:string,listener:(e:any)=>void)=>listeners.set(key,listener),removeEventListener:vi.fn()});
  const graphics={setDepth:()=>graphics,clear:vi.fn(),destroy:vi.fn()};let shutdown=()=>{};
  const world={add:{graphics:()=>graphics},events:{on:vi.fn(),off:vi.fn(),once:(_key:string,fn:()=>void)=>shutdown=fn}};
  mountWorldViews(world as unknown as WorldScene,{} as ImmersionController);
  const send=(mode:string,origin='https://village.test',source:any=parent)=>listeners.get('message')!({origin,source,data:{type:'pixelverse.view.set',mode}});
  return {send,parent,document,children,listeners,shutdown:()=>shutdown()};
}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();view.created=0;view.fail=false;});
describe('view switching boundary',()=>{
  it('accepts only the parent origin and lazily reuses one renderer',async()=>{
    const f=fixture();f.send('3d','https://other.test');f.send('3d','https://village.test',{});
    await vi.dynamicImportSettled();expect(view.created).toBe(0);
    f.send('3d');await vi.dynamicImportSettled();expect(view.created).toBe(1);expect(f.document.documentElement.dataset.view).toBe('3d');
    f.send('2d');expect(view.enabled).toHaveBeenLastCalledWith(false);
    f.send('3d');await vi.dynamicImportSettled();expect(view.created).toBe(1);
    f.shutdown();expect(view.destroy).toHaveBeenCalledOnce();
  });
  it('honors a return to 2D while the 3D chunk is still loading',async()=>{
    const f=fixture();f.send('3d');f.send('2d');await vi.dynamicImportSettled();
    expect(view.created).toBe(0);expect(f.document.documentElement.dataset.view).toBe('2d');
  });
  it('preserves 2D with a localized explanation when WebGL fails',async()=>{
    view.fail=true;const f=fixture();f.send('3d');await vi.dynamicImportSettled();
    expect(f.document.documentElement.dataset.view).toBe('2d');expect(f.children[0].hidden).toBe(false);expect(f.children[0].textContent).toContain('3D is unavailable');
  });
  it('releases a lost context and allows the next selection to construct a fresh view',async()=>{
    const f=fixture();f.send('3d');await vi.dynamicImportSettled();
    f.listeners.get('pixelverse:3d-unavailable')!({});expect(view.destroy).toHaveBeenCalledOnce();
    expect(f.document.documentElement.dataset.view).toBe('2d');f.send('3d');await vi.dynamicImportSettled();expect(view.created).toBe(2);
  });
});

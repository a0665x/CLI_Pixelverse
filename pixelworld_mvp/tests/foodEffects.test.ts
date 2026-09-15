import {describe,it,expect} from 'vitest';
import {FoodEffects} from '../src/player/foodEffects';
import {immersionText} from '../src/i18n/immersionLocale';
import {smokeRoute} from '../src/three/guideSmoke';
import * as T from 'three';
describe('inspector food',()=>{
 it('expires after 30 seconds, refreshes without stacking, and allows both foods',()=>{const f=new FoodEffects();f.feed('carrot',100);expect(f.sample(101).speed).toBe(1.65);f.feed('carrot',200);f.feed('hay',300);expect(f.sample(301)).toMatchObject({speed:1.65,size:1.35});expect(f.sample(30200)).toMatchObject({speed:1,size:1.35});expect(f.sample(30300)).toMatchObject({speed:1,size:1});f.feed('hay',40000);f.clear();expect(f.sample(40001).size).toBe(1);});
 it('has four-language summon and food labels',()=>{for(const locale of ['en-US','ja-JP','ko-KR'])for(const source of ['✦ 降臨審查員','投餵食物','胡蘿蔔 · 加速 30 秒','甘草堆 · 變大 30 秒'])expect(immersionText(source,locale)).not.toBe(source);expect(immersionText('✦ 降臨審查員','zh-TW')).toBe('✦ 降臨審查員');});
 it('densely samples the real route without cutting corners',()=>{const g=smokeRoute([new T.Vector3(0,0,0),new T.Vector3(2,0,0),new T.Vector3(2,0,2)]);expect(g.getAttribute('position').count).toBe(20);expect(g.getAttribute('phase').count).toBe(20);g.dispose();});
});

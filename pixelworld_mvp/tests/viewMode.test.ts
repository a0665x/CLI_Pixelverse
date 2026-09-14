import { describe,it,expect } from 'vitest';
import { dayNightAt,DAY_LENGTH_MS } from '../src/world/dayNight';
import { immersionText } from '../src/i18n/immersionLocale';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';

describe('shared world presentation',()=>{
  it('completes one day and night per real hour without restarting on reload',()=>{
    expect(dayNightAt(DAY_LENGTH_MS/4).daylight).toBe(1);
    expect(dayNightAt(DAY_LENGTH_MS*3/4).night).toBe(true);
    for(const t of [0,153000,900000,2700000,3599999])expect(dayNightAt(t+DAY_LENGTH_MS)).toEqual(dayNightAt(t));
    expect(Math.abs(dayNightAt(DAY_LENGTH_MS-1).daylight-dayNightAt(DAY_LENGTH_MS+1).daylight)).toBeLessThan(.001);
  });
  it('localizes immersion to all four dashboard languages',()=>{
    expect(immersionText('✦ 身歷其境','en-US')).toBe('✦ Enter world');
    expect(immersionText('打斷並改派','ja-JP')).toBe('中断して再指示');
    expect(immersionText('查看工作','ko-KR')).toBe('작업 보기');
    expect(immersionText('身歷其境','zh-TW')).toBe('身歷其境');
    expect(immersionText('身歷其境','unknown')).toBe('Immersive mode');
  });
  it('uses stable office group IDs across reads and isolates modifications',()=>{
    for(const building of WORLD_DEFINITION.buildings){
      const room=interiorDefinitionForBuilding(building);

      expect(room.furniture.length).toBeGreaterThanOrEqual(10);
      expect(room.furniture.map(f=>f.id)).toEqual(interiorDefinitionForBuilding(building).furniture.map(f=>f.id));
      const count=room.furniture.length;room.furniture.pop();
      expect(interiorDefinitionForBuilding(building).furniture).toHaveLength(count);
    }
  });
});

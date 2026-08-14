import { describe, expect, it } from 'vitest';

describe('interior editor locale catalog', () => {
  it('provides the complete contextual chrome in every supported locale', async () => {
    const { editorChrome } = await import('../src/rendering/interiorLocale');
    expect(editorChrome).toEqual({
      'zh-TW': { catalog: '家具庫', properties: '屬性', help: '操作說明', fitView: '符合畫面', closeGuide: '知道了', validPlacement: '可以放置', collision: '位置衝突', returnedToOrigin: '已返回原位' },
      'en-US': { catalog: 'Furniture', properties: 'Properties', help: 'Help', fitView: 'Fit view', closeGuide: 'Got it', validPlacement: 'Valid placement', collision: 'Placement blocked', returnedToOrigin: 'Returned to origin' },
      'ja-JP': { catalog: '家具', properties: 'プロパティ', help: '操作ガイド', fitView: '全体表示', closeGuide: '了解', validPlacement: '配置できます', collision: '配置できません', returnedToOrigin: '元の位置に戻しました' },
      'ko-KR': { catalog: '가구', properties: '속성', help: '사용 안내', fitView: '화면 맞춤', closeGuide: '확인', validPlacement: '배치 가능', collision: '배치할 수 없음', returnedToOrigin: '원래 위치로 돌아감' },
    });
    expect(JSON.stringify(editorChrome['en-US'])).not.toMatch(/[\u3400-\u9fff]/);
  });
});

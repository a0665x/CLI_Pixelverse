import { normalizeVillageLocale, type VillageLocale } from '../i18n/villageLocale';

export const editorChrome = {
  'zh-TW': { catalog: '家具庫', properties: '屬性', help: '操作說明', fitView: '符合畫面', closeGuide: '知道了', validPlacement: '可以放置', collision: '位置衝突', returnedToOrigin: '已返回原位', previousPage: '上一頁', nextPage: '下一頁', rotateLeft: '向左旋轉', rotateRight: '向右旋轉' },
  'en-US': { catalog: 'Furniture', properties: 'Properties', help: 'Help', fitView: 'Fit view', closeGuide: 'Got it', validPlacement: 'Valid placement', collision: 'Placement blocked', returnedToOrigin: 'Returned to origin', previousPage: 'Previous page', nextPage: 'Next page', rotateLeft: 'Rotate left', rotateRight: 'Rotate right' },
  'ja-JP': { catalog: '家具', properties: 'プロパティ', help: '操作ガイド', fitView: '全体表示', closeGuide: '了解', validPlacement: '配置できます', collision: '配置できません', returnedToOrigin: '元の位置に戻しました', previousPage: '前のページ', nextPage: '次のページ', rotateLeft: '左に回転', rotateRight: '右に回転' },
  'ko-KR': { catalog: '가구', properties: '속성', help: '사용 안내', fitView: '화면 맞춤', closeGuide: '확인', validPlacement: '배치 가능', collision: '배치할 수 없음', returnedToOrigin: '원래 위치로 돌아감', previousPage: '이전 페이지', nextPage: '다음 페이지', rotateLeft: '왼쪽으로 회전', rotateRight: '오른쪽으로 회전' },
} as const;

export type InteriorEditorCopy = typeof editorChrome[VillageLocale];

export const interiorEditorCopy = (locale: unknown): InteriorEditorCopy =>
  editorChrome[normalizeVillageLocale(locale)];

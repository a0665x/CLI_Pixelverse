import type { AgentAction } from '../world/types';

export const VILLAGE_LOCALES = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const;
export type VillageLocale = typeof VILLAGE_LOCALES[number];

const buildingIds = [
  'arrival-lodge', 'thinkers-cottage', 'archive-library', 'network-lab', 'heartbeat-tower',
  'offline-dormitory', 'maker-workshop', 'tool-smithy', 'awaiting-post', 'collaboration-barn',
  'recovery-clinic', 'rest-cabin',
] as const;

type VillageCopy = {
  buildings: Record<typeof buildingIds[number], string>;
  actions: Record<AgentAction | 'tool' | 'idle', string>;
  controls: { fit: string; cover: string; zoomIn: string; zoomOut: string; reset: string };
  cutaway: {
    titles: Record<'rest-cabin' | 'research-library' | 'maker-workshop' | 'collaboration-barn', string>;
    categories: Record<'surfaces' | 'seating-plants' | 'screens-electronics' | 'storage-partitions' | 'workstations', string>;
    actions: Record<'edit' | 'done' | 'collect' | 'revert' | 'copy' | 'paste' | 'save' | 'close' | 'cancel' | 'duplicate' | 'group' | 'shelf' | 'smaller' | 'larger' | 'layerDown' | 'layerUp' | 'back' | 'backward' | 'forward' | 'front' | 'undo' | 'applyTemplate' | 'previewTemplate' | 'dissolveGroup', string>;
    status: { ready: string; editing: string; selected: string; batch: string; hook: string; prefab: string; furniture: string; templateInvalid: string; unreachableHook: string; storageFailed: string };
  };
};

const cutawayCopy = (
  titles: VillageCopy['cutaway']['titles'], categories: VillageCopy['cutaway']['categories'],
  actions: VillageCopy['cutaway']['actions'], status: VillageCopy['cutaway']['status'],
): VillageCopy['cutaway'] => ({ titles, categories, actions, status });

const actionCopy = (items: Partial<Record<AgentAction, string>>, fallback: string): Record<AgentAction | 'tool' | 'idle', string> => {
  const actions = Object.fromEntries(
    ['arrive', 'ponder', 'plan', 'read', 'type', 'terminal', 'signal', 'dispatch', 'respond', 'queue', 'repair', 'rest', 'offline', 'pulse']
      .map((key) => [key, items[key as AgentAction] || fallback]),
  ) as Record<AgentAction | 'tool' | 'idle', string>;
  actions.tool = actions.terminal;
  actions.idle = actions.rest;
  return actions;
};

const CATALOG: Record<VillageLocale, VillageCopy> = {
  'zh-TW': {
    buildings: { 'arrival-lodge': '啟程小屋', 'thinkers-cottage': '思考屋', 'archive-library': '檔案館', 'network-lab': '網路屋', 'heartbeat-tower': '心跳塔', 'offline-dormitory': '離線宿舍', 'maker-workshop': '編輯工坊', 'tool-smithy': '工具鐵舖', 'awaiting-post': '等候站', 'collaboration-barn': '協作公會', 'recovery-clinic': '修復所', 'rest-cabin': '休息小屋' },
    actions: actionCopy({ arrive: '準備開始', ponder: '思考中', plan: '整理計畫', read: '查閱檔案', type: '修改程式', terminal: '執行工具', signal: '查詢網路', dispatch: '建立分身', respond: '傳送結果', queue: '等待輸入', repair: '修復中', rest: '暫時休息', offline: '目前離線', pulse: '保持連線' }, '工作中'),
    controls: { fit: '完整顯示', cover: '滿板顯示', zoomIn: '放大村莊', zoomOut: '縮小村莊', reset: '重設村莊視角' },
    cutaway: cutawayCopy(
      { 'rest-cabin': '休息小屋', 'research-library': '研究圖書館', 'maker-workshop': '製作工坊', 'collaboration-barn': '協作穀倉' },
      { surfaces: '地板／牆面', 'seating-plants': '座椅／植栽', 'screens-electronics': '螢幕／電子', 'storage-partitions': '收納／隔間', workstations: '工作桌組' },
      { edit: '移動家具', done: '完成移動', collect: '全部收回', revert: '取消配置', copy: '複製格局', paste: '貼上格局', save: '儲存配置', close: '關閉室內', cancel: '取消選取', duplicate: '複製', group: '建立組裝件', shelf: '放回下排', smaller: '縮小', larger: '放大', layerDown: '下層', layerUp: '上層', back: '最下', backward: '下降', forward: '上升', front: '最上', undo: '復原', applyTemplate: '套用範本', previewTemplate: '預覽範本', dissolveGroup: '解散群組' },
      { ready: '室內已就緒', editing: '拖曳家具或下方素材到房間', selected: '件家具', batch: '批次操作', hook: 'Hook', prefab: '組裝件', furniture: '家具', templateInvalid: '範本未通過走道或房間檢查', unreachableHook: '部分 Hook 無法抵達', storageFailed: '儲存失敗' },
    ),
  },
  'en-US': {
    buildings: { 'arrival-lodge': 'Arrival Lodge', 'thinkers-cottage': 'Thinker’s Cottage', 'archive-library': 'Archive Library', 'network-lab': 'Web / MCP Lab', 'heartbeat-tower': 'Heartbeat Tower', 'offline-dormitory': 'Offline Dormitory', 'maker-workshop': 'Maker Workshop', 'tool-smithy': 'Tool Smithy', 'awaiting-post': 'Awaiting Post', 'collaboration-barn': 'Agent Guild', 'recovery-clinic': 'Recovery Clinic', 'rest-cabin': 'Rest Cabin' },
    actions: actionCopy({ arrive: 'Getting ready', ponder: 'Thinking', plan: 'Planning', read: 'Reading files', type: 'Editing code', terminal: 'Using tools', signal: 'Browsing sources', dispatch: 'Creating agent', respond: 'Sending result', queue: 'Waiting for input', repair: 'Recovering', rest: 'Taking a break', offline: 'Offline', pulse: 'Connected' }, 'Working'),
    controls: { fit: 'Fit village', cover: 'Fill viewport', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset village camera' },
    cutaway: cutawayCopy(
      { 'rest-cabin': 'Rest Cabin', 'research-library': 'Research Library', 'maker-workshop': 'Maker Workshop', 'collaboration-barn': 'Collaboration Barn' },
      { surfaces: 'Floors & walls', 'seating-plants': 'Seats & plants', 'screens-electronics': 'Screens & devices', 'storage-partitions': 'Storage & dividers', workstations: 'Workstations' },
      { edit: 'Move furniture', done: 'Finish editing', collect: 'Collect all', revert: 'Revert', copy: 'Copy layout', paste: 'Paste layout', save: 'Save layout', close: 'Close interior', cancel: 'Clear selection', duplicate: 'Duplicate', group: 'Create assembly', shelf: 'Return to shelf', smaller: 'Smaller', larger: 'Larger', layerDown: 'Layer down', layerUp: 'Layer up', back: 'Send to back', backward: 'Move backward', forward: 'Move forward', front: 'Bring to front', undo: 'Undo', applyTemplate: 'Apply template', previewTemplate: 'Preview template', dissolveGroup: 'Dissolve group' },
      { ready: 'Interior ready', editing: 'Drag furniture or shelf items into the room', selected: 'items selected', batch: 'Batch actions', hook: 'Hooks', prefab: 'Assemblies', furniture: 'Furniture', templateInvalid: 'Template failed room or aisle checks', unreachableHook: 'Some Hooks are unreachable', storageFailed: 'Could not save layout' },
    ),
  },
  'ja-JP': {
    buildings: { 'arrival-lodge': '出発ロッジ', 'thinkers-cottage': '思考の家', 'archive-library': '資料館', 'network-lab': 'Web・MCPラボ', 'heartbeat-tower': 'ハートビート塔', 'offline-dormitory': 'オフライン寮', 'maker-workshop': '編集工房', 'tool-smithy': 'ツール鍛冶場', 'awaiting-post': '待機所', 'collaboration-barn': 'エージェントギルド', 'recovery-clinic': '修復所', 'rest-cabin': '休憩小屋' },
    actions: actionCopy({ arrive: '準備中', ponder: '思考中', plan: '計画中', read: '資料を確認中', type: 'コード編集中', terminal: 'ツール実行中', signal: '情報検索中', dispatch: 'エージェント作成中', respond: '結果送信中', queue: '入力待ち', repair: '修復中', rest: '休憩中', offline: 'オフライン', pulse: '接続中' }, '作業中'),
    controls: { fit: '全体表示', cover: '画面を満たす', zoomIn: '拡大', zoomOut: '縮小', reset: '視点をリセット' },
    cutaway: cutawayCopy(
      { 'rest-cabin': '休憩小屋', 'research-library': '研究図書館', 'maker-workshop': '制作工房', 'collaboration-barn': '協働ギルド' },
      { surfaces: '床・壁', 'seating-plants': '椅子・植物', 'screens-electronics': '画面・機器', 'storage-partitions': '収納・間仕切り', workstations: '作業机' },
      { edit: '家具を移動', done: '編集完了', collect: 'すべて収納', revert: '元に戻す', copy: '配置をコピー', paste: '配置を貼付', save: '配置を保存', close: '室内を閉じる', cancel: '選択解除', duplicate: '複製', group: '組立品を作成', shelf: '棚に戻す', smaller: '縮小', larger: '拡大', layerDown: '下の層', layerUp: '上の層', back: '最背面', backward: '背面へ', forward: '前面へ', front: '最前面', undo: '元に戻す', applyTemplate: 'テンプレートを適用', previewTemplate: 'テンプレートをプレビュー', dissolveGroup: 'グループを解除' },
      { ready: '室内の準備完了', editing: '家具や棚の素材を部屋へドラッグ', selected: '個を選択', batch: '一括操作', hook: 'Hook', prefab: '組立品', furniture: '家具', templateInvalid: 'テンプレートが部屋または通路の検査に失敗しました', unreachableHook: '到達できない Hook があります', storageFailed: '配置を保存できませんでした' },
    ),
  },
  'ko-KR': {
    buildings: { 'arrival-lodge': '출발 오두막', 'thinkers-cottage': '사색의 집', 'archive-library': '자료관', 'network-lab': 'Web · MCP 연구소', 'heartbeat-tower': '하트비트 탑', 'offline-dormitory': '오프라인 기숙사', 'maker-workshop': '편집 공방', 'tool-smithy': '도구 대장간', 'awaiting-post': '대기소', 'collaboration-barn': '에이전트 길드', 'recovery-clinic': '복구소', 'rest-cabin': '휴식 오두막' },
    actions: actionCopy({ arrive: '준비 중', ponder: '생각 중', plan: '계획 중', read: '자료 확인 중', type: '코드 편집 중', terminal: '도구 실행 중', signal: '자료 검색 중', dispatch: '에이전트 생성 중', respond: '결과 전송 중', queue: '입력 대기 중', repair: '복구 중', rest: '휴식 중', offline: '오프라인', pulse: '연결됨' }, '작업 중'),
    controls: { fit: '전체 보기', cover: '화면 채우기', zoomIn: '확대', zoomOut: '축소', reset: '시점 초기화' },
    cutaway: cutawayCopy(
      { 'rest-cabin': '휴식 오두막', 'research-library': '연구 도서관', 'maker-workshop': '제작 공방', 'collaboration-barn': '협업 길드' },
      { surfaces: '바닥·벽', 'seating-plants': '좌석·식물', 'screens-electronics': '화면·기기', 'storage-partitions': '수납·파티션', workstations: '작업대' },
      { edit: '가구 이동', done: '편집 완료', collect: '모두 회수', revert: '되돌리기', copy: '배치 복사', paste: '배치 붙여넣기', save: '배치 저장', close: '실내 닫기', cancel: '선택 해제', duplicate: '복제', group: '조립품 만들기', shelf: '선반으로', smaller: '축소', larger: '확대', layerDown: '아래 레이어', layerUp: '위 레이어', back: '맨 뒤로', backward: '뒤로', forward: '앞으로', front: '맨 앞으로', undo: '실행 취소', applyTemplate: '템플릿 적용', previewTemplate: '템플릿 미리보기', dissolveGroup: '그룹 해제' },
      { ready: '실내 준비 완료', editing: '가구나 선반 항목을 방으로 드래그하세요', selected: '개 선택', batch: '일괄 작업', hook: 'Hook', prefab: '조립품', furniture: '가구', templateInvalid: '템플릿이 방 또는 통로 검사를 통과하지 못했습니다', unreachableHook: '도달할 수 없는 Hook이 있습니다', storageFailed: '배치를 저장하지 못했습니다' },
    ),
  },
};

export function normalizeVillageLocale(value: unknown): VillageLocale {
  return VILLAGE_LOCALES.includes(value as VillageLocale) ? value as VillageLocale : 'zh-TW';
}

export function villageCopy(locale: unknown): VillageCopy { return CATALOG[normalizeVillageLocale(locale)]; }

export function localeMessage(value: unknown): { locale: VillageLocale; sequence: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; locale?: unknown; sequence?: unknown };
  if (message.type !== 'pixelverse.locale.update') return undefined;
  return { locale: normalizeVillageLocale(message.locale), sequence: Number(message.sequence) || Date.now() };
}

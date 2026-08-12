import type { AgentAction, FurnitureLayer } from '../world/types';
import type { BuiltInOfficePrefabId } from '../rendering/builtInOfficePrefabs';

export const VILLAGE_LOCALES = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const;
export type VillageLocale = typeof VILLAGE_LOCALES[number];
export type StatusFailureReason = 'station-full' | 'no-path' | 'clone-queue' | 'agent-cap';

export const CUTAWAY_OPERATION_MESSAGE_IDS = [
  'empty', 'editingEnabled', 'editingDisabled', 'saved', 'collectedAll', 'reverted',
  'layoutCopied', 'layoutPasted', 'layoutPasteRejected', 'houseEmpty', 'houseOccupied',
  'resizeApplied', 'moveApplied', 'placementRejected', 'prefabPlaced', 'prefabRejected',
  'catalogAdded', 'hookPlaced', 'hookRejected', 'marqueeSelecting', 'selectionCompleted',
  'resizeRejected', 'rotateApplied', 'rotateRejected', 'layerUpApplied', 'layerDownApplied', 'layerShiftRejected',
  'reordered', 'prefabNamePrompt', 'prefabDefaultName', 'prefabNeedsTwo', 'prefabCreated',
  'duplicateApplied', 'duplicateRejected', 'returnedToShelf', 'selectionCleared',
] as const;
export type CutawayOperationMessageId = typeof CUTAWAY_OPERATION_MESSAGE_IDS[number];
export type CutawayPlacementDiagnostic = 'valid' | 'outside-room' | 'blocks-door' | 'overlap' | 'invalid-asset';

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
    prefabs: Record<BuiltInOfficePrefabId, string>;
    actions: Record<'edit' | 'done' | 'collect' | 'revert' | 'copy' | 'paste' | 'save' | 'close' | 'cancel' | 'duplicate' | 'group' | 'shelf' | 'smaller' | 'larger' | 'layerDown' | 'layerUp' | 'back' | 'backward' | 'forward' | 'front' | 'undo' | 'applyTemplate' | 'previewTemplate' | 'dissolveGroup', string>;
    status: { ready: string; editing: string; selected: string; batch: string; hook: string; prefab: string; furniture: string; templateInvalid: string; unreachableHook: string; storageFailed: string; undoApplied: string; templatePreviewReady: string; templateApplied: string; groupDissolved: string };
  };
};

export type CutawayStatusMessageId = keyof VillageCopy['cutaway']['status'];
export type CutawayMessageId = CutawayStatusMessageId | CutawayOperationMessageId;

interface ParameterizedCutawayMessages {
  houseOccupied: { count: number };
  resizeApplied: { percent: number };
  placementRejected: { diagnostic: CutawayPlacementDiagnostic };
  prefabPlaced: { name: string };
  catalogAdded: { label: string };
  hookPlaced: { label: string };
  selectionCompleted: { count: number };
  prefabDefaultName: { count: number };
  prefabCreated: { name: string };
  returnedToShelf: { count: number };
}

export type CutawayMessageParamsById = ParameterizedCutawayMessages & {
  [K in Exclude<CutawayMessageId, keyof ParameterizedCutawayMessages>]: undefined;
};
export type CutawayMessageParams<K extends CutawayMessageId> = CutawayMessageParamsById[K];
export type CutawayMessageArgs<K extends CutawayMessageId> = CutawayMessageParams<K> extends undefined
  ? []
  : [params: CutawayMessageParams<K>];
export type CutawayMessageState = {
  [K in CutawayMessageId]: CutawayMessageParams<K> extends undefined
    ? { statusId: K; statusParams?: never }
    : { statusId: K; statusParams: CutawayMessageParams<K> };
}[CutawayMessageId];

const cutawayCopy = (
  titles: VillageCopy['cutaway']['titles'], categories: VillageCopy['cutaway']['categories'],
  prefabs: VillageCopy['cutaway']['prefabs'],
  actions: VillageCopy['cutaway']['actions'], status: VillageCopy['cutaway']['status'],
): VillageCopy['cutaway'] => ({ titles, categories, prefabs, actions, status });

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
      { 'bench-four': '四人雙排工作桌', 'pod-l-two': '雙人 L 型工作站', 'control-m-three': '三人 M 型控制台' },
      { edit: '移動家具', done: '完成移動', collect: '全部收回', revert: '取消配置', copy: '複製格局', paste: '貼上格局', save: '儲存配置', close: '關閉室內', cancel: '取消選取', duplicate: '複製', group: '建立組裝件', shelf: '放回下排', smaller: '縮小', larger: '放大', layerDown: '下層', layerUp: '上層', back: '最下', backward: '下降', forward: '上升', front: '最上', undo: '復原', applyTemplate: '套用範本', previewTemplate: '預覽範本', dissolveGroup: '解散群組' },
      { ready: '室內已就緒', editing: '拖曳家具或下方素材到房間', selected: '件家具', batch: '批次操作', hook: 'Hook', prefab: '組裝件', furniture: '家具', templateInvalid: '範本未通過走道或房間檢查', unreachableHook: '部分 Hook 無法抵達', storageFailed: '儲存失敗', undoApplied: '已復原上一個家具變更 · 尚未儲存', templatePreviewReady: '範本預覽 · 確認後按套用範本', templateApplied: '範本已套用到目前配置 · 按儲存配置才會保存', groupDissolved: '群組已解散 · 家具位置與圖層保持不變' },
    ),
  },
  'en-US': {
    buildings: { 'arrival-lodge': 'Arrival Lodge', 'thinkers-cottage': 'Thinker’s Cottage', 'archive-library': 'Archive Library', 'network-lab': 'Web / MCP Lab', 'heartbeat-tower': 'Heartbeat Tower', 'offline-dormitory': 'Offline Dormitory', 'maker-workshop': 'Maker Workshop', 'tool-smithy': 'Tool Smithy', 'awaiting-post': 'Awaiting Post', 'collaboration-barn': 'Agent Guild', 'recovery-clinic': 'Recovery Clinic', 'rest-cabin': 'Rest Cabin' },
    actions: actionCopy({ arrive: 'Getting ready', ponder: 'Thinking', plan: 'Planning', read: 'Reading files', type: 'Editing code', terminal: 'Using tools', signal: 'Browsing sources', dispatch: 'Creating agent', respond: 'Sending result', queue: 'Waiting for input', repair: 'Recovering', rest: 'Taking a break', offline: 'Offline', pulse: 'Connected' }, 'Working'),
    controls: { fit: 'Fit village', cover: 'Fill viewport', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset village camera' },
    cutaway: cutawayCopy(
      { 'rest-cabin': 'Rest Cabin', 'research-library': 'Research Library', 'maker-workshop': 'Maker Workshop', 'collaboration-barn': 'Collaboration Barn' },
      { surfaces: 'Floors & walls', 'seating-plants': 'Seats & plants', 'screens-electronics': 'Screens & devices', 'storage-partitions': 'Storage & dividers', workstations: 'Workstations' },
      { 'bench-four': 'Four-seat Double Bench', 'pod-l-two': 'Two-seat L Pod', 'control-m-three': 'Three-seat M Control Console' },
      { edit: 'Move furniture', done: 'Finish editing', collect: 'Collect all', revert: 'Revert', copy: 'Copy layout', paste: 'Paste layout', save: 'Save layout', close: 'Close interior', cancel: 'Clear selection', duplicate: 'Duplicate', group: 'Create assembly', shelf: 'Return to shelf', smaller: 'Smaller', larger: 'Larger', layerDown: 'Layer down', layerUp: 'Layer up', back: 'Send to back', backward: 'Move backward', forward: 'Move forward', front: 'Bring to front', undo: 'Undo', applyTemplate: 'Apply template', previewTemplate: 'Preview template', dissolveGroup: 'Dissolve group' },
      { ready: 'Interior ready', editing: 'Drag furniture or shelf items into the room', selected: 'items selected', batch: 'Batch actions', hook: 'Hooks', prefab: 'Assemblies', furniture: 'Furniture', templateInvalid: 'Template failed room or aisle checks', unreachableHook: 'Some Hooks are unreachable', storageFailed: 'Could not save editor data', undoApplied: 'Undid the last furniture change · Not saved', templatePreviewReady: 'Template preview · Apply when ready', templateApplied: 'Template applied to this draft · Save to keep it', groupDissolved: 'Group dissolved · Positions and layers preserved' },
    ),
  },
  'ja-JP': {
    buildings: { 'arrival-lodge': '出発ロッジ', 'thinkers-cottage': '思考の家', 'archive-library': '資料館', 'network-lab': 'Web・MCPラボ', 'heartbeat-tower': 'ハートビート塔', 'offline-dormitory': 'オフライン寮', 'maker-workshop': '編集工房', 'tool-smithy': 'ツール鍛冶場', 'awaiting-post': '待機所', 'collaboration-barn': 'エージェントギルド', 'recovery-clinic': '修復所', 'rest-cabin': '休憩小屋' },
    actions: actionCopy({ arrive: '準備中', ponder: '思考中', plan: '計画中', read: '資料を確認中', type: 'コード編集中', terminal: 'ツール実行中', signal: '情報検索中', dispatch: 'エージェント作成中', respond: '結果送信中', queue: '入力待ち', repair: '修復中', rest: '休憩中', offline: 'オフライン', pulse: '接続中' }, '作業中'),
    controls: { fit: '全体表示', cover: '画面を満たす', zoomIn: '拡大', zoomOut: '縮小', reset: '視点をリセット' },
    cutaway: cutawayCopy(
      { 'rest-cabin': '休憩小屋', 'research-library': '研究図書館', 'maker-workshop': '制作工房', 'collaboration-barn': '協働ギルド' },
      { surfaces: '床・壁', 'seating-plants': '椅子・植物', 'screens-electronics': '画面・機器', 'storage-partitions': '収納・間仕切り', workstations: '作業机' },
      { 'bench-four': '4人用両面ベンチ', 'pod-l-two': '2人用L字型ポッド', 'control-m-three': '3人用M字型コントロール卓' },
      { edit: '家具を移動', done: '編集完了', collect: 'すべて収納', revert: '元に戻す', copy: '配置をコピー', paste: '配置を貼付', save: '配置を保存', close: '室内を閉じる', cancel: '選択解除', duplicate: '複製', group: '組立品を作成', shelf: '棚に戻す', smaller: '縮小', larger: '拡大', layerDown: '下の層', layerUp: '上の層', back: '最背面', backward: '背面へ', forward: '前面へ', front: '最前面', undo: '元に戻す', applyTemplate: 'テンプレートを適用', previewTemplate: 'テンプレートをプレビュー', dissolveGroup: 'グループを解除' },
      { ready: '室内の準備完了', editing: '家具や棚の素材を部屋へドラッグ', selected: '個を選択', batch: '一括操作', hook: 'Hook', prefab: '組立品', furniture: '家具', templateInvalid: 'テンプレートが部屋または通路の検査に失敗しました', unreachableHook: '到達できない Hook があります', storageFailed: '編集データを保存できませんでした', undoApplied: '直前の家具変更を元に戻しました・未保存', templatePreviewReady: 'テンプレートをプレビュー中・確認後に適用してください', templateApplied: '下書きにテンプレートを適用しました・保存すると確定します', groupDissolved: 'グループを解除しました・位置とレイヤーは保持されています' },
    ),
  },
  'ko-KR': {
    buildings: { 'arrival-lodge': '출발 오두막', 'thinkers-cottage': '사색의 집', 'archive-library': '자료관', 'network-lab': 'Web · MCP 연구소', 'heartbeat-tower': '하트비트 탑', 'offline-dormitory': '오프라인 기숙사', 'maker-workshop': '편집 공방', 'tool-smithy': '도구 대장간', 'awaiting-post': '대기소', 'collaboration-barn': '에이전트 길드', 'recovery-clinic': '복구소', 'rest-cabin': '휴식 오두막' },
    actions: actionCopy({ arrive: '준비 중', ponder: '생각 중', plan: '계획 중', read: '자료 확인 중', type: '코드 편집 중', terminal: '도구 실행 중', signal: '자료 검색 중', dispatch: '에이전트 생성 중', respond: '결과 전송 중', queue: '입력 대기 중', repair: '복구 중', rest: '휴식 중', offline: '오프라인', pulse: '연결됨' }, '작업 중'),
    controls: { fit: '전체 보기', cover: '화면 채우기', zoomIn: '확대', zoomOut: '축소', reset: '시점 초기화' },
    cutaway: cutawayCopy(
      { 'rest-cabin': '휴식 오두막', 'research-library': '연구 도서관', 'maker-workshop': '제작 공방', 'collaboration-barn': '협업 길드' },
      { surfaces: '바닥·벽', 'seating-plants': '좌석·식물', 'screens-electronics': '화면·기기', 'storage-partitions': '수납·파티션', workstations: '작업대' },
      { 'bench-four': '4인용 양면 벤치', 'pod-l-two': '2인용 L자형 포드', 'control-m-three': '3인용 M자형 제어 콘솔' },
      { edit: '가구 이동', done: '편집 완료', collect: '모두 회수', revert: '되돌리기', copy: '배치 복사', paste: '배치 붙여넣기', save: '배치 저장', close: '실내 닫기', cancel: '선택 해제', duplicate: '복제', group: '조립품 만들기', shelf: '선반으로', smaller: '축소', larger: '확대', layerDown: '아래 레이어', layerUp: '위 레이어', back: '맨 뒤로', backward: '뒤로', forward: '앞으로', front: '맨 앞으로', undo: '실행 취소', applyTemplate: '템플릿 적용', previewTemplate: '템플릿 미리보기', dissolveGroup: '그룹 해제' },
      { ready: '실내 준비 완료', editing: '가구나 선반 항목을 방으로 드래그하세요', selected: '개 선택', batch: '일괄 작업', hook: 'Hook', prefab: '조립품', furniture: '가구', templateInvalid: '템플릿이 방 또는 통로 검사를 통과하지 못했습니다', unreachableHook: '도달할 수 없는 Hook이 있습니다', storageFailed: '편집 데이터를 저장하지 못했습니다', undoApplied: '마지막 가구 변경을 취소했습니다 · 저장되지 않음', templatePreviewReady: '템플릿 미리보기 · 확인 후 적용하세요', templateApplied: '초안에 템플릿을 적용했습니다 · 저장하면 유지됩니다', groupDissolved: '그룹을 해제했습니다 · 위치와 레이어는 유지됩니다' },
    ),
  },
};

export function normalizeVillageLocale(value: unknown): VillageLocale {
  return VILLAGE_LOCALES.includes(value as VillageLocale) ? value as VillageLocale : 'zh-TW';
}

export function villageCopy(locale: unknown): VillageCopy { return CATALOG[normalizeVillageLocale(locale)]; }

type CutawayOperationTemplates = Record<CutawayOperationMessageId, string>;
const CUTAWAY_OPERATION_COPY: Record<VillageLocale, CutawayOperationTemplates> = {
  'zh-TW': {
    empty: 'EMPTY · 點擊關閉或按 ESC', editingEnabled: '編輯模式 · 拖曳家具或下方素材到房間',
    editingDisabled: '家具配置已暫存，按儲存保存', saved: '✓ 家具配置已保存，下次開啟仍會保留',
    collectedAll: '全部家具已收回下方貨架 · 尚未儲存', reverted: '已取消未儲存變更，回到最後保存版本',
    layoutCopied: '格局已複製（Hook 家具不會被帶走）', layoutPasted: '格局已貼上 · 請補齊左側 Hook 家具後儲存',
    layoutPasteRejected: '⚠ 格局超出這間房，未套用', houseEmpty: 'EMPTY HOUSE · 目前沒有 Agent',
    houseOccupied: '{count} AGENT INSIDE · LIVE', resizeApplied: '已調整為 {percent}% · 按儲存配置',
    moveApplied: '家具已移動 · 按儲存配置', placementRejected: '⚠ {diagnostic} · 已回復原位',
    prefabPlaced: '組裝件「{name}」已放置', prefabRejected: '⚠ 組裝件超出房間或擋門',
    catalogAdded: '{label} 已加入 · 按儲存配置', hookPlaced: '{label} 已放置 · 按儲存配置',
    hookRejected: '⚠ Hook 家具超出房間或擋門', marqueeSelecting: '框選中 · 放開滑鼠建立多選範圍',
    selectionCompleted: '已框選 {count} 件 · 可建立組裝件', resizeRejected: '⚠ 尺寸調整後會超界或擋門',
    rotateApplied: '已批次旋轉家具 · 按儲存配置', rotateRejected: '⚠ 旋轉後會超界或擋門',
    layerUpApplied: '選取家具已移到上一層', layerDownApplied: '選取家具已移到下一層', layerShiftRejected: '⚠ 群組已在圖層邊界，未變更任何家具',
    reordered: '選取家具顯示順序已調整 · 按儲存配置', prefabNamePrompt: '替這個組裝件命名',
    prefabDefaultName: '組裝件 {count}', prefabNeedsTwo: '⚠ 至少框選兩件一般家具；Hook 家具不會加入組裝件',
    prefabCreated: '組裝件「{name}」已加入下方貨架', duplicateApplied: '家具已複製 · 複本已選取',
    duplicateRejected: '⚠ 附近沒有可放置複本的位置', returnedToShelf: '{count} 件家具已放回下排 · 尚未儲存',
    selectionCleared: '已取消家具選取',
  },
  'en-US': {
    empty: 'EMPTY · Click close or press ESC', editingEnabled: 'Edit mode · Drag furniture or shelf items into the room',
    editingDisabled: 'Furniture changes are in the draft · Save to keep them', saved: '✓ Furniture layout saved for the next visit',
    collectedAll: 'All furniture returned to the shelf · Not saved', reverted: 'Unsaved changes discarded · Restored the last saved layout',
    layoutCopied: 'Layout copied (Hook furniture is excluded)', layoutPasted: 'Layout pasted · Restore the required Hooks, then save',
    layoutPasteRejected: '⚠ Layout does not fit this room · Nothing changed', houseEmpty: 'EMPTY HOUSE · No agents inside',
    houseOccupied: '{count} AGENT INSIDE · LIVE', resizeApplied: 'Resized to {percent}% · Save the layout',
    moveApplied: 'Furniture moved · Save the layout', placementRejected: '⚠ {diagnostic} · Restored the original position',
    prefabPlaced: 'Assembly “{name}” placed', prefabRejected: '⚠ Assembly is outside the room or blocks the door',
    catalogAdded: '{label} added · Save the layout', hookPlaced: '{label} placed · Save the layout',
    hookRejected: '⚠ Hook furniture is outside the room or blocks the door', marqueeSelecting: 'Selecting · Release to finish the marquee',
    selectionCompleted: '{count} items selected · Ready to create an assembly', resizeRejected: '⚠ Resizing would cross the room boundary or block the door',
    rotateApplied: 'Furniture rotated · Save the layout', rotateRejected: '⚠ Rotation would cross the room boundary or block the door',
    layerUpApplied: 'Selected furniture moved up one layer', layerDownApplied: 'Selected furniture moved down one layer', layerShiftRejected: '⚠ The group is at a layer boundary · Nothing changed',
    reordered: 'Selected furniture display order changed · Save the layout', prefabNamePrompt: 'Name this assembly',
    prefabDefaultName: 'Assembly {count}', prefabNeedsTwo: '⚠ Select at least two ordinary items; Hook furniture is excluded',
    prefabCreated: 'Assembly “{name}” added to the shelf', duplicateApplied: 'Furniture duplicated · Copy selected',
    duplicateRejected: '⚠ No nearby space for a copy', returnedToShelf: '{count} items returned to the shelf · Not saved',
    selectionCleared: 'Furniture selection cleared',
  },
  'ja-JP': {
    empty: 'EMPTY・閉じるをクリックするか ESC を押してください', editingEnabled: '編集モード・家具や棚の素材を部屋へドラッグ',
    editingDisabled: '家具配置は下書きに保持されています・保存すると確定します', saved: '✓ 家具配置を保存しました・次回も保持されます',
    collectedAll: 'すべての家具を棚に戻しました・未保存', reverted: '未保存の変更を破棄し、最後の保存状態に戻しました',
    layoutCopied: '配置をコピーしました（Hook 家具は含まれません）', layoutPasted: '配置を貼り付けました・必要な Hook を戻して保存してください',
    layoutPasteRejected: '⚠ この部屋に収まらないため適用しませんでした', houseEmpty: 'EMPTY HOUSE・エージェントはいません',
    houseOccupied: '{count} AGENT INSIDE・LIVE', resizeApplied: '{percent}% に変更しました・配置を保存してください',
    moveApplied: '家具を移動しました・配置を保存してください', placementRejected: '⚠ {diagnostic}・元の位置に戻しました',
    prefabPlaced: '組立品「{name}」を配置しました', prefabRejected: '⚠ 組立品が部屋の外にあるか扉を塞いでいます',
    catalogAdded: '{label} を追加しました・配置を保存してください', hookPlaced: '{label} を配置しました・配置を保存してください',
    hookRejected: '⚠ Hook 家具が部屋の外にあるか扉を塞いでいます', marqueeSelecting: '範囲選択中・離すと確定します',
    selectionCompleted: '{count} 個を選択しました・組立品を作成できます', resizeRejected: '⚠ サイズ変更すると部屋の外に出るか扉を塞ぎます',
    rotateApplied: '家具を回転しました・配置を保存してください', rotateRejected: '⚠ 回転すると部屋の外に出るか扉を塞ぎます',
    layerUpApplied: '選択した家具を一つ上のレイヤーへ移動しました', layerDownApplied: '選択した家具を一つ下のレイヤーへ移動しました', layerShiftRejected: '⚠ グループがレイヤー境界にあるため、変更しませんでした',
    reordered: '選択した家具の表示順を変更しました・配置を保存してください', prefabNamePrompt: 'この組立品に名前を付けてください',
    prefabDefaultName: '組立品 {count}', prefabNeedsTwo: '⚠ 通常家具を2個以上選択してください・Hook 家具は含まれません',
    prefabCreated: '組立品「{name}」を棚に追加しました', duplicateApplied: '家具を複製しました・複製を選択中',
    duplicateRejected: '⚠ 近くに複製を置ける場所がありません', returnedToShelf: '{count} 個の家具を棚に戻しました・未保存',
    selectionCleared: '家具の選択を解除しました',
  },
  'ko-KR': {
    empty: 'EMPTY · 닫기를 누르거나 ESC 키를 누르세요', editingEnabled: '편집 모드 · 가구나 선반 항목을 방으로 드래그하세요',
    editingDisabled: '가구 배치가 초안에 보관되었습니다 · 저장하면 유지됩니다', saved: '✓ 가구 배치를 저장했습니다 · 다음에도 유지됩니다',
    collectedAll: '모든 가구를 선반으로 돌려보냈습니다 · 저장되지 않음', reverted: '저장하지 않은 변경을 취소하고 마지막 저장 상태로 돌아갔습니다',
    layoutCopied: '배치를 복사했습니다(Hook 가구 제외)', layoutPasted: '배치를 붙여넣었습니다 · 필요한 Hook을 복원한 뒤 저장하세요',
    layoutPasteRejected: '⚠ 이 방에 맞지 않아 적용하지 않았습니다', houseEmpty: 'EMPTY HOUSE · 내부에 에이전트가 없습니다',
    houseOccupied: '{count} AGENT INSIDE · LIVE', resizeApplied: '{percent}%로 조정했습니다 · 배치를 저장하세요',
    moveApplied: '가구를 이동했습니다 · 배치를 저장하세요', placementRejected: '⚠ {diagnostic} · 원래 위치로 복원했습니다',
    prefabPlaced: '조립품 “{name}”을 배치했습니다', prefabRejected: '⚠ 조립품이 방 밖에 있거나 문을 막습니다',
    catalogAdded: '{label} 추가됨 · 배치를 저장하세요', hookPlaced: '{label} 배치됨 · 배치를 저장하세요',
    hookRejected: '⚠ Hook 가구가 방 밖에 있거나 문을 막습니다', marqueeSelecting: '범위 선택 중 · 놓으면 선택이 완료됩니다',
    selectionCompleted: '{count}개 선택됨 · 조립품을 만들 수 있습니다', resizeRejected: '⚠ 크기를 바꾸면 방을 벗어나거나 문을 막습니다',
    rotateApplied: '가구를 회전했습니다 · 배치를 저장하세요', rotateRejected: '⚠ 회전하면 방을 벗어나거나 문을 막습니다',
    layerUpApplied: '선택한 가구를 한 레이어 위로 이동했습니다', layerDownApplied: '선택한 가구를 한 레이어 아래로 이동했습니다', layerShiftRejected: '⚠ 그룹이 레이어 경계에 있어 변경하지 않았습니다',
    reordered: '선택한 가구의 표시 순서를 바꿨습니다 · 배치를 저장하세요', prefabNamePrompt: '이 조립품의 이름을 입력하세요',
    prefabDefaultName: '조립품 {count}', prefabNeedsTwo: '⚠ 일반 가구를 두 개 이상 선택하세요. Hook 가구는 제외됩니다',
    prefabCreated: '조립품 “{name}”을 선반에 추가했습니다', duplicateApplied: '가구를 복제했습니다 · 복제본 선택됨',
    duplicateRejected: '⚠ 근처에 복제본을 둘 공간이 없습니다', returnedToShelf: '{count}개 가구를 선반으로 돌려보냈습니다 · 저장되지 않음',
    selectionCleared: '가구 선택을 해제했습니다',
  },
};

const PLACEMENT_DIAGNOSTIC_COPY: Record<VillageLocale, Record<CutawayPlacementDiagnostic, string>> = {
  'zh-TW': { valid: '可放置', 'outside-room': '超出房間範圍', 'blocks-door': '不能擋住房門', overlap: '會與其他家具重疊', 'invalid-asset': '素材資料不完整' },
  'en-US': { valid: 'Placement valid', 'outside-room': 'Outside the room', 'blocks-door': 'Cannot block the door', overlap: 'Overlaps other furniture', 'invalid-asset': 'Asset data is incomplete' },
  'ja-JP': { valid: '配置できます', 'outside-room': '部屋の外です', 'blocks-door': '扉を塞げません', overlap: 'ほかの家具と重なります', 'invalid-asset': '素材データが不完全です' },
  'ko-KR': { valid: '배치 가능', 'outside-room': '방 범위를 벗어남', 'blocks-door': '문을 막을 수 없음', overlap: '다른 가구와 겹침', 'invalid-asset': '소재 데이터가 불완전함' },
};

const STATUS_FAILURE_COPY: Record<VillageLocale, Record<StatusFailureReason, string>> = {
  'zh-TW': { 'station-full': '⚠ 工作區已滿', 'no-path': '⚠ 無法抵達', 'clone-queue': '⚠ Clone 工作位已滿', 'agent-cap': '⚠ Agent 已達上限' },
  'en-US': { 'station-full': '⚠ Work area full', 'no-path': '⚠ Cannot reach destination', 'clone-queue': '⚠ Clone workstation full', 'agent-cap': '⚠ Agent limit reached' },
  'ja-JP': { 'station-full': '⚠ 作業エリアが満員です', 'no-path': '⚠ 目的地に到達できません', 'clone-queue': '⚠ Clone 作業席が満員です', 'agent-cap': '⚠ エージェント上限に達しました' },
  'ko-KR': { 'station-full': '⚠ 작업 공간이 가득 찼습니다', 'no-path': '⚠ 목적지에 도달할 수 없습니다', 'clone-queue': '⚠ Clone 작업석이 가득 찼습니다', 'agent-cap': '⚠ 에이전트 한도에 도달했습니다' },
};

const FURNITURE_LAYER_COPY: Record<VillageLocale, Record<FurnitureLayer, string>> = {
  'zh-TW': { floor: '地板層', furniture: '家具層', surface: '表面層', wall: '牆面層' },
  'en-US': { floor: 'Floor layer', furniture: 'Furniture layer', surface: 'Surface layer', wall: 'Wall layer' },
  'ja-JP': { floor: '床レイヤー', furniture: '家具レイヤー', surface: '表面レイヤー', wall: '壁レイヤー' },
  'ko-KR': { floor: '바닥 레이어', furniture: '가구 레이어', surface: '표면 레이어', wall: '벽 레이어' },
};

const renderCutawayMessage = (
  locale: unknown,
  id: CutawayMessageId,
  params?: Exclude<CutawayMessageParamsById[CutawayMessageId], undefined>,
): string => {
  const normalized = normalizeVillageLocale(locale);
  const status = CATALOG[normalized].cutaway.status as Record<string, string>;
  if (id in status) return status[id]!;
  const values = params as Partial<{
    count: number; name: string; percent: number; label: string; diagnostic: CutawayPlacementDiagnostic;
  }> | undefined;
  const diagnostic = PLACEMENT_DIAGNOSTIC_COPY[normalized][values?.diagnostic ?? 'outside-room'];
  return CUTAWAY_OPERATION_COPY[normalized][id as CutawayOperationMessageId]
    .replaceAll('{count}', String(values?.count ?? 0))
    .replaceAll('{name}', values?.name ?? '')
    .replaceAll('{percent}', String(values?.percent ?? 100))
    .replaceAll('{label}', values?.label ?? '')
    .replaceAll('{diagnostic}', diagnostic);
};

export function cutawayMessage<K extends CutawayMessageId>(
  locale: unknown,
  id: K,
  ...args: CutawayMessageArgs<K>
): string {
  return renderCutawayMessage(locale, id, args[0]);
}

export function cutawayMessageState<K extends CutawayMessageId>(
  id: K,
  ...args: CutawayMessageArgs<K>
): Extract<CutawayMessageState, { statusId: K }> {
  return (args.length === 0 ? { statusId: id } : { statusId: id, statusParams: args[0] }) as
    Extract<CutawayMessageState, { statusId: K }>;
}

export function renderCutawayMessageState(locale: unknown, state: CutawayMessageState): string {
  const params = 'statusParams' in state ? state.statusParams : undefined;
  return renderCutawayMessage(locale, state.statusId, params);
}

export function statusFailureMessage(locale: unknown, reason: StatusFailureReason): string {
  return STATUS_FAILURE_COPY[normalizeVillageLocale(locale)][reason];
}

export function furnitureLayerLabel(locale: unknown, layer: FurnitureLayer): string {
  return FURNITURE_LAYER_COPY[normalizeVillageLocale(locale)][layer];
}

export function builtInPrefabLabel(locale: unknown, id: BuiltInOfficePrefabId): string {
  return CATALOG[normalizeVillageLocale(locale)].cutaway.prefabs[id];
}

export function localeMessage(value: unknown): { locale: VillageLocale; sequence: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; locale?: unknown; sequence?: unknown };
  if (message.type !== 'pixelverse.locale.update') return undefined;
  return { locale: normalizeVillageLocale(message.locale), sequence: Number(message.sequence) || Date.now() };
}

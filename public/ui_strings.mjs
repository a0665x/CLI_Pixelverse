export const SUPPORTED_LOCALES = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR'];

export const LOCALE_LABELS = {
  'zh-TW': '繁中',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
};

const commandDeckCopy = ({
  topBar, rails, inspector, layout, timeline, diagnostics, hook, empty, error,
  settings, camera, world, dynamic, ...activeSurfaces
}) => ({ commandDeck: {
  topBar, rails, inspector, layout, timeline, diagnostics, hook, empty, error,
  settings, camera, world, dynamic, ...activeSurfaces,
} });

const EN_ACTIVE_SURFACES = {
  interaction: { at: ({ action, label }) => `${action} at ${label}`, furnitureFallback: 'Furniture', actions: { rest: 'Resting', planning: 'Planning', ponder: 'Thinking', terminal: 'Working', dispatch: 'Dispatching', notes: 'Reviewing', writing: 'Writing', neutral: 'Interacting' } },
  activity: { thinking: ({ room }) => `Reasoning quietly inside ${room}`, planning: ({ room }) => `Planning steps inside ${room}`, working: ({ task, room }) => `Using ${task} inside ${room}`, offline: () => 'No fresh heartbeat from the main runtime', waiting: ({ room }) => `Waiting in ${room} for the next task`, external: ({ value }) => `Activity: ${value}` },
  ambient: { planning: ({ task }) => task ? `Plan: ${task}` : 'Planning route…', thinking: ({ task }) => task ? `Think: ${task}` : 'Reasoning quietly', working: ({ task }) => task ? `Doing: ${task}` : 'Running tools', offline: () => 'Signal lost', standby: () => 'Standing by' },
  furniture: { scale: ({ scale }) => `Scale ${scale}`, fallback: 'Furniture', coordinate: ({ label, room, x, y, snap, scale }) => `${label} · ${room} · x ${x}%, y ${y}% · Grid ${snap}% · Scale ${scale}` },
  accessibility: { pose: ({ pose }) => `${pose} pose`, interaction: ({ interaction }) => `${interaction} interaction`, poseFallback: 'Active' },
  timelineDetail: {
    labels: { reasoning: 'Reasoning', toolStart: 'Tool start', toolDone: 'Tool done', toolRoute: 'Tool route', complete: 'Complete', tool: 'Tool', thought: 'Thought', status: 'Status', action: 'Action' },
    messages: { reasoning: ({ value }) => `Reasoning: ${value}`, started: ({ tool, preview }) => `Started ${tool}${preview ? ` | ${preview}` : ''}`, finished: ({ tool, preview }) => `Finished ${tool}${preview ? ` | ${preview}` : ''}`, route: ({ value }) => `Tool route: ${value}`, completed: ({ value }) => `Completed: ${value}`, returned: 'Returned to standby', toolStep: ({ value }) => `Tool step: ${value}`, thought: ({ value }) => `Thinking: ${value}`, status: ({ value }) => `Status: ${value}`, fallback: ({ value }) => `Action: ${value}` },
  },
};

const ZH_ACTIVE_SURFACES = {
  interaction: { at: ({ action, label }) => `${action}：${label}`, furnitureFallback: '家具', actions: { rest: '休息', planning: '規劃', ponder: '思考', terminal: '操作', dispatch: '派遣', notes: '查閱', writing: '撰寫', neutral: '互動' } },
  activity: { thinking: ({ room }) => `在${room}安靜推理`, planning: ({ room }) => `在${room}規劃步驟`, working: ({ task, room }) => `在${room}執行 ${task}`, offline: () => '主執行環境沒有新的心跳', waiting: ({ room }) => `在${room}等待下一項任務`, external: ({ value }) => `活動：${value}` },
  ambient: { planning: ({ task }) => task ? `規劃：${task}` : '正在拆解需求', thinking: ({ task }) => task ? `思考：${task}` : '正在整理推理', working: ({ task }) => task ? `執行：${task}` : '工具運作中', offline: () => '訊號中斷', standby: () => '待命中' },
  furniture: { scale: ({ scale }) => `縮放 ${scale}`, fallback: '家具', coordinate: ({ label, room, x, y, snap, scale }) => `${label} · ${room} · x ${x}%、y ${y}% · 網格 ${snap}% · 縮放 ${scale}` },
  accessibility: { pose: ({ pose }) => `${pose}姿勢`, interaction: ({ interaction }) => `互動：${interaction}`, poseFallback: '活動中' },
  timelineDetail: {
    labels: { reasoning: '規劃', toolStart: '工具啟動', toolDone: '工具完成', toolRoute: '工具序列', complete: '完成', tool: '工具', thought: '思考', status: '狀態', action: '動作' },
    messages: { reasoning: ({ value }) => `主代理正在規劃：${value}`, started: ({ tool, preview }) => `開始使用 ${tool}${preview ? `｜${preview}` : ''}`, finished: ({ tool, preview }) => `完成 ${tool}${preview ? `｜${preview}` : ''}`, route: ({ value }) => `目前工具：${value}`, completed: ({ value }) => `已完成：${value}`, returned: '回到待命站', toolStep: ({ value }) => `工具步驟：${value}`, thought: ({ value }) => `思考中：${value}`, status: ({ value }) => `狀態：${value}`, fallback: ({ value }) => `動作：${value}` },
  },
};

const JA_ACTIVE_SURFACES = {
  interaction: { at: ({ action, label }) => `${label}で${action}`, furnitureFallback: '家具', actions: { rest: '休憩', planning: '計画', ponder: '思考', terminal: '作業', dispatch: '派遣', notes: '確認', writing: '執筆', neutral: '操作' } },
  activity: { thinking: ({ room }) => `${room}で静かに推論中`, planning: ({ room }) => `${room}で手順を計画中`, working: ({ task, room }) => `${room}で ${task} を実行中`, offline: () => 'メイン実行環境から新しいハートビートがありません', waiting: ({ room }) => `${room}で次のタスクを待機中`, external: ({ value }) => `活動：${value}` },
  ambient: { planning: ({ task }) => task ? `計画：${task}` : '要件を整理中…', thinking: ({ task }) => task ? `思考：${task}` : '静かに推論中', working: ({ task }) => task ? `実行：${task}` : 'ツールを実行中', offline: () => '通信が途切れました', standby: () => '待機中' },
  furniture: { scale: ({ scale }) => `倍率 ${scale}`, fallback: '家具', coordinate: ({ label, room, x, y, snap, scale }) => `${label}・${room}・x ${x}%、y ${y}%・グリッド ${snap}%・倍率 ${scale}` },
  accessibility: { pose: ({ pose }) => `${pose}の姿勢`, interaction: ({ interaction }) => `操作：${interaction}`, poseFallback: '活動中' },
  timelineDetail: {
    labels: { reasoning: '推論', toolStart: 'ツール開始', toolDone: 'ツール完了', toolRoute: 'ツール経路', complete: '完了', tool: 'ツール', thought: '思考', status: '状態', action: '動作' },
    messages: { reasoning: ({ value }) => `推論：${value}`, started: ({ tool, preview }) => `${tool} を開始${preview ? `｜${preview}` : ''}`, finished: ({ tool, preview }) => `${tool} を完了${preview ? `｜${preview}` : ''}`, route: ({ value }) => `ツール経路：${value}`, completed: ({ value }) => `完了：${value}`, returned: '待機場所へ戻りました', toolStep: ({ value }) => `ツール手順：${value}`, thought: ({ value }) => `思考：${value}`, status: ({ value }) => `状態：${value}`, fallback: ({ value }) => `動作：${value}` },
  },
};

const KO_ACTIVE_SURFACES = {
  interaction: { at: ({ action, label }) => `${label}에서 ${action}`, furnitureFallback: '가구', actions: { rest: '휴식', planning: '계획', ponder: '생각', terminal: '작업', dispatch: '파견', notes: '검토', writing: '작성', neutral: '상호작용' } },
  activity: { thinking: ({ room }) => `${room}에서 조용히 추론 중`, planning: ({ room }) => `${room}에서 단계를 계획 중`, working: ({ task, room }) => `${room}에서 ${task} 실행 중`, offline: () => '메인 실행 환경에서 새 하트비트가 없습니다', waiting: ({ room }) => `${room}에서 다음 작업 대기 중`, external: ({ value }) => `활동: ${value}` },
  ambient: { planning: ({ task }) => task ? `계획: ${task}` : '요구사항 정리 중…', thinking: ({ task }) => task ? `생각: ${task}` : '조용히 추론 중', working: ({ task }) => task ? `실행: ${task}` : '도구 실행 중', offline: () => '신호가 끊겼습니다', standby: () => '대기 중' },
  furniture: { scale: ({ scale }) => `배율 ${scale}`, fallback: '가구', coordinate: ({ label, room, x, y, snap, scale }) => `${label} · ${room} · x ${x}%, y ${y}% · 그리드 ${snap}% · 배율 ${scale}` },
  accessibility: { pose: ({ pose }) => `${pose} 자세`, interaction: ({ interaction }) => `상호작용: ${interaction}`, poseFallback: '활동 중' },
  timelineDetail: {
    labels: { reasoning: '추론', toolStart: '도구 시작', toolDone: '도구 완료', toolRoute: '도구 경로', complete: '완료', tool: '도구', thought: '생각', status: '상태', action: '동작' },
    messages: { reasoning: ({ value }) => `추론: ${value}`, started: ({ tool, preview }) => `${tool} 시작${preview ? `｜${preview}` : ''}`, finished: ({ tool, preview }) => `${tool} 완료${preview ? `｜${preview}` : ''}`, route: ({ value }) => `도구 경로: ${value}`, completed: ({ value }) => `완료: ${value}`, returned: '대기 위치로 돌아갔습니다', toolStep: ({ value }) => `도구 단계: ${value}`, thought: ({ value }) => `생각: ${value}`, status: ({ value }) => `상태: ${value}`, fallback: ({ value }) => `동작: ${value}` },
  },
};

export const UI_CATALOG = {
  'en-US': commandDeckCopy({
    ...EN_ACTIVE_SURFACES,
    topBar: { label: 'CLI Pixelverse live status', brand: 'CLI_Pixelverse' },
    rails: { agentsLabel: 'Agent force rail', agentsTitle: 'Live agents', previousAgents: 'Previous agents', nextAgents: 'Next agents', inspectorLabel: 'Intelligence inspector', hookChannelsLabel: 'Live Hook channels' },
    inspector: { title: 'Inspector', selectAgent: 'Select agent', empty: 'Select an agent to inspect current activity.', currentTask: 'Current task', lastUpdate: 'Last update', room: 'Room', events: 'Events', agentFallback: 'Agent', sessionNames: { api: 'API Session', cli: 'CLI Session', gateway: 'Gateway Session' }, liveDetail: ({ name }) => `${name} live detail`, rowState: 'State', rowRoom: 'Room', rowTask: 'Task', rowEventTime: 'Event time', latestEvent: ({ value }) => `Latest event: ${value}`, detailSeparator: ' • ' },
    layout: { controlsLabel: 'Command deck layout controls', collapseLeft: 'Collapse left region', expandLeft: 'Expand left region', collapseRight: 'Collapse right region', expandRight: 'Expand right region', collapseBottom: 'Collapse mission trace', expandBottom: 'Expand mission trace', swapSides: 'Swap side docks', reset: 'Reset command deck layout', resizeLeft: 'Resize live agent rail', resizeRight: 'Resize Hook rail', resizeBottom: 'Resize mission trace' },
    timeline: { title: 'Mission trace', live: 'Live', paused: 'Paused', resume: 'Resume live', summary: ({ state, count }) => `${state} · ${count} lanes`, eventLabel: ({ category, summary }) => `${category}: ${summary}` },
    diagnostics: { label: 'Diagnostics', explanation: 'Agent state, Hook routing, and connection health.' },
    hook: { guide: 'Hook guide', semantic: { rest: 'Rest', search: 'Search', work: 'Work' }, categories: { reasoning: 'Reasoning', tool: 'Tool', subagent: 'Subagent', session: 'Session', status: 'Status', message: 'Message', completion: 'Completion' } },
    empty: { events: 'No events yet', agents: 'No live agents', hooks: 'No active Hooks' },
    error: { read: 'Read failed', exposure: 'Exposure update failed', unavailable: 'Unavailable' },
    settings: { label: 'Settings', languageSelector: 'Language selector', exposureSelector: 'Exposure selector', copyUrl: 'Copy URL' },
    camera: { label: 'World camera controls', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset zoom' },
    world: { label: 'Agent village', frameTitle: 'Pixelverse agent village' },
    dynamic: { page: ({ page, count }) => `Page ${page} of ${count}`, lastSync: ({ timestamp, seconds }) => `Last sync ${timestamp} · ${seconds}s ago`, agentCount: ({ count }) => `${count} agents` },
  }),
  'zh-TW': commandDeckCopy({
    ...ZH_ACTIVE_SURFACES,
    topBar: { label: 'CLI Pixelverse 即時狀態', brand: 'CLI_Pixelverse' },
    rails: { agentsLabel: '代理戰力列', agentsTitle: '即時代理', previousAgents: '上一頁代理', nextAgents: '下一頁代理', inspectorLabel: '情報檢視器', hookChannelsLabel: '即時 Hook 頻道' },
    inspector: { title: '狀態檢視器', selectAgent: '選擇代理', empty: '選擇代理以檢視目前活動。', currentTask: '目前任務', lastUpdate: '最近更新', room: '房間', events: '事件', agentFallback: '代理', sessionNames: { api: 'API 工作階段', cli: 'CLI 工作階段', gateway: 'Gateway 工作階段' }, liveDetail: ({ name }) => `${name} 即時細節`, rowState: '狀態', rowRoom: '房間', rowTask: '任務', rowEventTime: '事件時間', latestEvent: ({ value }) => `最新事件：${value}`, detailSeparator: '｜' },
    layout: { controlsLabel: '指揮台版面控制', collapseLeft: '收合左側區域', expandLeft: '展開左側區域', collapseRight: '收合右側區域', expandRight: '展開右側區域', collapseBottom: '收合任務軌跡', expandBottom: '展開任務軌跡', swapSides: '交換兩側面板', reset: '重設指揮台版面', resizeLeft: '調整即時代理列寬度', resizeRight: '調整 Hook 列寬度', resizeBottom: '調整任務軌跡高度' },
    timeline: { title: '任務軌跡', live: '即時', paused: '已暫停', resume: '恢復即時', summary: ({ state, count }) => `${state} · ${count} 條軌跡`, eventLabel: ({ category, summary }) => `${category}：${summary}` },
    diagnostics: { label: '診斷', explanation: '代理狀態、Hook 路由與連線健康狀態。' },
    hook: { guide: 'Hook 指南', semantic: { rest: '休息', search: '搜尋', work: '工作' }, categories: { reasoning: '推理', tool: '工具', subagent: '分身', session: '工作階段', status: '狀態', message: '訊息', completion: '完成' } },
    empty: { events: '尚無事件', agents: '沒有即時代理', hooks: '沒有啟用的 Hook' },
    error: { read: '讀取失敗', exposure: '公開網址更新失敗', unavailable: '無法使用' },
    settings: { label: '設定', languageSelector: '語言選擇器', exposureSelector: '公開方式選擇器', copyUrl: '複製網址' },
    camera: { label: '世界鏡頭控制', zoomIn: '放大', zoomOut: '縮小', reset: '重設縮放' },
    world: { label: '代理村莊', frameTitle: 'Pixelverse 代理村莊' },
    dynamic: { page: ({ page, count }) => `第 ${page} 頁，共 ${count} 頁`, lastSync: ({ timestamp, seconds }) => `最近同步 ${timestamp} · ${seconds} 秒前`, agentCount: ({ count }) => `${count} 位代理` },
  }),
  'ja-JP': commandDeckCopy({
    ...JA_ACTIVE_SURFACES,
    topBar: { label: 'CLI Pixelverse ライブ状態', brand: 'CLI_Pixelverse' },
    rails: { agentsLabel: 'エージェント一覧', agentsTitle: 'ライブエージェント', previousAgents: '前のエージェント', nextAgents: '次のエージェント', inspectorLabel: 'インテリジェンスインスペクター', hookChannelsLabel: 'ライブ Hook チャンネル' },
    inspector: { title: 'インスペクター', selectAgent: 'エージェントを選択', empty: 'エージェントを選択して現在の活動を確認します。', currentTask: '現在のタスク', lastUpdate: '最終更新', room: '部屋', events: 'イベント', agentFallback: 'エージェント', sessionNames: { api: 'API セッション', cli: 'CLI セッション', gateway: 'Gateway セッション' }, liveDetail: ({ name }) => `${name} のライブ詳細`, rowState: '状態', rowRoom: '部屋', rowTask: 'タスク', rowEventTime: 'イベント時刻', latestEvent: ({ value }) => `最新イベント：${value}`, detailSeparator: '｜' },
    layout: { controlsLabel: 'コマンドデッキのレイアウト操作', collapseLeft: '左領域を閉じる', expandLeft: '左領域を開く', collapseRight: '右領域を閉じる', expandRight: '右領域を開く', collapseBottom: 'ミッション軌跡を閉じる', expandBottom: 'ミッション軌跡を開く', swapSides: '左右のドックを交換', reset: 'コマンドデッキをリセット', resizeLeft: 'エージェント一覧の幅を変更', resizeRight: 'Hook 一覧の幅を変更', resizeBottom: 'ミッション軌跡の高さを変更' },
    timeline: { title: 'ミッション軌跡', live: 'ライブ', paused: '一時停止', resume: 'ライブに戻る', summary: ({ state, count }) => `${state}・${count} レーン`, eventLabel: ({ category, summary }) => `${category}：${summary}` },
    diagnostics: { label: '診断', explanation: 'エージェント状態、Hook 経路、接続状態を確認します。' },
    hook: { guide: 'Hook ガイド', semantic: { rest: '休憩', search: '検索', work: '作業' }, categories: { reasoning: '推論', tool: 'ツール', subagent: 'サブエージェント', session: 'セッション', status: '状態', message: 'メッセージ', completion: '完了' } },
    empty: { events: 'イベントはまだありません', agents: 'ライブエージェントはいません', hooks: '有効な Hook はありません' },
    error: { read: '読込失敗', exposure: '公開 URL の更新に失敗しました', unavailable: '利用不可' },
    settings: { label: '設定', languageSelector: '言語選択', exposureSelector: '公開方法の選択', copyUrl: 'URL をコピー' },
    camera: { label: 'ワールドカメラ操作', zoomIn: '拡大', zoomOut: '縮小', reset: 'ズームをリセット' },
    world: { label: 'エージェント村', frameTitle: 'Pixelverse エージェント村' },
    dynamic: { page: ({ page, count }) => `${page} / ${count} ページ`, lastSync: ({ timestamp, seconds }) => `最終同期 ${timestamp}・${seconds} 秒前`, agentCount: ({ count }) => `${count} エージェント` },
  }),
  'ko-KR': commandDeckCopy({
    ...KO_ACTIVE_SURFACES,
    topBar: { label: 'CLI Pixelverse 실시간 상태', brand: 'CLI_Pixelverse' },
    rails: { agentsLabel: '에이전트 전력 레일', agentsTitle: '실시간 에이전트', previousAgents: '이전 에이전트', nextAgents: '다음 에이전트', inspectorLabel: '인텔리전스 검사기', hookChannelsLabel: '실시간 Hook 채널' },
    inspector: { title: '검사기', selectAgent: '에이전트 선택', empty: '에이전트를 선택해 현재 활동을 확인하세요.', currentTask: '현재 작업', lastUpdate: '마지막 업데이트', room: '방', events: '이벤트', agentFallback: '에이전트', sessionNames: { api: 'API 세션', cli: 'CLI 세션', gateway: 'Gateway 세션' }, liveDetail: ({ name }) => `${name} 실시간 상세`, rowState: '상태', rowRoom: '방', rowTask: '작업', rowEventTime: '이벤트 시간', latestEvent: ({ value }) => `최신 이벤트: ${value}`, detailSeparator: '｜' },
    layout: { controlsLabel: '명령 데크 레이아웃 제어', collapseLeft: '왼쪽 영역 접기', expandLeft: '왼쪽 영역 펼치기', collapseRight: '오른쪽 영역 접기', expandRight: '오른쪽 영역 펼치기', collapseBottom: '미션 추적 접기', expandBottom: '미션 추적 펼치기', swapSides: '좌우 도크 바꾸기', reset: '명령 데크 레이아웃 초기화', resizeLeft: '실시간 에이전트 레일 크기 조절', resizeRight: 'Hook 레일 크기 조절', resizeBottom: '미션 추적 크기 조절' },
    timeline: { title: '미션 추적', live: '실시간', paused: '일시 중지', resume: '실시간 재개', summary: ({ state, count }) => `${state} · ${count}개 레인`, eventLabel: ({ category, summary }) => `${category}: ${summary}` },
    diagnostics: { label: '진단', explanation: '에이전트 상태, Hook 경로와 연결 상태를 확인합니다.' },
    hook: { guide: 'Hook 안내', semantic: { rest: '휴식', search: '검색', work: '작업' }, categories: { reasoning: '추론', tool: '도구', subagent: '서브에이전트', session: '세션', status: '상태', message: '메시지', completion: '완료' } },
    empty: { events: '아직 이벤트가 없습니다', agents: '실시간 에이전트가 없습니다', hooks: '활성 Hook이 없습니다' },
    error: { read: '읽기 실패', exposure: '공개 URL 업데이트 실패', unavailable: '사용할 수 없음' },
    settings: { label: '설정', languageSelector: '언어 선택', exposureSelector: '공개 방식 선택', copyUrl: 'URL 복사' },
    camera: { label: '월드 카메라 제어', zoomIn: '확대', zoomOut: '축소', reset: '확대/축소 초기화' },
    world: { label: '에이전트 마을', frameTitle: 'Pixelverse 에이전트 마을' },
    dynamic: { page: ({ page, count }) => `${page} / ${count}페이지`, lastSync: ({ timestamp, seconds }) => `마지막 동기화 ${timestamp} · ${seconds}초 전`, agentCount: ({ count }) => `${count}명 에이전트` },
  }),
};

const nestedLocaleKeys = (value, prefix = '') => Object.entries(value || {}).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return child && typeof child === 'object' && !Array.isArray(child)
    ? nestedLocaleKeys(child, path)
    : [path];
}).sort();

export function missingLocaleKeys(catalog, baseline = 'en-US') {
  const locales = [baseline, ...SUPPORTED_LOCALES.filter((locale) => locale !== baseline)];
  const expected = [...new Set(locales.flatMap((locale) => nestedLocaleKeys(catalog?.[locale])))].sort();
  return Object.fromEntries(locales.flatMap((locale) => {
    const copy = catalog?.[locale];
    const actual = new Set(nestedLocaleKeys(copy));
    const missing = expected.filter((key) => !actual.has(key));
    return missing.length ? [[locale, missing]] : [];
  }));
}

export function uiText(locale, key, params = {}) {
  const normalized = SUPPORTED_LOCALES.includes(locale) ? locale : 'en-US';
  const resolve = (copy) => String(key).split('.').reduce((value, part) => value?.[part], copy);
  const value = resolve(UI_CATALOG[normalized]) ?? resolve(UI_CATALOG['en-US']);
  if (typeof value === 'function') return value(params);
  return value == null ? key : String(value).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

const shortLocaleValue = (value, limit = 84) => {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}…` : text;
};

export function furnitureLabelForLocale(locale, value, internalIdentifier = '') {
  const label = String(value || '').trim();
  const internal = String(internalIdentifier || '').trim();
  if (!label || label === internal || /^[a-z][a-z0-9_-]*$/i.test(label)) {
    return uiText(locale, 'commandDeck.furniture.fallback');
  }
  return label;
}

export function interactionText(locale, target = {}) {
  if (!target?.propType) return '';
  const pose = target.pose?.pose || 'neutral';
  const actionKey = `commandDeck.interaction.actions.${pose}`;
  const action = uiText(locale, actionKey) === actionKey
    ? uiText(locale, 'commandDeck.interaction.actions.neutral')
    : uiText(locale, actionKey);
  const label = furnitureLabelForLocale(locale, target.propLabel, target.propType);
  return uiText(locale, 'commandDeck.interaction.at', { action, label });
}

export function ambientText(locale, agent = {}, taskValue = agent.task || '') {
  if (agent.speech) return String(agent.speech);
  const state = agent.state === 'planning' ? 'planning'
    : agent.state === 'thinking' ? 'thinking'
      : agent.state === 'working' ? 'working'
        : agent.state === 'offline' ? 'offline' : 'standby';
  return uiText(locale, `commandDeck.ambient.${state}`, { task: shortLocaleValue(taskValue, 28) });
}

export function activityHintForLocale(locale, agent = {}, roomName = '', taskValue = agent.task || '') {
  if (agent.activity_hint) {
    return uiText(locale, 'commandDeck.activity.external', { value: String(agent.activity_hint) });
  }
  const state = agent.state === 'thinking' ? 'thinking'
    : agent.state === 'planning' ? 'planning'
      : agent.state === 'working' ? 'working'
        : agent.state === 'offline' ? 'offline' : 'waiting';
  return uiText(locale, `commandDeck.activity.${state}`, {
    room: roomName,
    task: String(taskValue || uiText(locale, 'commandDeck.timelineDetail.labels.tool')),
  });
}

export function timelineItemForLocale(locale, item = {}, { toolLabel = '', toolRouteLabel = '' } = {}) {
  const eventName = item.event_name || '';
  const tool = toolLabel || item.tool_name || uiText(locale, 'commandDeck.timelineDetail.labels.tool');
  const preview = shortLocaleValue(item.preview || item.message || '', 84);
  const label = (key) => uiText(locale, `commandDeck.timelineDetail.labels.${key}`);
  const message = (key, params = {}) => uiText(locale, `commandDeck.timelineDetail.messages.${key}`, params);
  if (eventName === 'main.reasoning') return { label: label('reasoning'), message: message('reasoning', { value: preview || label('reasoning') }) };
  if (eventName === 'main.tool.started') return { label: label('toolStart'), message: message('started', { tool, preview: shortLocaleValue(item.preview || '', 56) }) };
  if (eventName === 'main.tool.completed') return { label: label('toolDone'), message: message('finished', { tool, preview: shortLocaleValue(item.preview || '', 56) }) };
  if (eventName === 'main.tool.batch') return { label: label('toolRoute'), message: message('route', { value: toolRouteLabel || preview || label('toolRoute') }) };
  if (eventName === 'main.task.completed') return { label: label('complete'), message: preview ? message('completed', { value: preview }) : message('returned') };
  if (item.type === 'tool') return { label: label('tool'), message: message('toolStep', { value: toolLabel || preview || label('tool') }) };
  if (item.type === 'thought') return { label: label('thought'), message: message('thought', { value: preview || label('thought') }) };
  if (item.type === 'status') return { label: label('status'), message: message('status', { value: preview || label('status') }) };
  return { label: label('action'), message: message('fallback', { value: shortLocaleValue(item.message || item.to || label('action'), 84) }) };
}

export function furnitureCoordinateText(locale, {
  room = '', x = '0.0', y = '0.0', snap = '0.5', scale = '100%', label = '', propType = '',
} = {}) {
  return uiText(locale, 'commandDeck.furniture.coordinate', {
    label: furnitureLabelForLocale(locale, label, propType), room, x, y, snap, scale,
  });
}

export function poseLabelForLocale(locale, pose = '') {
  const key = `commandDeck.interaction.actions.${pose}`;
  const localized = uiText(locale, key);
  return localized === key ? uiText(locale, 'commandDeck.accessibility.poseFallback') : localized;
}

const ROOM_DECOR = {
  think_lab: [
    { type: 'window', labelKey: 'northWindow' },
    { type: 'bookshelf', labelKey: 'bookshelf' },
    { type: 'desk', labelKey: 'focusDesk' },
    { type: 'chair', labelKey: 'thinkingChair' },
    { type: 'lamp', labelKey: 'ideaLamp' },
    { type: 'board', labelKey: 'thoughtBoard' },
    { type: 'plant', labelKey: 'calmPlant' },
  ],
  blueprint_lab: [
    { type: 'window', labelKey: 'blueWindow' },
    { type: 'table', labelKey: 'blueprintTable' },
    { type: 'desk', labelKey: 'plannerDesk' },
    { type: 'cabinet', labelKey: 'archiveCabinet' },
    { type: 'terminal', labelKey: 'scannerConsole' },
    { type: 'board', labelKey: 'systemMap' },
    { type: 'poster', labelKey: 'routePoster' },
    { type: 'rug', labelKey: 'blueprintRug' },
  ],
  file_library: [
    { type: 'bookshelf', labelKey: 'bookshelf' },
    { type: 'cabinet', labelKey: 'archiveCabinet' },
    { type: 'desk', labelKey: 'readingDesk' },
    { type: 'terminal', labelKey: 'scannerConsole' },
    { type: 'chair', labelKey: 'thinkingChair' },
  ],
  code_workbench: [
    { type: 'workbench', labelKey: 'workbench' },
    { type: 'desk', labelKey: 'plannerDesk' },
    { type: 'terminal', labelKey: 'terminalRig' },
    { type: 'board', labelKey: 'thoughtBoard' },
    { type: 'cabinet', labelKey: 'partsLocker' },
  ],
  terminal_bay: [
    { type: 'terminal', labelKey: 'terminalRig' },
    { type: 'server', labelKey: 'buildServer' },
    { type: 'desk', labelKey: 'focusDesk' },
    { type: 'chair', labelKey: 'thinkingChair' },
    { type: 'cabinet', labelKey: 'partsLocker' },
  ],
  tool_forge: [
    { type: 'server', labelKey: 'buildServer' },
    { type: 'workbench', labelKey: 'workbench' },
    { type: 'terminal', labelKey: 'terminalRig' },
    { type: 'crate', labelKey: 'toolChest' },
    { type: 'cabinet', labelKey: 'partsLocker' },
    { type: 'coffee', labelKey: 'coffeeMachine' },
    { type: 'rug', labelKey: 'forgeRug' },
  ],
  response_studio: [
    { type: 'window', labelKey: 'storyWindow' },
    { type: 'desk', labelKey: 'writingDesk' },
    { type: 'terminal', labelKey: 'replyConsole' },
    { type: 'bookshelf', labelKey: 'replyShelf' },
    { type: 'plant', labelKey: 'calmPlant' },
    { type: 'chair', labelKey: 'briefingChair' },
    { type: 'poster', labelKey: 'replyPoster' },
  ],
  standby_dock: [
    { type: 'sofa', labelKey: 'breakSofa' },
    { type: 'bed', labelKey: 'restBed' },
    { type: 'chair', labelKey: 'standbyChair' },
    { type: 'locker', labelKey: 'readyLocker' },
    { type: 'charger', labelKey: 'chargePad' },
    { type: 'coffee', labelKey: 'teaCorner' },
    { type: 'plant', labelKey: 'calmPlant' },
  ],
  clone_bay: [
    { type: 'portal', labelKey: 'cloneGate' },
    { type: 'desk', labelKey: 'subagentDesk' },
    { type: 'terminal', labelKey: 'dispatchBoard' },
    { type: 'crate', labelKey: 'missionCrate' },
    { type: 'server', labelKey: 'cloneServer' },
    { type: 'poster', labelKey: 'handoffPoster' },
  ],
  session_archive: [
    { type: 'cabinet', labelKey: 'sessionCabinet' },
    { type: 'terminal', labelKey: 'sessionViewer' },
    { type: 'bookshelf', labelKey: 'recordShelf' },
    { type: 'table', labelKey: 'timelineTable' },
    { type: 'poster', labelKey: 'timelinePoster' },
    { type: 'rug', labelKey: 'archiveRug' },
  ],
};

const ZH_TW = {
  brandTitle: 'CLI_Pixelverse',
  brandSubtitle: '以像素世界呈現 CLI 任務、工具、分身、工作階段與心跳遙測。',
  inspectorTitle: '狀態檢視器',
  inspectorAgentSelect: '選擇代理',
  inspectorEmpty: '點擊世界中的角色，查看他目前位於哪裡、正在使用哪些工具，以及最近做了什麼。',
  eventBeltTitle: '代理事件時間圖',
  noEvents: '尚無事件',
  waitingEvents: '等待新的 bridge / Hermes 活動…',
  timelineRefreshLabel: '事件圖刷新',
  syncPending: '尚未同步',
  checking: '檢查中',
  readFailed: '讀取失敗',
  hermesConnected: 'Hermes 已接線',
  localOnly: '僅本地 bridge',
  worldOverview: '世界總覽',
  connectionLabel: 'Hermes 連線',
  agentsVisible: '可見代理',
  subagentsVisible: '分身代理',
  sessionsVisible: '分支工作階段',
  timelineTitle: '近期動作',
  noActions: '目前沒有 bridge action 記錄',
  currentTask: '當前任務',
  lastUpdate: '最近更新',
  roomMeaning: '房間語意',
  eventCount: '事件數',
  languageLabel: '語言',
  exposureLabel: '開啟方式',
  exposureModes: { localhost: '本機', tailscale: 'Tailscale', ngrok: 'ngrok' },
  copyUrl: '複製 URL',
  copyUrlPrompt: '複製這個 URL',
  exposureFailed: '切換 URL 失敗',
  mobileMode: '手機模式',
  desktopMode: '桌面模式',
  mobileModeHint: '切換成手機側欄版面',
  desktopModeHint: '恢復桌面儀表板版面',
  dashboardPanels: '戰情側欄',
  dashboardEvents: '事件',
  dashboardAgents: '代理',
  dashboardHelp: '說明',
  dashboardPrevious: '上一頁',
  dashboardNext: '下一頁',
  dashboardPage: (page, count) => `第 ${page} / ${count} 頁`,
  dashboardGuideTitle: '地圖工作區說明',
  diagnosticsLabel: '診斷',
  diagnosticsExplanation: '診斷抽屜顯示狀態圖例與 Hook 路由表，用來確認代理活動如何映射到房間與連線狀態。',
  showPanels: '開啟側欄',
  hidePanels: '隱藏側欄',
  closePanels: '關閉',
  heartbeatMissing: '尚未收到 agent heartbeat',
  heartbeatWaiting: '等待 agent 接線',
  heartbeatLive: (age) => `Heartbeat 正常 · ${age}`,
  heartbeatStale: (age) => `Heartbeat 中斷 · ${age}`,
  uiStatusHealthy: 'UI 狀態一切正常',
  uiStatusWaiting: 'UI 正常 · 等待 agent 接線',
  uiStatusStale: 'UI 正常 · agent 心跳中斷',
  uiStatusMissing: 'UI 正常 · 尚無 agent 心跳',
  deleteOfflineAgent: '刪除',
  deleteOfflineAgentConfirm: (agent) => `確定刪除離線 agent「${agent}」？`,
  deleteOfflineAgentFailed: '無法刪除離線 agent',
  editFurniture: '移動家具',
  saveLayout: '儲存地圖',
  cancelLayout: '取消編輯',
  layoutEditing: '家具編輯模式',
  layoutEditingHint: '拖拉家具微調位置；按 Esc 可取消，按「儲存地圖」後路徑規劃會立即套用。',
  layoutSelectedHint: '已選取家具，可直接拖曳；也可用方向鍵微調位置，Shift 會加大步距。',
  layoutDragActiveHint: '拖曳中：鬆開滑鼠即可放下，角色會依最新障礙重新規劃路徑。',
  layoutNoChanges: '目前沒有未儲存變更',
  layoutUnsavedChanges: '尚有未儲存變更',
  layoutChangesCount: (n) => `未儲存 ${n} 項變更`,
  layoutPickHint: '點一下家具後直接拖拉',
  layoutKeyboardHint: '方向鍵微調 · Shift 加速 · Enter 儲存 · Esc 取消',
  layoutDragSurfaceHint: '可將家具拖曳到其他房間；點空白處可取消選取',
  layoutGridHint: '格線吸附 0.5% · 按住 Shift 改成 1.0%',
  layoutCoordTitle: '即時座標',
  layoutScaleDown: '縮小家具',
  layoutScaleUp: '放大家具',
  layoutCoordChip: (x, y) => `x ${x}% · y ${y}%`,
  layoutSnapChip: (snap) => `吸附 ${snap}%`,
  layoutGuideBadge: (label, x, y, snap) => `${label} · x ${x}% · y ${y}% · 吸附 ${snap}%`,
  layoutSaving: '儲存中…',
  layoutSaved: '家具位置已儲存',
  layoutSavedDetail: (changes, rooms) => `已儲存 ${rooms} 個房間、${changes} 項家具變更`,
  layoutSaveFailed: '地圖儲存失敗',
  layoutCollisionTitle: '家具不可重疊',
  layoutCollisionDetail: '請將家具移到沒有占用的位置。',
  layoutReset: '已取消編輯，恢復上次儲存的配置',
  layoutExitConfirm: '目前還有未儲存變更，確定要放棄這次家具調整嗎？',
  eventGraphSummary: (n) => `${n} 個代理時間圖`,
  activeNow: '目前活躍',
  blockedFor: '停留時長',
  latestEvent: '最新事件',
  timelineWindow: '近 20 分鐘',
  eventLaneHint: 'x 軸為近期時間，y 軸為事件類別',
  eventCategories: {
    reasoning: '推理',
    tool: '工具',
    subagent: '分身',
    session: '工作階段',
    status: '狀態',
    message: '訊息',
    completion: '完成',
  },
  coreWing: '核心工位',
  cloneWing: '分身工位',
  summaryConnected: '主代理會沿走廊移動到不同工位；分身與分支工作階段常駐右側辦公區。',
  summaryDisconnected: '目前仍可觀察 bridge 心跳與本地事件；若要更完整資訊，請同時開啟 Hermes web/gateway。',
  lastSyncPrefix: '最後同步',
  worldLegend: '狀態圖例',
  hookStateTitle: 'Hook 狀態路由表',
  hookStateHook: 'Hook',
  hookStateState: '狀態',
  hookStateRoom: '房間',
  legendThinkingTitle: '思考中',
  legendThinkingBody: 'Henry 會進入思考室，並在房內繞桌巡走。',
  legendPlanningTitle: '規劃中',
  legendPlanningBody: '會前往藍圖桌、系統圖牆、掃描台等工位。',
  legendWorkingTitle: '執行中',
  legendWorkingBody: '顯示工具氣泡、工作桌與最新動作紀錄。',
  legendIdleTitle: '待命中',
  legendIdleBody: '停在沙發或休息床附近等待下一個任務。',
  legendOfflineTitle: '離線',
  legendOfflineBody: '超過心跳門檻沒有新狀態。',
  roleMain: '主代理',
  roleSubagent: '分身代理',
  roleBranch: '分支工作階段',
  idleFallback: '待命中',
  unknownRoom: '未指定房間',
  secondsAgo: (n) => `${n} 秒前`,
  minutesAgo: (n) => `${n.toFixed(1)} 分鐘前`,
  recentCount: (n) => `最近 ${n} 筆`,
  sessionLabel: (id) => `session: ${id}`,
  rooms: {
    think_lab: { name: '思考室', subtitle: '整理推理 / 規劃' },
    blueprint_lab: { name: '藍圖規劃研究室', subtitle: '計畫 / todo / 架構' },
    file_library: { name: '檔案索引館', subtitle: 'Read / Grep / Glob / LS' },
    code_workbench: { name: '程式編修台', subtitle: 'Edit / Write / patch' },
    terminal_bay: { name: '終端機灣', subtitle: 'Bash / shell / execute' },
    tool_forge: { name: '外部工具中控室', subtitle: 'MCP / browser / GitHub' },
    response_studio: { name: '回覆工坊', subtitle: '撰寫 / 整理輸出' },
    standby_dock: { name: '待命站', subtitle: '空閒 / 等候下一步' },
    clone_bay: { name: '分身工位區', subtitle: 'subagents' },
    session_archive: { name: '工作階段檔案庫', subtitle: 'branch sessions' },
    offline_corner: { name: '離線維護區', subtitle: '等待重新連線' },
  },
  states: {
    idle: '待命中',
    thinking: '思考中',
    planning: '規劃中',
    reading_files: '讀檔 / 搜尋',
    editing_files: '編輯 / 寫檔',
    shell_command: '終端指令',
    browsing: '網頁 / 瀏覽',
    external_tool: '外部工具',
    working: '執行中',
    blocked: '受阻',
    self_healing: '自我修復中',
    awaiting_input: '等待輸入',
    initializing: '初始化中',
    sleeping: '休眠中',
    offline: '離線',
    collaborating: '協作中',
    invoking_skill: '調用技能',
    tool_call: '工具呼叫',
    executing: '執行代碼',
    responding: '整理回覆',
    branch_session: '分支工作階段',
  },
  tools: {
    search_files: '搜尋檔案',
    read_file: '讀取檔案',
    Read: '讀取檔案',
    Grep: '搜尋內容',
    Glob: '搜尋路徑',
    LS: '列出檔案',
    write_file: '寫入檔案',
    Write: '寫入檔案',
    Edit: '編輯檔案',
    MultiEdit: '批次編輯',
    apply_patch: '套用 patch',
    patch: '修改檔案',
    terminal: '終端機操作',
    Bash: 'Bash 指令',
    WebFetch: '抓取網頁',
    WebSearch: '網路搜尋',
    TodoWrite: '更新任務板',
    Task: '派出分身',
    execute_code: '執行程式',
    delegate_task: '派出分身',
    session_search: '搜尋歷史紀錄',
    memory: '寫入記憶',
    todo: '更新任務板',
    browser_navigate: '打開網頁',
    browser_snapshot: '讀取頁面',
    browser_click: '點擊頁面',
    browser_type: '輸入內容',
  },
  decor: {
    northWindow: '北側窗景', blueWindow: '藍圖採光窗', storyWindow: '回覆觀景窗', bookshelf: '書櫃', focusDesk: '靜心書桌', readingDesk: '讀檔書桌', thinkingChair: '沉思椅', ideaLamp: '靈感燈', thoughtBoard: '思路黑板', blueprintTable: '藍圖桌', plannerDesk: '規劃書桌', archiveCabinet: '檔案櫃', scannerConsole: '掃描控制台', systemMap: '系統圖牆', routePoster: '流程海報', blueprintRug: '藍圖地毯', workbench: '工作台', terminalRig: '終端機架', toolChest: '工具箱', partsLocker: '零件櫃', buildServer: '建置伺服器', coffeeMachine: '咖啡機', forgeRug: '鍛造地墊', writingDesk: '寫作桌', replyConsole: '回覆控制台', replyShelf: '回覆書架', calmPlant: '靜心盆栽', briefingChair: '簡報椅', replyPoster: '回覆提示海報', breakSofa: '待命沙發', restBed: '休息床', standbyChair: '待命椅', readyLocker: '裝備櫃', chargePad: '充能座', teaCorner: '茶水角', cloneGate: '分身傳送門', subagentDesk: '分身工作桌', dispatchBoard: '派遣台', missionCrate: '任務箱', cloneServer: '分身節點櫃', handoffPoster: '交接海報', sessionCabinet: '工作階段櫃', sessionViewer: '紀錄終端', recordShelf: '記錄書架', timelineTable: '時間線桌', timelinePoster: '歷程海報', archiveRug: '檔案地毯',
  },
};

const EN_US = {
  brandTitle: 'CLI_Pixelverse',
  brandSubtitle: 'A pixel-world observability UI for CLI tasks, tools, subagents, sessions, and heartbeat telemetry.',
  inspectorTitle: 'Inspector',
  inspectorAgentSelect: 'Select agent',
  inspectorEmpty: 'Click a character to inspect their room, tools, and recent activity.',
  eventBeltTitle: 'Agent Event Timelines',
  noEvents: 'No events yet',
  waitingEvents: 'Waiting for new bridge / Hermes activity…',
  timelineRefreshLabel: 'Timeline refresh',
  syncPending: 'Not synced yet',
  checking: 'Checking',
  readFailed: 'Read failed',
  hermesConnected: 'Hermes connected',
  localOnly: 'Local bridge only',
  worldOverview: 'World Overview',
  connectionLabel: 'Hermes Link',
  agentsVisible: 'Visible Agents',
  subagentsVisible: 'Subagents',
  sessionsVisible: 'Branch Sessions',
  timelineTitle: 'Recent Actions',
  noActions: 'No bridge actions recorded yet',
  currentTask: 'Current Task',
  lastUpdate: 'Last Update',
  roomMeaning: 'Activity Hint',
  eventCount: 'Event Count',
  languageLabel: 'Language',
  exposureLabel: 'Open via',
  exposureModes: { localhost: 'Localhost', tailscale: 'Tailscale', ngrok: 'ngrok' },
  copyUrl: 'Copy URL',
  copyUrlPrompt: 'Copy this URL',
  exposureFailed: 'Exposure update failed',
  mobileMode: 'Mobile Mode',
  desktopMode: 'Desktop Mode',
  mobileModeHint: 'Use a compact sidebar layout for phone screens',
  desktopModeHint: 'Restore the desktop dashboard layout',
  dashboardPanels: 'Operations Sidebar',
  dashboardEvents: 'Events',
  dashboardAgents: 'Agents',
  dashboardHelp: 'Help',
  dashboardPrevious: 'Previous',
  dashboardNext: 'Next',
  dashboardPage: (page, count) => `Page ${page} of ${count}`,
  dashboardGuideTitle: 'Map workspace help',
  diagnosticsLabel: 'Diagnostics',
  diagnosticsExplanation: 'Diagnostics explains agent state colors and Hook routing so you can verify how live activity maps to rooms and connection health.',
  showPanels: 'Open Panels',
  hidePanels: 'Hide Panels',
  closePanels: 'Close',
  heartbeatMissing: 'No agent heartbeat yet',
  heartbeatWaiting: 'Waiting for agent attach',
  heartbeatLive: (age) => `Heartbeat live · ${age}`,
  heartbeatStale: (age) => `Heartbeat stale · ${age}`,
  uiStatusHealthy: 'UI status normal',
  uiStatusWaiting: 'UI normal · waiting for agent attach',
  uiStatusStale: 'UI normal · agent heartbeat stale',
  uiStatusMissing: 'UI normal · no agent heartbeat yet',
  deleteOfflineAgent: 'Delete',
  deleteOfflineAgentConfirm: (agent) => `Delete offline agent "${agent}"?`,
  deleteOfflineAgentFailed: 'Unable to delete offline agent',
  editFurniture: 'Move Furniture',
  saveLayout: 'Save Layout',
  cancelLayout: 'Cancel Edit',
  layoutEditing: 'Furniture Edit Mode',
  layoutEditingHint: 'Drag props to fine-tune placement. Press Esc to cancel, then save to apply the new pathfinding map immediately.',
  layoutSelectedHint: 'Prop selected. Drag it freely, or nudge with arrow keys; hold Shift for bigger steps.',
  layoutDragActiveHint: 'Dragging now: release to drop. Agents will reroute around the latest obstacles right away.',
  layoutNoChanges: 'No unsaved layout changes',
  layoutUnsavedChanges: 'Unsaved layout changes',
  layoutChangesCount: (n) => `${n} unsaved prop changes`,
  layoutPickHint: 'Pick a prop and drag it inside the room',
  layoutKeyboardHint: 'Arrow keys nudge · Shift speeds up · Enter saves · Esc cancels',
  layoutDragSurfaceHint: 'Drag props across rooms; click empty space to clear selection',
  layoutGridHint: 'Grid snap 0.5% · hold Shift for 1.0%',
  layoutCoordTitle: 'Live Coordinates',
  layoutScaleDown: 'Scale furniture down',
  layoutScaleUp: 'Scale furniture up',
  layoutCoordChip: (x, y) => `x ${x}% · y ${y}%`,
  layoutSnapChip: (snap) => `snap ${snap}%`,
  layoutGuideBadge: (label, x, y, snap) => `${label} · x ${x}% · y ${y}% · snap ${snap}%`,
  layoutSaving: 'Saving…',
  layoutSaved: 'Furniture layout saved',
  layoutSavedDetail: (changes, rooms) => `Saved ${changes} prop changes across ${rooms} rooms`,
  layoutSaveFailed: 'Failed to save layout',
  layoutCollisionTitle: 'Furniture cannot overlap',
  layoutCollisionDetail: 'Move the prop to a clear position before dropping it.',
  layoutReset: 'Edit cancelled and reverted to the last saved layout',
  layoutExitConfirm: 'There are unsaved layout changes. Discard this furniture edit session?',
  eventGraphSummary: (n) => `${n} agent timelines`,
  activeNow: 'Active now',
  blockedFor: 'Stayed here',
  latestEvent: 'Latest event',
  timelineWindow: 'Last 20 min',
  eventLaneHint: 'x = recent time, y = event category',
  eventCategories: {
    reasoning: 'Reasoning',
    tool: 'Tool',
    subagent: 'Subagent',
    session: 'Session',
    status: 'Status',
    message: 'Message',
    completion: 'Done',
  },
  coreWing: 'CORE WING',
  cloneWing: 'CLONE WING',
  summaryConnected: 'The main agent walks through hallways toward room workstations; clones and branch sessions occupy the right office wing.',
  summaryDisconnected: 'Bridge heartbeats and local events still render. Start Hermes web/gateway for richer telemetry.',
  lastSyncPrefix: 'Last sync',
  worldLegend: 'Legend',
  hookStateTitle: 'Hook State Routing',
  hookStateHook: 'Hook',
  hookStateState: 'State',
  hookStateRoom: 'Room',
  legendThinkingTitle: 'Thinking',
  legendThinkingBody: 'Henry moves into the thinking room and loops around its desk cluster.',
  legendPlanningTitle: 'Planning',
  legendPlanningBody: 'Heads toward the blueprint table, wall map, or scanner console.',
  legendWorkingTitle: 'Working',
  legendWorkingBody: 'Tool bubbles, work props, and fresh actions stay visible.',
  legendIdleTitle: 'Idle',
  legendIdleBody: 'Returns near the sofa or rest bed while waiting.',
  legendOfflineTitle: 'Offline',
  legendOfflineBody: 'No fresh heartbeat past the staleness threshold.',
  roleMain: 'Main Agent',
  roleSubagent: 'Subagent',
  roleBranch: 'Branch Session',
  idleFallback: 'Idle',
  unknownRoom: 'Unassigned Room',
  secondsAgo: (n) => `${n}s ago`,
  minutesAgo: (n) => `${n.toFixed(1)}m ago`,
  recentCount: (n) => `${n} recent`,
  sessionLabel: (id) => `session: ${id}`,
  rooms: {
    think_lab: { name: 'Thinking Room', subtitle: 'reasoning / planning' },
    blueprint_lab: { name: 'Blueprint Lab', subtitle: 'plan / todo / architecture' },
    file_library: { name: 'File Library', subtitle: 'Read / Grep / Glob / LS' },
    code_workbench: { name: 'Code Workbench', subtitle: 'Edit / Write / patch' },
    terminal_bay: { name: 'Terminal Bay', subtitle: 'Bash / shell / execute' },
    tool_forge: { name: 'External Tool Hub', subtitle: 'MCP / browser / GitHub' },
    response_studio: { name: 'Reply Studio', subtitle: 'draft / refine output' },
    standby_dock: { name: 'Standby Dock', subtitle: 'idle / awaiting next step' },
    clone_bay: { name: 'Clone Bay', subtitle: 'subagents' },
    session_archive: { name: 'Session Archive', subtitle: 'branch sessions' },
    offline_corner: { name: 'Offline Corner', subtitle: 'waiting to reconnect' },
  },
  states: {
    idle: 'Idle',
    thinking: 'Thinking',
    planning: 'Planning',
    reading_files: 'Reading Files',
    editing_files: 'Editing Files',
    shell_command: 'Shell Command',
    browsing: 'Web / Browser',
    external_tool: 'External Tool',
    working: 'Working',
    blocked: 'Blocked',
    self_healing: 'Self-healing',
    awaiting_input: 'Awaiting Input',
    initializing: 'Initializing',
    sleeping: 'Sleeping',
    offline: 'Offline',
    collaborating: 'Collaborating',
    invoking_skill: 'Invoking Skill',
    tool_call: 'Tool Call',
    executing: 'Executing',
    responding: 'Responding',
    branch_session: 'Branch Session',
  },
  tools: {
    search_files: 'Search Files', read_file: 'Read File', Read: 'Read File', Grep: 'Search Content', Glob: 'Search Paths', LS: 'List Files', write_file: 'Write File', Write: 'Write File', Edit: 'Edit File', MultiEdit: 'Batch Edit', apply_patch: 'Apply Patch', patch: 'Patch File', terminal: 'Terminal', Bash: 'Bash Command', WebFetch: 'Fetch Web Page', WebSearch: 'Web Search', TodoWrite: 'Update Task Board', Task: 'Dispatch Clone', execute_code: 'Run Code', delegate_task: 'Dispatch Clone', session_search: 'Search Session Memory', memory: 'Write Memory', todo: 'Update Task Board', browser_navigate: 'Open Page', browser_snapshot: 'Read Page', browser_click: 'Click Page', browser_type: 'Type Input',
  },
  decor: {
    northWindow: 'North Window', blueWindow: 'Blueprint Window', storyWindow: 'Story Window', bookshelf: 'Bookshelf', focusDesk: 'Focus Desk', readingDesk: 'Reading Desk', thinkingChair: 'Thinking Chair', ideaLamp: 'Idea Lamp', thoughtBoard: 'Thought Board', blueprintTable: 'Blueprint Table', plannerDesk: 'Planner Desk', archiveCabinet: 'Archive Cabinet', scannerConsole: 'Scanner Console', systemMap: 'System Map', routePoster: 'Route Poster', blueprintRug: 'Blueprint Rug', workbench: 'Workbench', terminalRig: 'Terminal Rig', toolChest: 'Tool Chest', partsLocker: 'Parts Locker', buildServer: 'Build Server', coffeeMachine: 'Coffee Machine', forgeRug: 'Forge Rug', writingDesk: 'Writing Desk', replyConsole: 'Reply Console', replyShelf: 'Reply Shelf', calmPlant: 'Calm Plant', briefingChair: 'Briefing Chair', replyPoster: 'Reply Poster', breakSofa: 'Break Sofa', restBed: 'Rest Bed', standbyChair: 'Standby Chair', readyLocker: 'Ready Locker', chargePad: 'Charge Pad', teaCorner: 'Tea Corner', cloneGate: 'Clone Gate', subagentDesk: 'Subagent Desk', dispatchBoard: 'Dispatch Board', missionCrate: 'Mission Crate', cloneServer: 'Clone Server Rack', handoffPoster: 'Handoff Poster', sessionCabinet: 'Session Cabinet', sessionViewer: 'Session Viewer', recordShelf: 'Record Shelf', timelineTable: 'Timeline Table', timelinePoster: 'Timeline Poster', archiveRug: 'Archive Rug',
  },
};

const JA_JP = {
  ...EN_US,
  brandSubtitle: 'CLI のタスク、ツール、サブエージェント、セッション、ハートビートをピクセル世界で可視化します。',
  inspectorTitle: 'インスペクター',
  inspectorAgentSelect: 'エージェントを選択',
  inspectorEmpty: 'キャラクターをクリックすると、部屋、ツール、直近の動作を確認できます。',
  eventBeltTitle: 'エージェント時間イベント図',
  noEvents: 'まだイベントはありません',
  waitingEvents: '新しい bridge / Hermes イベントを待機中…',
  timelineRefreshLabel: '更新頻度',
  syncPending: '未同期',
  checking: '確認中',
  readFailed: '読込失敗',
  hermesConnected: 'Hermes 接続済み',
  localOnly: 'ローカル bridge のみ',
  worldOverview: 'ワールド概要',
  connectionLabel: 'Hermes 接続',
  agentsVisible: '表示中のエージェント',
  subagentsVisible: 'サブエージェント',
  sessionsVisible: '分岐セッション',
  timelineTitle: '直近の動作',
  noActions: 'bridge の動作記録はまだありません',
  currentTask: '現在のタスク',
  lastUpdate: '最終更新',
  roomMeaning: '活動ヒント',
  eventCount: 'イベント数',
  languageLabel: '言語',
  exposureLabel: '公開方法',
  copyUrl: 'URL をコピー',
  copyUrlPrompt: 'この URL をコピー',
  exposureFailed: '公開 URL の更新に失敗しました',
  mobileMode: 'モバイル',
  desktopMode: 'デスクトップ',
  mobileModeHint: 'スマートフォン向けのサイドバー表示に切り替えます',
  desktopModeHint: 'デスクトップ向けのダッシュボード表示に戻します',
  dashboardPanels: '状況サイドバー',
  dashboardEvents: 'イベント',
  dashboardAgents: 'エージェント',
  dashboardHelp: 'ヘルプ',
  dashboardPrevious: '前へ',
  dashboardNext: '次へ',
  dashboardPage: (page, count) => `${page} / ${count} ページ`,
  dashboardGuideTitle: 'マップワークスペースのヘルプ',
  diagnosticsLabel: '診断',
  diagnosticsExplanation: '診断パネルでは、エージェント状態の色と Hook ルーティングを確認し、ライブ活動と部屋・接続状態の対応を検証できます。',
  showPanels: 'パネル表示',
  hidePanels: 'パネル非表示',
  closePanels: '閉じる',
  heartbeatMissing: 'agent heartbeat はまだありません',
  heartbeatWaiting: 'agent 接続を待機中',
  heartbeatLive: (age) => `Heartbeat 正常 · ${age}`,
  heartbeatStale: (age) => `Heartbeat 切断 · ${age}`,
  uiStatusHealthy: 'UI 状態は正常です',
  uiStatusWaiting: 'UI 正常 · agent 接続待ち',
  uiStatusStale: 'UI 正常 · agent heartbeat 切断',
  uiStatusMissing: 'UI 正常 · agent heartbeat 未受信',
  deleteOfflineAgent: '削除',
  deleteOfflineAgentConfirm: (agent) => `オフライン agent「${agent}」を削除しますか？`,
  deleteOfflineAgentFailed: 'オフライン agent を削除できません',
  editFurniture: '家具を移動',
  saveLayout: 'レイアウト保存',
  cancelLayout: '編集を取消',
  layoutEditing: '家具編集モード',
  layoutEditingHint: '家具をドラッグして微調整できます。Esc で取り消し、保存すると経路探索にすぐ反映されます。',
  layoutSelectedHint: '家具を選択しました。ドラッグでも、方向キーでの微調整でも動かせます。Shift で歩幅が大きくなります。',
  layoutDragActiveHint: 'ドラッグ中です。離すとその位置に配置され、エージェントは最新の障害物に合わせて再経路化します。',
  layoutNoChanges: '未保存の変更はありません',
  layoutUnsavedChanges: '未保存の変更があります',
  layoutChangesCount: (n) => `未保存の変更 ${n} 件`,
  layoutPickHint: '家具を選んで、そのまま室内でドラッグしてください',
  layoutKeyboardHint: '方向キーで微調整 · Shift で加速 · Enter で保存 · Esc で取消',
  layoutDragSurfaceHint: '家具は別の部屋にも移動できます。空白をクリックすると選択解除します。',
  layoutGridHint: 'グリッド吸着 0.5% · Shift を押すと 1.0%',
  layoutCoordTitle: 'リアルタイム座標',
  layoutScaleDown: '家具を縮小',
  layoutScaleUp: '家具を拡大',
  layoutCoordChip: (x, y) => `x ${x}% · y ${y}%`,
  layoutSnapChip: (snap) => `吸着 ${snap}%`,
  layoutGuideBadge: (label, x, y, snap) => `${label} · x ${x}% · y ${y}% · 吸着 ${snap}%`,
  layoutSaving: '保存中…',
  layoutSaved: '家具配置を保存しました',
  layoutSavedDetail: (changes, rooms) => `${rooms} 部屋で ${changes} 件の家具変更を保存しました`,
  layoutSaveFailed: 'レイアウト保存に失敗しました',
  layoutCollisionTitle: '家具は重ねられません',
  layoutCollisionDetail: '空いている位置へ家具を移動してください。',
  layoutReset: '編集を取り消し、最後に保存した配置へ戻しました',
  layoutExitConfirm: '未保存のレイアウト変更があります。この家具編集を破棄しますか？',
  eventGraphSummary: (n) => `${n} 本のタイムライン`,
  activeNow: '現在アクティブ',
  blockedFor: '滞在時間',
  latestEvent: '最新イベント',
  timelineWindow: '直近 20 分',
  eventLaneHint: 'x 軸 = 直近時間、y 軸 = イベント種別',
  eventCategories: {
    reasoning: '推論', tool: 'ツール', subagent: 'サブ', session: 'セッション', status: '状態', message: 'メッセージ', completion: '完了',
  },
  coreWing: 'コア区画',
  cloneWing: 'クローン区画',
  summaryConnected: 'メインエージェントは廊下を歩いて各作業室に移動し、クローンと分岐セッションは右側の区画に配置されます。',
  summaryDisconnected: 'bridge の heartbeat とローカルイベントは表示されます。より豊富な情報には Hermes web/gateway を起動してください。',
  lastSyncPrefix: '最終同期',
  worldLegend: '凡例',
  hookStateTitle: 'Hook 状態ルーティング',
  hookStateHook: 'Hook',
  hookStateState: '状態',
  hookStateRoom: '部屋',
  legendThinkingTitle: '思考中',
  legendThinkingBody: 'Henry は思考室に入り、机の周囲を巡回します。',
  legendPlanningTitle: '計画中',
  legendPlanningBody: '設計テーブル、壁面マップ、スキャナ台へ向かいます。',
  legendWorkingTitle: '実行中',
  legendWorkingBody: 'ツール吹き出し、作業家具、最新アクションを表示します。',
  legendIdleTitle: '待機中',
  legendIdleBody: 'ソファやベッド付近で次のタスクを待ちます。',
  legendOfflineTitle: 'オフライン',
  legendOfflineBody: '心拍期限を超えて新しい状態がありません。',
  roleMain: 'メインエージェント',
  roleSubagent: 'サブエージェント',
  roleBranch: '分岐セッション',
  idleFallback: '待機中',
  unknownRoom: '未割当の部屋',
  secondsAgo: (n) => `${n} 秒前`,
  minutesAgo: (n) => `${n.toFixed(1)} 分前`,
  recentCount: (n) => `直近 ${n} 件`,
  rooms: {
    think_lab: { name: '思考室', subtitle: '推論 / 計画' },
    blueprint_lab: { name: '設計ラボ', subtitle: '計画 / todo / 構成' },
    file_library: { name: 'ファイル索引庫', subtitle: 'Read / Grep / Glob / LS' },
    code_workbench: { name: 'コード作業台', subtitle: 'Edit / Write / patch' },
    terminal_bay: { name: 'ターミナルベイ', subtitle: 'Bash / shell / execute' },
    tool_forge: { name: '外部ツールハブ', subtitle: 'MCP / browser / GitHub' },
    response_studio: { name: '応答スタジオ', subtitle: '下書き / 整理' },
    standby_dock: { name: '待機ドック', subtitle: '待機 / 次の指示待ち' },
    clone_bay: { name: 'クローンベイ', subtitle: 'subagents' },
    session_archive: { name: 'セッション保管庫', subtitle: 'branch sessions' },
    offline_corner: { name: 'オフライン区画', subtitle: '再接続待ち' },
  },
  states: { idle: '待機', thinking: '思考中', planning: '計画中', reading_files: '読取 / 検索', editing_files: '編集 / 書込', shell_command: 'シェル実行', browsing: 'Web / ブラウザ', external_tool: '外部ツール', working: '実行中', blocked: 'ブロック中', self_healing: '自己修復中', awaiting_input: '入力待ち', initializing: '初期化中', sleeping: 'スリープ中', offline: 'オフライン', collaborating: '協調中', invoking_skill: 'スキル呼出', tool_call: 'ツール呼出', executing: '実行中', responding: '応答整理中', branch_session: '分岐セッション' },
};

const KO_KR = {
  ...EN_US,
  brandSubtitle: 'CLI 작업, 도구, 서브에이전트, 세션, 하트비트를 픽셀 월드로 시각화합니다.',
  inspectorTitle: '인스펙터',
  inspectorAgentSelect: '에이전트 선택',
  inspectorEmpty: '캐릭터를 클릭하면 방, 도구, 최근 활동을 확인할 수 있습니다.',
  eventBeltTitle: '에이전트 시간 이벤트 그래프',
  noEvents: '아직 이벤트가 없습니다',
  waitingEvents: '새 bridge / Hermes 이벤트를 기다리는 중…',
  timelineRefreshLabel: '갱신 주기',
  syncPending: '아직 동기화되지 않음',
  checking: '확인 중',
  readFailed: '읽기 실패',
  hermesConnected: 'Hermes 연결됨',
  localOnly: '로컬 bridge만 연결',
  worldOverview: '월드 개요',
  connectionLabel: 'Hermes 연결',
  agentsVisible: '표시 중 에이전트',
  subagentsVisible: '서브에이전트',
  sessionsVisible: '브랜치 세션',
  timelineTitle: '최근 동작',
  noActions: '아직 bridge 동작 기록이 없습니다',
  currentTask: '현재 작업',
  lastUpdate: '최근 업데이트',
  roomMeaning: '활동 힌트',
  eventCount: '이벤트 수',
  languageLabel: '언어',
  exposureLabel: '공개 방식',
  copyUrl: 'URL 복사',
  copyUrlPrompt: '이 URL을 복사하세요',
  exposureFailed: '공개 URL 업데이트 실패',
  mobileMode: '모바일 모드',
  desktopMode: '데스크톱 모드',
  mobileModeHint: '휴대폰용 사이드바 레이아웃으로 전환합니다',
  desktopModeHint: '데스크톱 대시보드 레이아웃으로 돌아갑니다',
  dashboardPanels: '상황 사이드바',
  dashboardEvents: '이벤트',
  dashboardAgents: '에이전트',
  dashboardHelp: '도움말',
  dashboardPrevious: '이전',
  dashboardNext: '다음',
  dashboardPage: (page, count) => `${page} / ${count} 페이지`,
  dashboardGuideTitle: '맵 작업 공간 도움말',
  diagnosticsLabel: '진단',
  diagnosticsExplanation: '진단 패널은 에이전트 상태 색상과 Hook 라우팅을 설명하여 실시간 활동이 방과 연결 상태에 어떻게 매핑되는지 확인할 수 있게 합니다.',
  showPanels: '패널 열기',
  hidePanels: '패널 숨기기',
  closePanels: '닫기',
  heartbeatMissing: 'agent heartbeat가 아직 없습니다',
  heartbeatWaiting: 'agent 연결 대기 중',
  heartbeatLive: (age) => `Heartbeat 정상 · ${age}`,
  heartbeatStale: (age) => `Heartbeat 끊김 · ${age}`,
  uiStatusHealthy: 'UI 상태 정상',
  uiStatusWaiting: 'UI 정상 · agent 연결 대기',
  uiStatusStale: 'UI 정상 · agent heartbeat 끊김',
  uiStatusMissing: 'UI 정상 · agent heartbeat 없음',
  deleteOfflineAgent: '삭제',
  deleteOfflineAgentConfirm: (agent) => `오프라인 agent "${agent}"을 삭제할까요?`,
  deleteOfflineAgentFailed: '오프라인 agent를 삭제할 수 없습니다',
  editFurniture: '가구 이동',
  saveLayout: '레이아웃 저장',
  cancelLayout: '편집 취소',
  layoutEditing: '가구 편집 모드',
  layoutEditingHint: '가구를 드래그해 세밀하게 조정하세요. Esc로 취소할 수 있고, 저장하면 경로 탐색에 즉시 반영됩니다.',
  layoutSelectedHint: '가구가 선택되었습니다. 드래그하거나 방향키로 미세 조정할 수 있고, Shift를 누르면 더 크게 이동합니다.',
  layoutDragActiveHint: '드래그 중입니다. 놓으면 그 위치에 배치되고, 에이전트는 최신 장애물을 기준으로 즉시 재경로화합니다.',
  layoutNoChanges: '저장되지 않은 변경이 없습니다',
  layoutUnsavedChanges: '저장되지 않은 변경이 있습니다',
  layoutChangesCount: (n) => `저장되지 않은 변경 ${n}개`,
  layoutPickHint: '가구를 집어서 방 안에서 바로 드래그하세요',
  layoutKeyboardHint: '방향키 미세 조정 · Shift 가속 · Enter 저장 · Esc 취소',
  layoutDragSurfaceHint: '가구를 다른 방으로 옮길 수 있으며, 빈 공간을 클릭하면 선택이 해제됩니다.',
  layoutGridHint: '그리드 스냅 0.5% · Shift를 누르면 1.0%',
  layoutCoordTitle: '실시간 좌표',
  layoutScaleDown: '가구 축소',
  layoutScaleUp: '가구 확대',
  layoutCoordChip: (x, y) => `x ${x}% · y ${y}%`,
  layoutSnapChip: (snap) => `스냅 ${snap}%`,
  layoutGuideBadge: (label, x, y, snap) => `${label} · x ${x}% · y ${y}% · 스냅 ${snap}%`,
  layoutSaving: '저장 중…',
  layoutSaved: '가구 배치를 저장했습니다',
  layoutSavedDetail: (changes, rooms) => `${rooms}개 방에서 가구 변경 ${changes}개를 저장했습니다`,
  layoutSaveFailed: '레이아웃 저장 실패',
  layoutCollisionTitle: '가구는 겹칠 수 없습니다',
  layoutCollisionDetail: '가구를 비어 있는 위치로 옮겨 주세요.',
  layoutReset: '편집을 취소하고 마지막 저장 상태로 되돌렸습니다',
  layoutExitConfirm: '저장되지 않은 레이아웃 변경이 있습니다. 이번 가구 편집을 버릴까요?',
  eventGraphSummary: (n) => `${n}개 에이전트 타임라인`,
  activeNow: '현재 활성',
  blockedFor: '머문 시간',
  latestEvent: '최신 이벤트',
  timelineWindow: '최근 20분',
  eventLaneHint: 'x축 = 최근 시간, y축 = 이벤트 카테고리',
  eventCategories: {
    reasoning: '추론', tool: '도구', subagent: '서브', session: '세션', status: '상태', message: '메시지', completion: '완료',
  },
  coreWing: '코어 구역',
  cloneWing: '클론 구역',
  summaryConnected: '메인 에이전트는 복도를 따라 각 작업실로 이동하고, 클론과 브랜치 세션은 오른쪽 사무 구역에 머뭅니다.',
  summaryDisconnected: 'bridge heartbeat와 로컬 이벤트는 계속 보입니다. 더 풍부한 정보가 필요하면 Hermes web/gateway를 함께 실행하세요.',
  lastSyncPrefix: '마지막 동기화',
  worldLegend: '범례',
  hookStateTitle: 'Hook 상태 라우팅',
  hookStateHook: 'Hook',
  hookStateState: '상태',
  hookStateRoom: '방',
  legendThinkingTitle: '생각 중',
  legendThinkingBody: 'Henry는 생각 방으로 들어가 책상 주변을 순회합니다.',
  legendPlanningTitle: '계획 중',
  legendPlanningBody: '설계 테이블, 벽면 지도, 스캐너 콘솔로 이동합니다.',
  legendWorkingTitle: '작업 중',
  legendWorkingBody: '도구 말풍선, 작업 가구, 최신 액션이 보입니다.',
  legendIdleTitle: '대기 중',
  legendIdleBody: '소파나 침대 근처에서 다음 작업을 기다립니다.',
  legendOfflineTitle: '오프라인',
  legendOfflineBody: 'heartbeat 임계 시간을 넘겨 새 상태가 없습니다.',
  roleMain: '메인 에이전트',
  roleSubagent: '서브에이전트',
  roleBranch: '브랜치 세션',
  idleFallback: '대기 중',
  unknownRoom: '미지정 방',
  secondsAgo: (n) => `${n}초 전`,
  minutesAgo: (n) => `${n.toFixed(1)}분 전`,
  recentCount: (n) => `최근 ${n}건`,
  rooms: {
    think_lab: { name: '사고실', subtitle: '추론 / 계획' },
    blueprint_lab: { name: '블루프린트 랩', subtitle: '계획 / todo / 구조' },
    file_library: { name: '파일 인덱스실', subtitle: 'Read / Grep / Glob / LS' },
    code_workbench: { name: '코드 작업대', subtitle: 'Edit / Write / patch' },
    terminal_bay: { name: '터미널 베이', subtitle: 'Bash / shell / execute' },
    tool_forge: { name: '외부 도구 허브', subtitle: 'MCP / browser / GitHub' },
    response_studio: { name: '응답 스튜디오', subtitle: '작성 / 정리' },
    standby_dock: { name: '대기 도크', subtitle: '대기 / 다음 지시 대기' },
    clone_bay: { name: '클론 베이', subtitle: 'subagents' },
    session_archive: { name: '세션 아카이브', subtitle: 'branch sessions' },
    offline_corner: { name: '오프라인 구역', subtitle: '재연결 대기' },
  },
  states: { idle: '대기', thinking: '생각 중', planning: '계획 중', reading_files: '파일 읽기 / 검색', editing_files: '편집 / 쓰기', shell_command: '셸 명령', browsing: '웹 / 브라우저', external_tool: '외부 도구', working: '작업 중', blocked: '차단됨', self_healing: '자가 복구 중', awaiting_input: '입력 대기', initializing: '초기화 중', sleeping: '절전 중', offline: '오프라인', collaborating: '협업 중', invoking_skill: '스킬 호출', tool_call: '도구 호출', executing: '코드 실행', responding: '응답 정리', branch_session: '브랜치 세션' },
};

const LOCALE_STRINGS = {
  'zh-TW': ZH_TW,
  'en-US': EN_US,
  'ja-JP': JA_JP,
  'ko-KR': KO_KR,
};

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : 'en-US';
}

export function getLocaleStrings(locale = 'en-US') {
  return LOCALE_STRINGS[normalizeLocale(locale)];
}

export function getLocaleLabel(locale = 'en-US') {
  return LOCALE_LABELS[normalizeLocale(locale)] || LOCALE_LABELS['en-US'];
}

export function getRoomCopy(roomKey, locale = 'zh-TW') {
  return getLocaleStrings(locale).rooms[roomKey] || {
    name: getLocaleStrings(locale).unknownRoom,
    subtitle: '',
  };
}

export function getRoomDecor(roomKey, locale = 'zh-TW') {
  const strings = getLocaleStrings(locale);
  return (ROOM_DECOR[roomKey] || []).map((item) => ({
    ...item,
    label: strings.decor[item.labelKey] || item.labelKey,
  }));
}

export function summarizeWorld(stats = {}, locale = 'zh-TW') {
  const strings = getLocaleStrings(locale);
  return stats.hermes_connected ? strings.summaryConnected : strings.summaryDisconnected;
}

export function localizeToolSummary(task, locale = 'zh-TW') {
  if (!task) return '';
  const normalized = normalizeLocale(locale);
  const strings = getLocaleStrings(normalized);
  const parts = String(task).split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return String(task);
  const translated = parts.map((part) => strings.tools?.[part] || part);
  const joiner = normalized === 'zh-TW' || normalized === 'ja-JP' || normalized === 'ko-KR' ? '、' : ', ';
  return translated.join(joiner);
}

const EVENT_TITLES = {
  'zh-TW': {
    heartbeat: '主代理心跳同步', action: '世界動作更新',
    'main.task.started': '主代理開始處理任務', 'main.reasoning': '主代理正在規劃',
    'main.tool.batch': '主代理切換到工具序列', 'main.tool.started': '主代理工具啟動',
    'main.tool.completed': '主代理工具完成', 'main.task.completed': '主代理任務完成',
    'hermes.status': 'Hermes 狀態同步', 'hermes.subagent': '分身狀態更新',
    'hermes.subagent.event': '分身事件', 'hermes.session': 'Hermes 工作階段',
    'webhook.registered': 'Webhook 已註冊', 'webhook.removed': 'Webhook 已移除',
  },
  'en-US': {
    heartbeat: 'Main heartbeat', action: 'World action',
    'main.task.started': 'Main task started', 'main.reasoning': 'Main agent reasoning',
    'main.tool.batch': 'Main tool route', 'main.tool.started': 'Main tool started',
    'main.tool.completed': 'Main tool completed', 'main.task.completed': 'Main task completed',
    'hermes.status': 'Hermes status', 'hermes.subagent': 'Subagent update',
    'hermes.subagent.event': 'Subagent event', 'hermes.session': 'Hermes session',
    'webhook.registered': 'Webhook registered', 'webhook.removed': 'Webhook removed',
  },
  'ja-JP': {
    heartbeat: 'メインエージェントのハートビート', action: 'ワールド動作の更新',
    'main.task.started': 'メインタスクを開始', 'main.reasoning': 'メインエージェントが推論中',
    'main.tool.batch': 'ツール経路を切替', 'main.tool.started': 'ツールを開始',
    'main.tool.completed': 'ツールを完了', 'main.task.completed': 'メインタスクを完了',
    'hermes.status': 'Hermes 状態', 'hermes.subagent': 'サブエージェントの更新',
    'hermes.subagent.event': 'サブエージェントのイベント', 'hermes.session': 'Hermes セッション',
    'webhook.registered': 'Webhook を登録', 'webhook.removed': 'Webhook を削除',
  },
  'ko-KR': {
    heartbeat: '메인 에이전트 하트비트', action: '월드 동작 업데이트',
    'main.task.started': '메인 작업 시작', 'main.reasoning': '메인 에이전트 추론 중',
    'main.tool.batch': '도구 경로 전환', 'main.tool.started': '도구 시작',
    'main.tool.completed': '도구 완료', 'main.task.completed': '메인 작업 완료',
    'hermes.status': 'Hermes 상태', 'hermes.subagent': '서브에이전트 업데이트',
    'hermes.subagent.event': '서브에이전트 이벤트', 'hermes.session': 'Hermes 세션',
    'webhook.registered': 'Webhook 등록', 'webhook.removed': 'Webhook 제거',
  },
};

const EVENT_SUMMARY_COPY = {
  'zh-TW': {
    taskStarted: '任務已開始', reasoning: '正在整理思路', started: '開始使用', finished: '完成',
    tool: '工具', route: '工具序列', taskCompleted: '任務已完成，回到待命站', toolStep: '工具步驟',
    thinking: '思考', status: '狀態', actionUpdate: '動作已更新', gateway: '閘道', activeSessions: '活躍工作階段',
    subagent: '分身', noTool: '沒有工具', session: '工作階段', active: '進行中', recent: '近期', registered: '已註冊', removed: '已移除',
  },
  'en-US': {
    taskStarted: 'Task started', reasoning: 'Reasoning', started: 'Started', finished: 'Finished',
    tool: 'tool', route: 'Tool route', taskCompleted: 'Returned to standby', toolStep: 'Tool step',
    thinking: 'Thinking', status: 'Status', actionUpdate: 'Action update', gateway: 'Gateway', activeSessions: 'active sessions',
    subagent: 'Subagent', noTool: 'No tool', session: 'session', active: 'active', recent: 'recent', registered: 'registered', removed: 'removed',
  },
  'ja-JP': {
    taskStarted: 'タスクを開始しました', reasoning: '考えを整理中', started: '開始', finished: '完了',
    tool: 'ツール', route: 'ツール経路', taskCompleted: 'タスクを完了し、待機場所へ戻りました', toolStep: 'ツール手順',
    thinking: '思考', status: '状態', actionUpdate: '動作を更新しました', gateway: 'ゲートウェイ', activeSessions: '稼働中のセッション',
    subagent: 'サブエージェント', noTool: 'ツールなし', session: 'セッション', active: '稼働中', recent: '直近', registered: '登録済み', removed: '削除済み',
  },
  'ko-KR': {
    taskStarted: '작업을 시작했습니다', reasoning: '생각을 정리하는 중', started: '시작', finished: '완료',
    tool: '도구', route: '도구 경로', taskCompleted: '작업을 완료하고 대기 위치로 돌아갔습니다', toolStep: '도구 단계',
    thinking: '생각', status: '상태', actionUpdate: '동작을 업데이트했습니다', gateway: '게이트웨이', activeSessions: '활성 세션',
    subagent: '서브에이전트', noTool: '도구 없음', session: '세션', active: '활성', recent: '최근', registered: '등록됨', removed: '제거됨',
  },
};

const EVENT_TOOL_NAMES = {
  'ja-JP': {
    search_files: 'ファイル検索', read_file: 'ファイル読取', Read: 'ファイル読取', Grep: '内容検索', Glob: 'パス検索', LS: '一覧表示',
    write_file: 'ファイル書込', Write: 'ファイル書込', Edit: 'ファイル編集', MultiEdit: '一括編集', apply_patch: 'パッチ適用', patch: 'パッチ適用',
    terminal: 'ターミナル', Bash: 'シェル実行', WebFetch: 'Web ページ取得', WebSearch: 'Web 検索', TodoWrite: 'タスクボード更新',
    Task: 'サブエージェント派遣', execute_code: 'コード実行', delegate_task: 'サブエージェント派遣', session_search: 'セッション検索',
    memory: 'メモリ書込', todo: 'タスクボード更新', browser_navigate: 'ページを開く', browser_snapshot: 'ページ読取', browser_click: 'クリック', browser_type: '入力',
  },
  'ko-KR': {
    search_files: '파일 검색', read_file: '파일 읽기', Read: '파일 읽기', Grep: '내용 검색', Glob: '경로 검색', LS: '목록 보기',
    write_file: '파일 쓰기', Write: '파일 쓰기', Edit: '파일 편집', MultiEdit: '일괄 편집', apply_patch: '패치 적용', patch: '패치 적용',
    terminal: '터미널', Bash: '셸 실행', WebFetch: '웹 페이지 가져오기', WebSearch: '웹 검색', TodoWrite: '작업 보드 업데이트',
    Task: '서브에이전트 파견', execute_code: '코드 실행', delegate_task: '서브에이전트 파견', session_search: '세션 검색',
    memory: '메모리 쓰기', todo: '작업 보드 업데이트', browser_navigate: '페이지 열기', browser_snapshot: '페이지 읽기', browser_click: '클릭', browser_type: '입력',
  },
};

const shortEventText = (value, limit) => {
  const text = String(value || '').trim();
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`;
};

export function eventTitleForLocale(item = {}, locale = 'en-US') {
  const normalized = normalizeLocale(locale);
  return EVENT_TITLES[normalized][item.kind]
    || item.title
    || item.kind
    || (normalized === 'zh-TW' ? '事件' : normalized === 'ja-JP' ? 'イベント' : normalized === 'ko-KR' ? '이벤트' : 'event');
}

export function eventSummaryForLocale(item = {}, locale = 'en-US') {
  const normalized = normalizeLocale(locale);
  const copy = EVENT_SUMMARY_COPY[normalized];
  const strings = getLocaleStrings(normalized);
  const payload = item.payload || {};
  const action = payload.action || {};
  const localizeEventTool = (value) => {
    const names = EVENT_TOOL_NAMES[normalized] || {};
    const parts = String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return '';
    const separator = normalized === 'en-US' ? ', ' : '、';
    return parts.map((part) => names[part] || getLocaleStrings(normalized).tools?.[part] || part).join(separator);
  };
  const tool = localizeEventTool(action.tool_name) || copy.tool;
  const preview = action.preview || action.message || '';
  const separator = normalized === 'en-US' ? ' | ' : '｜';
  if (item.kind === 'main.task.started') return shortEventText(preview || copy.taskStarted, 54);
  if (item.kind === 'main.reasoning') return shortEventText(preview || copy.reasoning, 54);
  if (item.kind === 'main.tool.started') {
    return `${copy.started} ${tool}${preview ? `${separator}${shortEventText(preview, 36)}` : ''}`;
  }
  if (item.kind === 'main.tool.completed') {
    return `${copy.finished} ${tool}${preview ? `${separator}${shortEventText(preview, 36)}` : ''}`;
  }
  if (item.kind === 'main.tool.batch') {
    return localizeEventTool((action.tool_names || []).join(', '))
      || shortEventText(preview || copy.route, 54);
  }
  if (item.kind === 'main.task.completed') return shortEventText(preview || copy.taskCompleted, 54);
  if (item.kind === 'heartbeat') {
    const state = strings.states?.[payload.state || 'idle'] || payload.state || strings.idleFallback;
    const task = localizeEventTool(payload.task || '') || strings.idleFallback;
    if (normalized === 'ja-JP') return `状態：${state}｜${task}`;
    if (normalized === 'ko-KR') return `상태: ${state}｜${task}`;
    if (normalized === 'zh-TW') return `狀態：${state}｜${task}`;
    return `State: ${state} | ${task}`;
  }
  if (item.kind === 'action') {
    const raw = String(action.message || '').split(/[：:]/).pop().trim();
    if (action.type === 'tool') return `${copy.toolStep}：${localizeEventTool(raw) || shortEventText(raw || copy.tool, 54)}`;
    if (action.type === 'thought') {
      const thought = /^(?:planning|reasoning)$/i.test(raw) ? copy.reasoning : raw;
      return `${copy.thinking}：${shortEventText(thought || copy.reasoning, 54)}`;
    }
    if (action.type === 'status') {
      const stateKey = /^waiting$/i.test(raw) ? 'awaiting_input' : raw;
      return `${copy.status}：${shortEventText(strings.states?.[stateKey] || raw || copy.actionUpdate, 54)}`;
    }
    return shortEventText(raw || copy.actionUpdate, 54);
  }
  if (item.kind === 'hermes.status') {
    const state = normalized === 'ja-JP' && payload.gateway_state === 'connected' ? '接続済み'
      : normalized === 'ko-KR' && payload.gateway_state === 'connected' ? '연결됨'
        : payload.gateway_state || strings.checking;
    return `${copy.gateway}：${state}｜${copy.activeSessions}：${payload.active_sessions || 0}`;
  }
  if (item.kind === 'hermes.subagent') {
    const state = strings.states?.[payload.status === 'running' ? 'working' : payload.status || 'idle']
      || payload.status || strings.idleFallback;
    return `${shortEventText(payload.goal || payload.agent || copy.subagent, 42)}｜${localizeEventTool(payload.current_tool) || copy.noTool}｜${state}`;
  }
  if (item.kind === 'hermes.subagent.event') {
    const detail = shortEventText(payload.text || '', 46);
    return `${shortEventText(payload.goal || payload.agent || copy.subagent, 32)}｜${copy.tool}：${localizeEventTool(payload.tool_name) || copy.tool}${detail ? `｜${detail}` : ''}`;
  }
  if (item.kind === 'hermes.session') {
    return `${shortEventText(payload.title || payload.session_id || copy.session, 42)}｜${payload.active ? copy.active : copy.recent}`;
  }
  if (item.kind === 'webhook.registered') return shortEventText(payload.url || copy.registered, 54);
  if (item.kind === 'webhook.removed') return shortEventText(payload.agent || copy.removed, 54);
  return item.summary || copy.actionUpdate;
}

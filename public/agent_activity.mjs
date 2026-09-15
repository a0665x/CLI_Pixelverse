const COPY={
 'en-US':{working:'Working',reading:'Reading',editing:'Editing files',command:'Running command',mcp:'MCP tool',skill:'Using skill',thinking:'Planning',responding:'Responding',waiting:'Waiting for you',idle:'Idle',offline:'Offline',reconnecting:'Reconnecting',tool:'Using tool',browsing:'Browsing'},
 'zh-TW':{working:'處理工作',reading:'讀取資料',editing:'編輯檔案',command:'執行指令',mcp:'MCP 工具',skill:'使用 Skill',thinking:'規劃中',responding:'回覆中',waiting:'等待你回應',idle:'待命',offline:'離線',reconnecting:'重新連線',tool:'使用工具',browsing:'瀏覽網頁'},
 'ja-JP':{working:'作業中',reading:'読み込み中',editing:'編集中',command:'コマンド実行',mcp:'MCP ツール',skill:'スキル使用',thinking:'計画中',responding:'返信中',waiting:'入力待ち',idle:'待機',offline:'オフライン',reconnecting:'再接続',tool:'ツール使用',browsing:'閲覧中'},
 'ko-KR':{working:'작업 중',reading:'읽는 중',editing:'편집 중',command:'명령 실행',mcp:'MCP 도구',skill:'스킬 사용',thinking:'계획 중',responding:'응답 중',waiting:'입력 대기',idle:'대기',offline:'오프라인',reconnecting:'재연결',tool:'도구 사용',browsing:'탐색 중'},
};
const VISUAL={working:['⚙',.68,.82],reading:['📖',.52,.55],editing:['✎',.85,.75],command:['⌘',.88,.95],mcp:['🔌',1,1],skill:['✨',.94,.9],thinking:['💭',.6,.65],responding:['💬',.9,.8],waiting:['✋',.35,.6],idle:['☕',.18,.18],offline:['○',0,0],reconnecting:['↻',.55,.45],tool:['⚒',1,.9],browsing:['🌐',.65,.65]};
/** Labels reflect reported state/tool names, never inferred from the task prose. */
export function agentActivity(agent={}){
 const state=String(agent.pixelState||agent.pixel_state||agent.state||'idle').toLowerCase();
 const tool=String(agent.toolName||agent.tool_name||agent.tool_label||agent.recent_actions?.[0]?.tool_name||agent.tool||'');
 let kind=({reading_files:'reading',editing_files:'editing',shell_command:'command',external_tool:'mcp',invoking_skill:'skill',thinking:'thinking',planning:'thinking',responding:'responding',browsing:'browsing',blocked:'waiting',awaiting_input:'waiting',tool_call:'tool',executing:'command',idle:'idle',sleeping:'idle',offline:'offline'})[state]||'working';
 if(agent.state==='offline'||agent.is_stale)kind='offline';
 else if(['degraded','reconnecting'].includes(agent.connection_status))kind='reconnecting';
 else if(agent.requires_approval||['blocked','awaiting_input'].includes(agent.state))kind='waiting';
 else if(['idle','resting'].includes(agent.state))kind='idle';
 else if(!['idle','offline','waiting','reconnecting','skill'].includes(kind)&&/^mcp(?:__|[/:.])/i.test(tool))kind='mcp';
 if(!['idle','offline','waiting','reconnecting'].includes(kind)&&agent.recent_actions?.[0]?.tool_phase==='completed')kind='working';
 const [icon,rate,amplitude]=VISUAL[kind];
 return {kind,icon,rate,amplitude,tool};
}
export function activityLabel(activity,locale='en-US'){return (COPY[locale]||COPY['en-US'])[activity.kind]||COPY['en-US'].working;}

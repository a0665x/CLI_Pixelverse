import type { AgentWorldEvent, BehaviorRoute, WorldEventKind } from '../world/types';

const ROUTES: Record<WorldEventKind, BehaviorRoute> = {
  session_start: { destinationId: 'arrival', preserveLocation: false, action: 'arrive', bubblePolicy: 'transient', bubbleText: '開始工作', priority: 20 },
  think: { destinationId: 'planning-board', preserveLocation: false, action: 'ponder', bubblePolicy: 'transient', bubbleText: '正在思考', priority: 30 },
  plan: { destinationId: 'planning-board', preserveLocation: false, action: 'plan', bubblePolicy: 'transient', bubbleText: '整理計畫', priority: 35 },
  read: { destinationId: 'reading-desk', preserveLocation: false, action: 'read', bubblePolicy: 'transient', bubbleText: '查閱檔案', priority: 35 },
  edit: { destinationId: 'editing-desk', preserveLocation: false, action: 'type', bubblePolicy: 'transient', bubbleText: '修改程式', priority: 40 },
  tool: { destinationId: 'signal-console', preserveLocation: false, action: 'terminal', bubblePolicy: 'transient', bubbleText: '使用工具', priority: 45 },
  web: { destinationId: 'signal-console', preserveLocation: false, action: 'signal', bubblePolicy: 'transient', bubbleText: '連接外部服務', priority: 45 },
  clone: { destinationId: 'dispatch-pad', preserveLocation: false, action: 'dispatch', bubblePolicy: 'transient', bubbleText: '建立 Subagent', priority: 50 },
  respond: { destinationId: 'response-desk', preserveLocation: false, action: 'respond', bubblePolicy: 'transient', bubbleText: '傳送結果', priority: 40 },
  await: { destinationId: 'queue-plaza', preserveLocation: false, action: 'queue', bubblePolicy: 'persistent', bubbleText: '等待輸入', priority: 90 },
  blocked: { destinationId: 'repair-bench', preserveLocation: false, action: 'repair', bubblePolicy: 'persistent', bubbleText: '工作受阻', priority: 100 },
  self_heal: { destinationId: 'repair-bench', preserveLocation: false, action: 'repair', bubblePolicy: 'transient', bubbleText: '正在修復', priority: 70 },
  idle: { destinationId: 'lounge', preserveLocation: false, action: 'rest', bubblePolicy: 'transient', bubbleText: '暫時休息', priority: 10 },
  offline: { destinationId: 'repair-bench', preserveLocation: false, action: 'offline', bubblePolicy: 'persistent', bubbleText: 'Agent 離線', priority: 100 },
  heartbeat: { preserveLocation: true, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
  unknown: { preserveLocation: true, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
};

export function routeEvent(event: AgentWorldEvent): BehaviorRoute {
  return { ...ROUTES[event.kind] };
}

export const ROUTE_DESTINATIONS = Object.freeze(
  [...new Set(Object.values(ROUTES).flatMap((route) => route.destinationId ? [route.destinationId] : []))],
);

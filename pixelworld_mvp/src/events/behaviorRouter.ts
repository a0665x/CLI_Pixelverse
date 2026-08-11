import type { AgentWorldEvent, BehaviorRoute, WorldEventKind } from '../world/types';

const ROUTES: Record<WorldEventKind, BehaviorRoute> = {
  session_start: { destinationId: 'arrival', preserveLocation: false, action: 'arrive', bubblePolicy: 'transient', bubbleText: '開始工作', priority: 20 },
  think: { destinationId: 'think-plan', preserveLocation: false, action: 'ponder', bubblePolicy: 'persistent', bubbleText: '正在思考', priority: 30 },
  plan: { destinationId: 'think-plan', preserveLocation: false, action: 'plan', bubblePolicy: 'persistent', bubbleText: '整理計畫', priority: 35 },
  read: { destinationId: 'archive-read', preserveLocation: false, action: 'read', bubblePolicy: 'persistent', bubbleText: '查閱檔案', priority: 35 },
  edit: { destinationId: 'maker-edit', preserveLocation: false, action: 'type', bubblePolicy: 'persistent', bubbleText: '修改程式', priority: 40 },
  tool: { destinationId: 'tool-call', preserveLocation: false, action: 'terminal', bubblePolicy: 'persistent', bubbleText: '正在處理工具調用', priority: 45 },
  web: { destinationId: 'network-web', preserveLocation: false, action: 'signal', bubblePolicy: 'persistent', bubbleText: '連接 Web / MCP', priority: 45 },
  clone: { destinationId: 'guild-dispatch', preserveLocation: false, action: 'dispatch', bubblePolicy: 'persistent', bubbleText: '建立 Subagent', priority: 50 },
  respond: { destinationId: 'guild-respond', preserveLocation: false, action: 'respond', bubblePolicy: 'persistent', bubbleText: '傳送結果', priority: 40 },
  await: { destinationId: 'awaiting-wait', preserveLocation: false, action: 'queue', bubblePolicy: 'persistent', bubbleText: '等待輸入', priority: 90 },
  blocked: { destinationId: 'recovery-blocked', preserveLocation: false, action: 'repair', bubblePolicy: 'persistent', bubbleText: '工作受阻', priority: 100 },
  self_heal: { destinationId: 'recovery-heal', preserveLocation: false, action: 'repair', bubblePolicy: 'persistent', bubbleText: '正在修復', priority: 70 },
  idle: { destinationId: 'rest-sofa', preserveLocation: false, action: 'rest', bubblePolicy: 'persistent', bubbleText: '暫時休息', priority: 10 },
  offline: { destinationId: 'offline-bed', preserveLocation: false, action: 'offline', bubblePolicy: 'persistent', bubbleText: 'Agent 離線', priority: 100 },
  heartbeat: { destinationId: 'heartbeat-pulse', preserveLocation: false, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
  unknown: { preserveLocation: true, action: 'pulse', bubblePolicy: 'none', bubbleText: '', priority: 0 },
};

export function routeEvent(event: AgentWorldEvent): BehaviorRoute {
  return { ...ROUTES[event.kind] };
}

export const ROUTE_DESTINATIONS = Object.freeze(
  [...new Set(Object.values(ROUTES).flatMap((route) => route.destinationId ? [route.destinationId] : []))],
);

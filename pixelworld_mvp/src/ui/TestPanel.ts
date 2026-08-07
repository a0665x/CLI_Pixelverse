import type { DebugLayerName } from '../debug/DebugOverlay';
import type { WorldScene } from '../scenes/WorldScene';
import type { WorldEventKind } from '../world/types';

const ACTIONS: Array<[WorldEventKind, string]> = [
  ['session_start', 'Session Start'], ['think', 'Thinking'], ['plan', 'Planning'],
  ['read', 'Reading'], ['edit', 'Working / Edit'], ['tool', 'Tool Using / Bash'],
  ['web', 'Web / MCP'], ['clone', 'Clone Agent'], ['respond', 'Responding'],
  ['await', 'Awaiting Input'], ['blocked', 'Blocked'], ['self_heal', 'Self-healing'],
  ['idle', 'Idle / Stop'], ['offline', 'Offline'], ['heartbeat', 'Heartbeat'],
];
const DEBUG_LAYERS: Array<[DebugLayerName, string]> = [
  ['grid', 'Tile grid'],
  ['collision', 'Blocked tiles'],
  ['paths', 'Agent paths'],
  ['anchors', 'Station anchors'],
  ['depth', 'Foot-depth lines'],
];
const mountedPanels = new WeakMap<HTMLElement, TestPanel>();

export const initialPanelExpanded = (viewportWidth: number): boolean => viewportWidth >= 940;
export const PANEL_LAYOUT = Object.freeze({ headerClass: 'panel-header', controlsId: 'test-panel-controls', headerHeight: 44, controlsPadding: 10 });

interface PanelBreakpointQuery {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
}

export function bindPanelBreakpoint(query: PanelBreakpointQuery, setExpanded: (expanded: boolean) => void): () => void {
  const listener = (event: { matches: boolean }) => setExpanded(event.matches);
  setExpanded(query.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export class TestPanel {
  private readonly roster = document.createElement('select');
  private readonly log = document.createElement('ol');
  private unsubscribe: (() => void) | undefined;
  private unsubscribeBreakpoint: (() => void) | undefined;
  private destroyed = false;

  constructor(private readonly root: HTMLElement, private readonly world: WorldScene) {
    root.replaceChildren();
    const title = document.createElement('h1');
    title.id = 'test-panel-title';
    title.textContent = 'Agent Test Panel';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'panel-toggle';
    toggle.setAttribute('aria-controls', PANEL_LAYOUT.controlsId);
    const setExpanded = (expanded: boolean) => {
      root.dataset.expanded = String(expanded);
      toggle.textContent = expanded ? '收合面板' : '展開面板';
      toggle.setAttribute('aria-expanded', String(expanded));
    };
    this.unsubscribeBreakpoint = bindPanelBreakpoint(window.matchMedia('(min-width: 940px)'), setExpanded);
    toggle.addEventListener('click', () => {
      const expanded = root.dataset.expanded !== 'true';
      setExpanded(expanded);
    });

    const controls = document.createElement('div');
    controls.id = PANEL_LAYOUT.controlsId;
    controls.style.padding = `${PANEL_LAYOUT.controlsPadding}px`;
    const rosterLabel = document.createElement('label');
    rosterLabel.htmlFor = 'agent-selector';
    rosterLabel.textContent = 'Selected Agent';
    this.roster.id = 'agent-selector';
    this.roster.setAttribute('aria-label', 'Select Agent');
    this.roster.addEventListener('change', () => {
      if (!world.selectAgent(this.roster.value)) this.record(this.roster.value || 'Agent', 'select', 'unknown-agent');
    });

    const actions = document.createElement('div');
    actions.className = 'panel-grid';
    actions.setAttribute('aria-label', 'Agent state actions');
    ACTIONS.forEach(([kind, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.kind = kind;
      button.setAttribute('aria-label', `Dispatch ${label} to selected Agent`);
      button.addEventListener('click', () => this.dispatch(kind));
      actions.append(button);
    });

    const debug = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Debug overlays';
    debug.append(legend);
    DEBUG_LAYERS.forEach(([name, text]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = `debug-${name}`;
      input.addEventListener('change', () => world.setDebugLayer(name, input.checked));
      label.append(input, ` ${text}`);
      debug.append(label);
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset Demo';
    reset.setAttribute('aria-label', 'Reload and reset the demo');
    reset.addEventListener('click', () => window.location.reload());
    this.log.className = 'event-log';
    this.log.setAttribute('aria-label', 'Action feedback');
    this.log.setAttribute('aria-live', 'polite');
    controls.append(rosterLabel, this.roster, actions, debug, reset, this.log);
    root.setAttribute('aria-labelledby', title.id);
    const header = document.createElement('div');
    header.className = PANEL_LAYOUT.headerClass;
    header.style.height = `${PANEL_LAYOUT.headerHeight}px`;
    header.append(title, toggle);
    root.append(header, controls);
    this.refreshRoster();
    this.unsubscribe = world.onRosterChanged(() => this.refreshRoster());
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.unsubscribeBreakpoint?.();
    this.unsubscribeBreakpoint = undefined;
    if (mountedPanels.get(this.root) === this) mountedPanels.delete(this.root);
    this.root.replaceChildren();
  }

  private dispatch(kind: WorldEventKind): void {
    if (this.destroyed) return;
    const agentId = this.world.selectedAgentId() || 'No selected Agent';
    const result = this.world.dispatchDemo(kind);
    this.record(agentId, kind, result.ok ? undefined : (result.reason ?? 'dispatch-failed'));
  }

  private record(agentId: string, action: string, reason?: string): void {
    const item = document.createElement('li');
    item.textContent = reason ? `${agentId} · ${action} · Error: ${reason}` : `${agentId} → ${action}`;
    item.className = reason ? 'event-error' : 'event-success';
    this.log.prepend(item);
    while (this.log.children.length > 12) this.log.lastElementChild?.remove();
  }

  private refreshRoster(): void {
    if (this.destroyed) return;
    const agents = this.world.agentList();
    const selected = this.world.selectedAgentId();
    if (agents.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No Agents available';
      option.disabled = true;
      option.selected = true;
      this.roster.replaceChildren(option);
      this.roster.disabled = true;
      return;
    }
    this.roster.disabled = false;
    this.roster.replaceChildren(...agents.map((agent) => {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.role === 'main' ? '★' : '◇'} ${agent.id}`;
      option.selected = agent.id === selected;
      return option;
    }));
  }
}

export function mountTestPanel(root: HTMLElement, world: WorldScene): TestPanel {
  mountedPanels.get(root)?.destroy();
  const panel = new TestPanel(root, world);
  mountedPanels.set(root, panel);
  return panel;
}

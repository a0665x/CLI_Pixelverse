import Phaser from 'phaser';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS, agentSkinFor } from '../rendering/assetManifest';
import type { GridPoint } from '../world/types';
import { AgentController } from './AgentController';

const MAX_AGENTS = 64;

export class AgentRegistry {
  private readonly agents = new Map<string, AgentController>();
  private selectedId = 'main';
  private nextSubagent = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly grid: NavigationGrid, spawn: GridPoint) {
    this.agents.set('main', new AgentController(scene, 'main', 'main', spawn, grid, AGENT_SKINS.main));
  }

  createSubagent(spawn: GridPoint): AgentController | undefined {
    const agentId = `subagent-${this.nextSubagent++}`;
    return this.ensure(agentId, 'subagent', spawn)?.agent;
  }

  ensure(agentId: string, role: 'main' | 'subagent', spawn: GridPoint): { agent: AgentController; created: boolean } | undefined {
    const existing = this.agents.get(agentId);
    if (existing) return { agent: existing, created: false };
    if (this.agents.size >= MAX_AGENTS) return undefined;

    const skin = agentSkinFor(agentId, role);
    const agent = new AgentController(this.scene, agentId, role, spawn, this.grid, skin);
    this.agents.set(agentId, agent);
    return { agent, created: true };
  }

  remove(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.destroy();
    this.agents.delete(agentId);
    if (this.selectedId === agentId) this.selectedId = this.agents.keys().next().value ?? '';
    return true;
  }

  canCreateSubagent(reserved = 0): boolean { return this.agents.size + reserved < MAX_AGENTS; }

  get(agentId: string): AgentController | undefined { return this.agents.get(agentId); }
  all(): AgentController[] { return [...this.agents.values()]; }
  selected(): AgentController {
    const selected = this.agents.get(this.selectedId) ?? this.agents.values().next().value;
    if (!selected) throw new Error('AgentRegistry has no agents');
    return selected;
  }
  select(agentId: string): boolean {
    if (!this.agents.has(agentId)) return false;
    this.selectedId = agentId;
    return true;
  }

  update(deltaMs: number): void {
    this.agents.forEach((agent) => agent.clearRenderOffset());
    this.agents.forEach((agent) => agent.update(deltaMs));
    const groups = new Map<string, AgentController[]>();
    this.agents.forEach((agent) => {
      if (!agent.sprite.visible) return;
      const key = `${Math.round(agent.sprite.x)},${Math.round(agent.sprite.y)}`;
      groups.set(key, [...(groups.get(key) ?? []), agent]);
    });
    groups.forEach((group) => group.forEach((agent, index) => {
      agent.applyRenderOffset((index - (group.length - 1) / 2) * 3);
    }));
  }

  destroy(): void {
    this.agents.forEach((agent) => agent.destroy());
    this.agents.clear();
  }
}

import Phaser from 'phaser';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS } from '../rendering/assetManifest';
import type { GridPoint } from '../world/types';
import { AgentController } from './AgentController';

const MAX_SUBAGENTS = 10;

export class AgentRegistry {
  private readonly agents = new Map<string, AgentController>();
  private selectedId = 'main';
  private nextSubagent = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly grid: NavigationGrid, spawn: GridPoint) {
    this.agents.set('main', new AgentController(scene, 'main', 'main', spawn, grid, AGENT_SKINS.main));
  }

  createSubagent(spawn: GridPoint): AgentController | undefined {
    if (this.agents.size >= MAX_SUBAGENTS + 1) return undefined;
    const agentId = `subagent-${this.nextSubagent++}`;
    const skin = Number(agentId.split('-')[1]) % 2 === 0 ? AGENT_SKINS.branch : AGENT_SKINS.subagent;
    const agent = new AgentController(this.scene, agentId, 'subagent', spawn, this.grid, skin);
    this.agents.set(agentId, agent);
    return agent;
  }

  canCreateSubagent(reserved = 0): boolean { return this.agents.size + reserved < MAX_SUBAGENTS + 1; }

  get(agentId: string): AgentController | undefined { return this.agents.get(agentId); }
  all(): AgentController[] { return [...this.agents.values()]; }
  selected(): AgentController { return this.agents.get(this.selectedId)!; }
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

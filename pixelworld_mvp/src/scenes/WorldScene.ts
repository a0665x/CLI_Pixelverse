import Phaser from 'phaser';
import { AgentRegistry } from '../agents/AgentRegistry';
import type { AgentPresence } from '../agents/agentPresence';
import { DebugOverlay, type DebugLayerName } from '../debug/DebugOverlay';
import { EventIngress } from '../events/eventIngress';
import { WORLD_PIXELS } from '../game/constants';
import { emitWorldReady } from '../game/worldReady';
import { NavigationGrid } from '../navigation/navigationGrid';
import { planAgentTravel } from '../navigation/travelPlanner';
import { ensureWorldAtlasTexture, preloadVillageAssets } from '../rendering/assetManifest';
import type { RenderedForeground } from '../rendering/buildingForeground';
import { DepthOcclusionSystem } from '../rendering/DepthOcclusionSystem';
import { AmbientAnimalSystem } from '../rendering/AmbientAnimalSystem';
import { clearRenderedForegrounds } from '../rendering/renderedForegrounds';
import { StatusOverlaySystem } from '../rendering/StatusOverlaySystem';
import { VillageRenderer } from '../rendering/VillageRenderer';
import { StationAllocator } from '../stations/stationAllocator';
import { createDemoEvent } from '../ui/demoEvents';
import type { AgentWorldEvent, WorldEventKind } from '../world/types';
import { WORLD_DEFINITION } from '../world/worldDefinition';
import { validateWorld } from '../world/validateWorld';

export type { RenderedForeground } from '../rendering/buildingForeground';

export class WorldScene extends Phaser.Scene {
  readonly worldDefinition = WORLD_DEFINITION;
  readonly navigationGrid = NavigationGrid.fromWorld(WORLD_DEFINITION);
  readonly renderedForegrounds: RenderedForeground[] = [];
  private ingress = new EventIngress();
  private allocator = new StationAllocator(WORLD_DEFINITION.stations);
  private agents!: AgentRegistry;
  private depthSystem!: DepthOcclusionSystem;
  private animalSystem: AmbientAnimalSystem | undefined;
  private statusOverlay!: StatusOverlaySystem;
  private debugOverlay!: DebugOverlay;
  private demoSequence = 1;
  private readonly pendingCloneAgents = new Set<string>();
  private sceneReady = false;
  private readonly listeners = new Set<() => void>();
  private lastError = '';

  constructor() { super('world'); }
  preload(): void { preloadVillageAssets(this); }

  create(): void {
    this.sceneReady = false;
    clearRenderedForegrounds(this.renderedForegrounds);
    this.ingress = new EventIngress();
    this.allocator = new StationAllocator(this.worldDefinition.stations);
    this.demoSequence = 1;
    this.pendingCloneAgents.clear();
    const errors = validateWorld(this.worldDefinition);
    if (errors.length > 0) throw new Error(`Invalid world definition:\n${errors.join('\n')}`);
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height).setRoundPixels(true);
    const village = new VillageRenderer(this, ensureWorldAtlasTexture(this)).render(this.worldDefinition);
    this.renderedForegrounds.push(...village.foregrounds);
    this.animalSystem = new AmbientAnimalSystem(this, this.worldDefinition.scenery.animals);
    this.agents = new AgentRegistry(this, this.navigationGrid, this.worldDefinition.spawn);
    this.statusOverlay = new StatusOverlaySystem(this, this.worldDefinition.buildings);
    this.agents.all().forEach((agent) => this.statusOverlay.attachAgent(agent));
    this.depthSystem = new DepthOcclusionSystem(this, this.renderedForegrounds, () => this.agents.all());
    this.debugOverlay = new DebugOverlay(this, this.navigationGrid, this.worldDefinition, () => this.agents.all());
    this.agents.all().forEach((agent) => this.bindAgentSelection(agent));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupAgents, this);
    this.sceneReady = true;
    emitWorldReady(this.game.events, this);
  }

  update(_time: number, delta: number): void {
    this.agents?.update(delta);
    this.animalSystem?.update(delta);
    if (this.depthSystem && this.agents) this.depthSystem.update(this.agents.selected());
    this.statusOverlay?.update(this.agents.all());
    this.debugOverlay?.update();
  }

  dispatchWorldEvent(event: AgentWorldEvent): { ok: boolean; reason?: string } {
    const result = this.ingress.ingest(event);
    if (!result.accepted) return { ok: false, reason: result.reason };
    const normalizedEvent = result.event;
    const agent = this.agents?.get(normalizedEvent.agentId);
    if (!agent) return { ok: false, reason: 'unknown-agent' };
    if (result.route.preserveLocation) {
      if (normalizedEvent.kind === 'heartbeat') {
        agent.heartbeat();
        return { ok: true };
      }
      return { ok: false, reason: 'unknown-event' };
    }

    this.releasePendingClone(normalizedEvent.agentId);
    if (normalizedEvent.kind === 'clone' && !this.agents.canCreateSubagent(this.pendingCloneAgents.size)) {
      agent.cancel();
      this.allocator.releaseAgent(normalizedEvent.agentId);
      this.statusOverlay.showError(agent, 'agent-cap');
      return { ok: false, reason: 'agent-cap' };
    }
    const excluded = new Set<string>();
    let triedAnchor = false;
    while (true) {
      const allocation = this.allocator.assign(normalizedEvent.agentId, result.route.destinationId!, excluded);
      if (!allocation.ok) {
        agent.cancel();
        this.allocator.releaseAgent(normalizedEvent.agentId);
        const reason = triedAnchor ? 'no-path' : allocation.reason;
        this.lastError = reason;
        this.statusOverlay.showError(agent, reason === 'no-path' ? 'no-path' : 'station-full');
        return { ok: false, reason };
      }
      triedAnchor = true;
      if (normalizedEvent.kind === 'clone' && allocation.assignment.kind === 'queue') {
        agent.cancel();
        this.allocator.releaseAgent(normalizedEvent.agentId);
        this.statusOverlay.showError(agent, 'clone-queue');
        return { ok: false, reason: 'clone-queue' };
      }
      const effectiveRoute = allocation.assignment.kind === 'queue'
        ? { ...result.route, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: '等待工作位', priority: 80 }
        : result.route;
      const reservesClone = normalizedEvent.kind === 'clone' && allocation.assignment.kind === 'interaction';
      if (reservesClone) this.pendingCloneAgents.add(normalizedEvent.agentId);
      const departurePresence = agent.presence();
      const travelPlan = planAgentTravel(this.worldDefinition, departurePresence, allocation.assignment);
      let arrived = false;
      let published = false;
      let arrivalApplied = false;
      const applyArrival = () => {
        if (!arrived || !published || arrivalApplied) return;
        arrivalApplied = true;
        if (travelPlan.destinationBuilding) {
          this.statusOverlay.setPresence(normalizedEvent.agentId, travelPlan.destinationBuilding.buildingId);
        }
        if (reservesClone) {
          this.releasePendingClone(normalizedEvent.agentId);
          const collaborationBarn = this.worldDefinition.buildings.find((building) => building.id === 'collaboration-barn');
          const subagent = collaborationBarn
            ? this.agents?.createSubagent(collaborationBarn.entrance.outside)
            : undefined;
          if (subagent) {
            subagent.sprite.setVisible(true);
            this.statusOverlay.attachAgent(subagent);
            this.bindAgentSelection(subagent);
            this.notifyRoster();
          }
        }
      };
      const onArrive = () => {
        arrived = true;
        applyArrival();
      };
      if (agent.dispatch(normalizedEvent, allocation.assignment, effectiveRoute, onArrive, travelPlan)) {
        if (departurePresence.kind === 'inside' && !travelPlan.stayInside) {
          this.statusOverlay.setPresence(normalizedEvent.agentId);
        }
        this.statusOverlay.publish(agent, normalizedEvent, effectiveRoute);
        published = true;
        applyArrival();
        return { ok: true };
      }
      if (reservesClone) this.releasePendingClone(normalizedEvent.agentId);
      excluded.add(allocation.assignment.anchorId);
      this.allocator.releaseAgent(normalizedEvent.agentId);
    }
  }

  agentList(): Array<{ id: string; role: 'main' | 'subagent' }> {
    if (!this.sceneReady) return [];
    return this.agents?.all().map((agent) => ({ id: agent.agentId, role: agent.role })) ?? [];
  }

  dispatchDemo(kind: WorldEventKind): { ok: boolean; reason?: string } {
    if (!this.sceneReady) return { ok: false, reason: 'scene-not-ready' };
    const selected = this.agents?.selected();
    if (!selected) return { ok: false, reason: 'scene-not-ready' };
    return this.dispatchWorldEvent(createDemoEvent(
      kind,
      { id: selected.agentId, role: selected.role },
      this.demoSequence++,
    ));
  }

  setDebugLayer(name: DebugLayerName, visible: boolean): void {
    if (this.sceneReady) this.debugOverlay?.setVisible(name, visible);
  }

  selectAgent(agentId: string): boolean {
    if (!this.sceneReady) return false;
    const selected = this.agents?.select(agentId) ?? false;
    if (selected) this.notifyRoster();
    return selected;
  }

  selectedAgentId(): string { return this.sceneReady ? (this.agents?.selected()?.agentId ?? '') : ''; }
  selectedAgentPresence(): AgentPresence {
    return this.sceneReady && this.agents?.selected()
      ? this.agents.selected().presence()
      : { kind: 'outside' };
  }
  selectedAgent(): import('../agents/AgentController').AgentController { return this.agents.selected(); }
  onRosterChanged(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private notifyRoster(): void { this.listeners.forEach((listener) => listener()); }

  private releasePendingClone(agentId: string): void { this.pendingCloneAgents.delete(agentId); }

  private bindAgentSelection(agent: import('../agents/AgentController').AgentController): void {
    agent.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectAgent(agent.agentId));
  }

  private cleanupAgents(): void {
    this.sceneReady = false;
    this.statusOverlay?.destroy();
    this.animalSystem?.destroy();
    this.animalSystem = undefined;
    this.agents?.destroy();
    this.pendingCloneAgents.clear();
    this.listeners.clear();
  }

}

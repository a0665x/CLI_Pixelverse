import Phaser from 'phaser';
import { AgentRegistry } from '../agents/AgentRegistry';
import { DebugOverlay, type DebugLayerName } from '../debug/DebugOverlay';
import { EventIngress } from '../events/eventIngress';
import { TILE_SIZE, WORLD_PIXELS } from '../game/constants';
import { emitWorldReady } from '../game/worldReady';
import { NavigationGrid } from '../navigation/navigationGrid';
import { ensureAssetFallbacks, preloadVillageAssets, PROP_ASSETS } from '../rendering/assetManifest';
import { buildingEaveGeometry } from '../rendering/buildingForeground';
import { createVillageTextures } from '../rendering/createVillageTextures';
import { DepthOcclusionSystem } from '../rendering/DepthOcclusionSystem';
import { clearRenderedForegrounds } from '../rendering/renderedForegrounds';
import { StatusOverlaySystem } from '../rendering/StatusOverlaySystem';
import { zoneLabelDefinitions } from '../rendering/zoneLabels';
import { StationAllocator } from '../stations/stationAllocator';
import { createDemoEvent } from '../ui/demoEvents';
import type { AgentWorldEvent, WorldEventKind } from '../world/types';
import { WORLD_DEFINITION } from '../world/worldDefinition';
import { validateWorld } from '../world/validateWorld';

export interface RenderedForeground {
  object: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Depth;
  bounds: Phaser.Geom.Rectangle;
  baselineY: number;
}

export class WorldScene extends Phaser.Scene {
  readonly worldDefinition = WORLD_DEFINITION;
  readonly navigationGrid = NavigationGrid.fromWorld(WORLD_DEFINITION);
  readonly renderedForegrounds: RenderedForeground[] = [];
  private ingress = new EventIngress();
  private allocator = new StationAllocator(WORLD_DEFINITION.stations);
  private agents!: AgentRegistry;
  private depthSystem!: DepthOcclusionSystem;
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
    ensureAssetFallbacks(this);
    createVillageTextures(this);
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height).setRoundPixels(true);
    this.renderTerrain();
    this.renderZoneLabels();
    this.renderBuildings();
    this.renderScenery();
    this.renderWorkProps();
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
    if (this.depthSystem && this.agents) this.depthSystem.update(this.agents.selected());
    this.statusOverlay?.update(this.agents.all());
    this.debugOverlay?.update();
  }

  dispatchWorldEvent(event: AgentWorldEvent): { ok: boolean; reason?: string } {
    const result = this.ingress.ingest(event);
    if (!result.accepted) return { ok: false, reason: result.reason };
    const agent = this.agents?.get(event.agentId);
    if (!agent) return { ok: false, reason: 'unknown-agent' };
    if (result.route.preserveLocation) {
      if (event.kind === 'heartbeat') {
        agent.heartbeat();
        return { ok: true };
      }
      return { ok: false, reason: 'unknown-event' };
    }

    const previous = this.allocator.assignmentFor(event.agentId);
    this.releasePendingClone(event.agentId);
    if (event.kind === 'clone' && !this.agents.canCreateSubagent(this.pendingCloneAgents.size)) {
      agent.cancel();
      this.allocator.releaseAgent(event.agentId);
      return { ok: false, reason: 'agent-cap' };
    }
    const excluded = new Set<string>();
    let triedAnchor = false;
    while (true) {
      const allocation = this.allocator.assign(event.agentId, result.route.destinationId!, excluded);
      if (!allocation.ok) {
        agent.cancel();
        this.allocator.releaseAgent(event.agentId);
        const reason = triedAnchor ? 'no-path' : allocation.reason;
        this.lastError = reason;
        this.statusOverlay.showError(agent, reason === 'no-path' ? '⚠ 無法抵達' : '⚠ 工作區已滿');
        return { ok: false, reason };
      }
      triedAnchor = true;
      if (event.kind === 'clone' && allocation.assignment.kind === 'queue') {
        agent.cancel();
        this.allocator.releaseAgent(event.agentId);
        return { ok: false, reason: 'clone-queue' };
      }
      const effectiveRoute = allocation.assignment.kind === 'queue'
        ? { ...result.route, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: '等待工作位', priority: 80 }
        : result.route;
      const reservesClone = event.kind === 'clone' && allocation.assignment.kind === 'interaction';
      if (reservesClone) this.pendingCloneAgents.add(event.agentId);
      const onArrive = reservesClone
        ? () => {
          this.releasePendingClone(event.agentId);
          const subagent = this.agents?.createSubagent(allocation.assignment.point);
          if (subagent) {
            this.statusOverlay.attachAgent(subagent);
            this.bindAgentSelection(subagent);
            this.notifyRoster();
          }
        }
        : undefined;
      if (agent.dispatch(result.event, allocation.assignment, effectiveRoute, onArrive)) {
        const station = this.worldDefinition.stations.find((item) => item.id === result.route.destinationId);
        this.statusOverlay.publish(agent, result.event, effectiveRoute, station?.buildingId);
        return { ok: true };
      }
      if (reservesClone) this.releasePendingClone(event.agentId);
      excluded.add(allocation.assignment.anchorId);
      this.allocator.releaseAgent(event.agentId);
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
    this.agents?.destroy();
    this.pendingCloneAgents.clear();
    this.listeners.clear();
  }

  private renderTerrain(): void {
    for (let y = 0; y < this.worldDefinition.height; y += 1) for (let x = 0; x < this.worldDefinition.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-grass').setOrigin(0).setDepth(0);
    const pathRects = [
      { x: 1, y: 7, width: 38, height: 3 }, { x: 18, y: 7, width: 4, height: 14 },
      { x: 5, y: 9, width: 3, height: 10 }, { x: 32, y: 9, width: 3, height: 10 },
    ];
    for (const rect of pathRects) for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-path').setOrigin(0).setDepth(1);
  }

  private renderBuildings(): void {
    const palettes = [0x58718f, 0x8b5a47, 0x5d6f5a];
    this.worldDefinition.buildings.forEach((building, index) => {
      const { x, y, width, height } = building.bounds;
      this.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, width * TILE_SIZE, height * TILE_SIZE, palettes[index]!).setOrigin(0).setDepth((y + height) * TILE_SIZE - 2);
      this.add.rectangle(x * TILE_SIZE - 4, y * TILE_SIZE - 8, width * TILE_SIZE + 8, 28, 0x343b4f)
        .setOrigin(0)
        .setDepth((y + height) * TILE_SIZE);
      this.add.rectangle((x + Math.floor(width / 2)) * TILE_SIZE - 6, (y + height) * TILE_SIZE - 18, 12, 18, 0x5a3828).setOrigin(0).setDepth((y + height) * TILE_SIZE - 1);
      const eaveGeometry = buildingEaveGeometry(building.bounds, TILE_SIZE);
      const eave = this.add.rectangle(
        eaveGeometry.bounds.x,
        eaveGeometry.bounds.y,
        eaveGeometry.bounds.width,
        eaveGeometry.bounds.height,
        0x454d63,
      ).setOrigin(0).setDepth(eaveGeometry.baselineY);
      this.renderedForegrounds.push({
        object: eave as unknown as RenderedForeground['object'],
        bounds: eave.getBounds(),
        baselineY: eaveGeometry.baselineY,
      });
      this.add.text(building.labelAnchor.x * TILE_SIZE, building.labelAnchor.y * TILE_SIZE, building.label, { fontFamily: 'monospace', fontSize: '8px', color: '#fff4cf', backgroundColor: '#203126', padding: { x: 3, y: 2 } }).setOrigin(0.5, 0).setDepth(10_000);
    });
  }

  private renderZoneLabels(): void {
    for (const zone of zoneLabelDefinitions(this.worldDefinition.zones)) {
      this.add.text(zone.anchor.x * TILE_SIZE, zone.anchor.y * TILE_SIZE, zone.label, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#eef8dc',
        backgroundColor: '#294531cc',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0).setDepth(9_000);
    }
  }

  private renderScenery(): void {
    const pond = this.worldDefinition.scenery.pond;
    for (let y = pond.y; y < pond.y + pond.height; y += 1) for (let x = pond.x; x < pond.x + pond.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-water').setOrigin(0).setDepth(2);
    for (const bed of this.worldDefinition.scenery.flowerBeds) for (let y = bed.y; y < bed.y + bed.height; y += 1) for (let x = bed.x; x < bed.x + bed.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'flower-bed').setOrigin(0).setDepth(3);
    for (const tree of this.worldDefinition.scenery.trees) {
      const footX = tree.trunk.x * TILE_SIZE + 8;
      const footY = tree.trunk.y * TILE_SIZE + TILE_SIZE;
      this.add.image(tree.trunk.x * TILE_SIZE, tree.trunk.y * TILE_SIZE, 'tree-trunk').setOrigin(0).setDepth(footY - 1);
      const canopy = this.add.image(footX, footY - 22, 'tree-canopy').setDepth(footY);
      this.renderedForegrounds.push({ object: canopy, bounds: canopy.getBounds(), baselineY: footY });
    }
  }

  private renderWorkProps(): void {
    const props: Array<[keyof typeof PROP_ASSETS, number, number]> = [
      ['board', 5, 7], ['bookshelf', 8, 7], ['appleDesk', 18, 7], ['appleTerminal', 22, 7],
      ['server', 31, 7], ['lamp', 34, 7], ['appleSofa', 20, 17], ['crate', 34, 14],
    ];
    for (const [key, x, y] of props) {
      const image = this.add.image(x * TILE_SIZE + 8, y * TILE_SIZE + 8, `prop-${key}`).setDepth(y * TILE_SIZE + 15);
      if (key.startsWith('apple')) image.setScale(0.5);
    }
  }
}

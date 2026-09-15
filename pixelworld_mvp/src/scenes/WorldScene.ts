import {withRoomMemoFrame} from '../rendering/interiorRuntimeCache';
import {FrameProbe} from '../diagnostics/frameProbe';
import {characterMoveAllowed,type CharacterBody} from '../player/characterCollision';
import { VillageAtmosphere } from '../rendering/VillageAtmosphere';
import Phaser from 'phaser';
import { type VillageLocale, villageCopy } from '../i18n/villageLocale';
import { AgentRegistry } from '../agents/AgentRegistry';
import type { AgentPresence } from '../agents/agentPresence';
import { DebugOverlay, type DebugLayerName } from '../debug/DebugOverlay';
import { EventIngress } from '../events/eventIngress';
import { WORLD_PIXELS } from '../game/constants';
import { emitWorldReady } from '../game/worldReady';
import { NavigationGrid } from '../navigation/navigationGrid';
import { planAgentTravel } from '../navigation/travelPlanner';
import {
  ensureWorldAtlasTexture,
  installVillageCollisionMasks,
  preloadVillageAssets,
} from '../rendering/assetManifest';
import type { RenderedForeground } from '../rendering/buildingForeground';
import { DepthOcclusionSystem } from '../rendering/DepthOcclusionSystem';
import { AmbientAnimalSystem } from '../rendering/AmbientAnimalSystem';
import { InteriorCutawaySystem } from '../rendering/InteriorCutawaySystem';
import { InteriorFocusController, type InteriorFocusTarget } from '../rendering/InteriorFocusController';
import { clearRenderedForegrounds } from '../rendering/renderedForegrounds';
import { StatusOverlaySystem } from '../rendering/StatusOverlaySystem';
import { VillageRenderer } from '../rendering/VillageRenderer';
import { StationAllocator } from '../stations/stationAllocator';
import { createDemoEvent } from '../ui/demoEvents';
import {
  backendAgentRole,
  backendAgentSignature,
  buildingIdForCommandRoom,
  commandRoomForBuilding,
  isBackendWorldSnapshot,
  worldEventForBackendAgent,
  type BackendWorldSnapshot,
} from '../live/backendSnapshot';
import type { AgentWorldEvent, WorldEventKind } from '../world/types';
import { WORLD_DEFINITION } from '../world/worldDefinition';
import { validateWorld } from '../world/validateWorld';
import type { CommandFocusSelection } from '../live/LiveWorldClient';

export type { RenderedForeground } from '../rendering/buildingForeground';

export class WorldScene extends Phaser.Scene {
  readonly worldDefinition = WORLD_DEFINITION;
  readonly navigationGrid = NavigationGrid.fromWorld(WORLD_DEFINITION);
  readonly renderedForegrounds: RenderedForeground[] = [];
  private ingress = new EventIngress();
  private allocator = new StationAllocator(WORLD_DEFINITION.stations);
  private agents!: AgentRegistry;
  private depthSystem!: DepthOcclusionSystem;
  private atmosphere: VillageAtmosphere | undefined;
  private animalSystem: AmbientAnimalSystem | undefined;
  private cutawaySystem: InteriorCutawaySystem | undefined;
  private statusOverlay!: StatusOverlaySystem;
  private focusController = new InteriorFocusController();
  private statusFocusUnregister: (() => void) | undefined;
  private debugOverlay!: DebugOverlay;
  private demoSequence = 1;
  private readonly pendingCloneAgents = new Set<string>();
  private sceneReady = false;
  private readonly listeners = new Set<() => void>();
  private readonly commandSelectionListeners = new Set<(selection: CommandFocusSelection) => void>();
  private lastLiveSnapshot: BackendWorldSnapshot | undefined;
  private lastError = '';
  private readonly liveAgentSignatures = new Map<string, string>();
  private locale: VillageLocale = 'zh-TW';
  private cleanupComplete = false;

  constructor() { super('world'); }
  preload(): void { preloadVillageAssets(this); }

  create(): void {
    installVillageCollisionMasks(this);
    this.sceneReady = false;
    this.cleanupComplete = false;
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
    this.atmosphere = new VillageAtmosphere(this, this.worldDefinition);
    this.animalSystem = new AmbientAnimalSystem(this, this.worldDefinition.scenery.animals);
    this.agents = new AgentRegistry(this, this.navigationGrid, this.worldDefinition.spawn);
    this.attachCutawaySystem(new InteriorCutawaySystem(
      this,
      this.worldDefinition,
      undefined,
      { onOpenStateChange: (open) => this.setInteriorFocused(open) },
    ));
    village.hitRegions.forEach(({ buildingId, object }) => {
      let down: { x: number; y: number } | undefined;
      object.on('pointerdown', (pointer: Phaser.Input.Pointer) => { down = { x: pointer.x, y: pointer.y }; });
      object.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (down && Phaser.Math.Distance.Between(down.x, down.y, pointer.x, pointer.y) < 6) this.selectBuilding(buildingId);
        down = undefined;
      });
    });
    this.attachStatusOverlay(new StatusOverlaySystem(this, this.worldDefinition.buildings));
    village.hitRegions.forEach(({ buildingId, bounds }) => {
      this.statusOverlay?.setBuildingHitRegion(buildingId, bounds);
    });
    this.agents.all().forEach((agent) => this.statusOverlay?.attachAgent(agent));
    this.depthSystem = new DepthOcclusionSystem(this, this.renderedForegrounds, () => this.agents.all());
    this.debugOverlay = new DebugOverlay(this, this.navigationGrid, this.worldDefinition, () => this.agents.all());
    this.agents.all().forEach((agent) => this.bindAgentSelection(agent));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupAgents, this);
    this.sceneReady = true;
    emitWorldReady(this.game.events, this);
  }

  visitorBody:CharacterBody|undefined;
  private previousViewFrame=0;
  private frameProbe=new FrameProbe();
  update(_time: number, delta: number): void {
    withRoomMemoFrame(()=>{
    const started=performance.now();
    // 3D rendering may run below Phaser's smoothing target; use elapsed time so hooks keep moving.
    const elapsed=this.previousViewFrame?_time-this.previousViewFrame:delta;
    this.previousViewFrame=_time;
    const threeView=typeof document!=='undefined' && document.documentElement?.dataset?.view==='3d';
    if(threeView) delta=Math.min(Math.max(elapsed,0),100);
    const peers=this.agents?.all()??[];
    const bodies:CharacterBody[]=peers.filter(a=>a.presence().kind==='outside').map(a=>({id:a.agentId,roomId:'',x:a.sprite.x/16-.5,y:a.sprite.y/16-.5}));
    if(this.visitorBody)bodies.push(this.visitorBody);
    for(const actor of peers){const body=bodies.find(b=>b.id===actor.agentId);actor.movementAllowed=(from,to)=>{
      const allowed=characterMoveAllowed({id:actor.agentId,roomId:'',...from},to,bodies);
      if(allowed&&body){body.x=to.x;body.y=to.y;}return allowed;
    };}
    this.agents?.update(delta);
    if(!threeView){
    this.animalSystem?.update(delta);
    this.atmosphere?.update(delta);
    if (this.depthSystem && this.agents?.all().length) this.depthSystem.update(this.agents.selected());
    this.statusOverlay?.update(this.agents.all());
    }
    this.cutawaySystem?.update(this.agents.all().map((agent) => agent.interiorSnapshot()));
    if(!threeView)this.debugOverlay?.update();
    const metrics=this.frameProbe?.record(elapsed,performance.now()-started,started);
    if(metrics&&typeof document!=='undefined')document.documentElement.dataset.worldPerformance=JSON.stringify(metrics);
    });
  }

  dispatchWorldEvent(event: AgentWorldEvent, options: { spawnClone?: boolean } = {}): { ok: boolean; reason?: string } {
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
    const canSpawnClone = options.spawnClone !== false;
    if (canSpawnClone && normalizedEvent.kind === 'clone' && !this.agents.canCreateSubagent(this.pendingCloneAgents.size)) {
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
      if (canSpawnClone && normalizedEvent.kind === 'clone' && allocation.assignment.kind === 'queue') {
        agent.cancel();
        this.allocator.releaseAgent(normalizedEvent.agentId);
        this.statusOverlay.showError(agent, 'clone-queue');
        return { ok: false, reason: 'clone-queue' };
      }
      const effectiveRoute = allocation.assignment.kind === 'queue'
        ? { ...result.route, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: villageCopy(this.locale).actions.queue, priority: 80 }
        : result.route;
      const reservesClone = canSpawnClone && normalizedEvent.kind === 'clone' && allocation.assignment.kind === 'interaction';
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

  syncLiveSnapshot(snapshot: BackendWorldSnapshot, sequence = Date.now()): { added: number; removed: number; dispatched: number } {
    if (!this.sceneReady || !isBackendWorldSnapshot(snapshot)) return { added: 0, removed: 0, dispatched: 0 };
    this.lastLiveSnapshot = snapshot;
    const liveIds = new Set(snapshot.agents.map(({ agent }) => agent));
    let added = 0;
    let removed = 0;
    let dispatched = 0;

    for (const backendAgent of snapshot.agents) {
      const ensured = this.agents.ensure(backendAgent.agent, backendAgentRole(backendAgent), this.worldDefinition?.spawn ?? WORLD_DEFINITION.spawn);
      if (!ensured) continue;
      if (ensured.created) {
        added += 1;
        this.statusOverlay.attachAgent(ensured.agent);
        this.bindAgentSelection(ensured.agent);
      }
      const signature = backendAgentSignature(backendAgent);
      if (this.liveAgentSignatures.get(backendAgent.agent) === signature) continue;
      this.liveAgentSignatures.set(backendAgent.agent, signature);
      this.dispatchWorldEvent(worldEventForBackendAgent(backendAgent, sequence), { spawnClone: false });
      dispatched += 1;
    }

    for (const agent of this.agents.all()) {
      if (liveIds.has(agent.agentId)) continue;
      this.releasePendingClone(agent.agentId);
      this.allocator.releaseAgent(agent.agentId);
      this.statusOverlay.detachAgent(agent.agentId);
      this.liveAgentSignatures.delete(agent.agentId);
      if (this.agents.remove(agent.agentId)) removed += 1;
    }
    if (added || removed) this.notifyRoster();
    return { added, removed, dispatched };
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

  selectAgent(agentId: string, announce = true): boolean {
    if (!this.sceneReady) return false;
    const selected = this.agents?.select(agentId) ?? false;
    if (selected) {
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('pixelverse:track-agent',{detail:{id:agentId}}));
      this.notifyRoster();
      if (announce) this.notifyCommandSelection({ kind: 'agent', id: agentId });
    }
    return selected;
  }

  selectBuilding(buildingId: string, announce = true): boolean {
    const resolvedBuildingId = buildingIdForCommandRoom(buildingId);
    const exists = (this.worldDefinition?.buildings ?? WORLD_DEFINITION.buildings).some(({ id }) => id === resolvedBuildingId);
    if (!this.sceneReady || !exists) return false;
    this.cutawaySystem?.open(resolvedBuildingId);
    if (announce) this.notifyCommandSelection({ kind: 'building', id: commandRoomForBuilding(resolvedBuildingId) });
    return true;
  }

  focusCommandSelection(selection: CommandFocusSelection): boolean {
    if (selection.kind === 'agent') return this.selectAgent(selection.id, false);
    if (selection.kind === 'building') return this.selectBuilding(selection.id, false);
    if (!['event', 'hook'].includes(selection.kind)) return false;
    const event = selection.kind === 'event'
      ? this.lastLiveSnapshot?.events?.find((item) => String(item.id ?? item.event_id ?? item.eventId ?? '') === selection.id)
      : undefined;
    if (!event && !selection.agentId && !selection.buildingId) return false;
    const payload = event?.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {};
    const agentId = String(selection.agentId ?? event?.agent ?? event?.agent_id ?? event?.agentId ?? payload.agent ?? '');
    const backendAgent = this.lastLiveSnapshot?.agents.find(({ agent }) => agent === agentId);
    const buildingId = String(
      selection.buildingId ?? event?.buildingId ?? event?.building_id ?? event?.room_key
      ?? payload.buildingId ?? payload.room_key
      ?? backendAgent?.room_key ?? '',
    );
    const selectedAgent = agentId ? this.selectAgent(agentId, false) : false;
    const selectedBuilding = buildingId ? this.selectBuilding(buildingId, false) : false;
    return selectedAgent || selectedBuilding;
  }

  immersionContext() {
    return { agents: this.agents.all(), cutaway: this.cutawaySystem, snapshot: this.lastLiveSnapshot };
  }

  selectedAgentId(): string { return this.sceneReady ? (this.agents?.selected()?.agentId ?? '') : ''; }
  selectedAgentPresence(): AgentPresence {
    return this.sceneReady && this.agents?.selected()
      ? this.agents.selected().presence()
      : { kind: 'outside' };
  }
  selectedAgent(): import('../agents/AgentController').AgentController { return this.agents.selected(); }
  setInteriorFocused(open: boolean): void {
    this.focusController ??= new InteriorFocusController();
    this.focusController.setFocused(open);
  }
  setLocale(locale: VillageLocale): void {
    this.locale = locale;
    this.cutawaySystem?.setLocale(locale);
    this.statusOverlay?.setLocale(locale);
  }
  onRosterChanged(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onCommandSelection(listener: (selection: CommandFocusSelection) => void): () => void {
    this.commandSelectionListeners.add(listener);
    return () => this.commandSelectionListeners.delete(listener);
  }

  private notifyRoster(): void { this.listeners.forEach((listener) => listener()); }
  private notifyCommandSelection(selection: CommandFocusSelection): void {
    this.commandSelectionListeners?.forEach((listener) => listener(selection));
  }
  private attachCutawaySystem(system: InteriorCutawaySystem): void {
    this.cutawaySystem = system;
    system.setLocale(this.locale);
  }
  private attachStatusOverlay(system: StatusOverlaySystem): void {
    this.statusOverlay = system;
    system.setLocale(this.locale);
    this.statusFocusUnregister?.();
    if (typeof system.setExteriorLabelsVisible !== 'function') return;
    let visible = true;
    const target: InteriorFocusTarget = {
      visible: () => visible,
      setVisible: (nextVisible) => {
        visible = nextVisible;
        system.setExteriorLabelsVisible(nextVisible);
      },
    };
    this.focusController ??= new InteriorFocusController();
    this.statusFocusUnregister = this.focusController.register(target);
  }

  private releasePendingClone(agentId: string): void { this.pendingCloneAgents.delete(agentId); }

  private bindAgentSelection(agent: import('../agents/AgentController').AgentController): void {
    agent.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectAgent(agent.agentId));
  }

  private cleanupAgents(): void {
    if (this.cleanupComplete) return;
    this.cleanupComplete = true;
    this.sceneReady = false;
    this.cutawaySystem?.destroy();
    this.cutawaySystem = undefined;
    this.focusController?.destroy();
    this.statusFocusUnregister = undefined;
    this.statusOverlay?.destroy();
    this.atmosphere?.destroy();
    this.atmosphere = undefined;
    this.animalSystem?.destroy();
    this.animalSystem = undefined;
    this.agents?.destroy();
    this.pendingCloneAgents.clear();
    this.liveAgentSignatures?.clear();
    this.listeners.clear();
    this.commandSelectionListeners?.clear();
    this.lastLiveSnapshot = undefined;
  }

}

import { createGame } from './game/createGame';
import { connectProductionLocaleIngress } from './game/productionLocaleIngress';
import type { WorldScene } from './scenes/WorldScene';
import { mountTestPanel } from './ui/TestPanel';
import { LiveWorldClient } from './live/LiveWorldClient';
import {
  readVillageCamera,
  shouldHandleVillageWheel,
  shouldStartVillagePan,
  writeVillageCamera,
  type VillageViewportController,
} from './game/VillageViewportController';
import './styles.css';
import { villageCopy, type VillageLocale } from './i18n/villageLocale';

let activeLocale: VillageLocale = 'zh-TW';
let activeWorld: WorldScene | undefined;
const localeIngress = connectProductionLocaleIngress();

function mountViewportControls(viewport: VillageViewportController): void {
  const shell = document.querySelector<HTMLElement>('#app-shell');
  const gameRoot = document.querySelector<HTMLElement>('#game-root');
  if (!shell || !gameRoot) return;
  const controls = document.createElement('nav');
  controls.id = 'village-zoom-controls';
  controls.setAttribute('aria-label', '村莊縮放控制');
  controls.innerHTML = `
    <button type="button" data-zoom="out" aria-label="縮小村莊">−</button>
    <button type="button" data-zoom="fit" aria-label="完整顯示村莊"><span>Fit</span><output>100%</output></button>
    <button type="button" data-zoom="in" aria-label="放大村莊">+</button>
  `;
  viewport.restore(readVillageCamera(sessionStorage, 'fit'));
  const output = controls.querySelector<HTMLOutputElement>('output');
  const localizeControls = () => {
    const copy = villageCopy(activeLocale).controls;
    controls.setAttribute('aria-label', copy.reset);
    controls.querySelector<HTMLButtonElement>('[data-zoom="out"]')?.setAttribute('aria-label', copy.zoomOut);
    controls.querySelector<HTMLButtonElement>('[data-zoom="in"]')?.setAttribute('aria-label', copy.zoomIn);
    controls.querySelector<HTMLButtonElement>('[data-zoom="fit"]')?.setAttribute('aria-label', viewport.mode === 'fit' ? copy.cover : copy.fit);
    const label = controls.querySelector<HTMLElement>('[data-zoom="fit"] span');
    if (label) label.textContent = viewport.mode === 'fit' ? copy.cover : copy.fit;
  };
  window.addEventListener('pixelverse:locale', localizeControls);
  const updateOutput = () => { if (output) output.value = `${Math.round(viewport.multiplier * 100)}%`; };
  const persistAndUpdate = () => {
    writeVillageCamera(sessionStorage, viewport.state());
    updateOutput();
    localizeControls();
  };
  controls.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-zoom]');
    if (!button) return;
    if (button.dataset.zoom === 'in') viewport.zoomBy(.15);
    else if (button.dataset.zoom === 'out') viewport.zoomBy(-.15);
    else if (viewport.mode === 'fit') viewport.cover();
    else viewport.fit();
    persistAndUpdate();
  });
  gameRoot.addEventListener('wheel', (event) => {
    if (!shouldHandleVillageWheel({
      cutawayOpen: Boolean(document.querySelector('.cutaway-dom-panel')),
      deltaY: event.deltaY,
    })) return;
    event.preventDefault();
    const rect = gameRoot.getBoundingClientRect();
    viewport.zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * .0012));
    persistAndUpdate();
  }, { passive: false });
  let drag: { pointerId: number; x: number; y: number; committed: boolean } | undefined;
  gameRoot.addEventListener('pointerdown', (event) => {
    if (!shouldStartVillagePan({
      button: event.button,
      overControls: Boolean((event.target as HTMLElement).closest('#village-zoom-controls')),
      cutawayOpen: Boolean(document.querySelector('.cutaway-dom-panel')),
    })) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, committed: false };
  }, true);
  gameRoot.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.committed && Math.hypot(dx, dy) < 6) return;
    if (!drag.committed) {
      drag.committed = true;
      gameRoot.setPointerCapture?.(event.pointerId);
      gameRoot.dataset.panning = 'true';
    }
    viewport.panBy(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    persistAndUpdate();
    event.preventDefault();
  });
  const finishDrag = () => {
    drag = undefined;
    delete gameRoot.dataset.panning;
  };
  gameRoot.addEventListener('pointerup', finishDrag);
  gameRoot.addEventListener('pointercancel', finishDrag);
  controls.querySelector('[data-zoom="fit"]')?.addEventListener('dblclick', () => {
    viewport.cover();
    persistAndUpdate();
  });
  shell.append(controls);
  localizeControls();
  updateOutput();
}

createGame('game-root', (world: WorldScene) => {
  localeIngress.attachWorld(world);
  activeWorld = world;
  const root = document.querySelector<HTMLElement>('#test-panel-root');
  if (!root) throw new Error('Missing #test-panel-root');
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
  if (!embedded) mountTestPanel(root, world);
  else root.hidden = true;
  const live = new LiveWorldClient(
    ({ snapshot, sequence }) => world.syncLiveSnapshot(snapshot, sequence),
    (message) => {
      if (!message) return;
      activeLocale = message.locale;
      activeWorld?.setLocale(activeLocale);
      document.documentElement.lang = activeLocale;
      window.dispatchEvent(new Event('pixelverse:locale'));
    },
  );
  live.start();
  world.events.once('shutdown', () => live.destroy());
}, mountViewportControls);

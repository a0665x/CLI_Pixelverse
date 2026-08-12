import { createGame } from './game/createGame';
import { connectProductionLocaleIngress } from './game/productionLocaleIngress';
import type { WorldScene } from './scenes/WorldScene';
import { mountTestPanel } from './ui/TestPanel';
import './styles.css';

const localeIngress = connectProductionLocaleIngress();

createGame('game-root', (world: WorldScene) => {
  localeIngress.attachWorld(world);
  const root = document.querySelector<HTMLElement>('#test-panel-root');
  if (!root) throw new Error('Missing #test-panel-root');
  mountTestPanel(root, world);
});

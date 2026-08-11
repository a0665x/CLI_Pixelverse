import { createGame } from './game/createGame';
import type { WorldScene } from './scenes/WorldScene';
import { mountTestPanel } from './ui/TestPanel';
import './styles.css';

createGame('game-root', (world: WorldScene) => {
  const root = document.querySelector<HTMLElement>('#test-panel-root');
  if (!root) throw new Error('Missing #test-panel-root');
  mountTestPanel(root, world);
});

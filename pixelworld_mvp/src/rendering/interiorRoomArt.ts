import type Phaser from 'phaser';
import type { InteriorDefinition } from '../world/types';
import { buildingPalette } from './villageArtDirection';

/** Floor-only decoration: visual materials never become invisible navigation obstacles. */
export function paintInteriorRoom(
  g: Phaser.GameObjects.Graphics, room: InteriorDefinition, buildingId: string,
  x: number, y: number, cell: number,
): void {
  const colors = buildingPalette(buildingId);
  const w = room.width * cell, h = room.height * cell;
  const pixel = Math.max(1, Math.round(cell / 16));
  g.fillStyle(colors.trim).fillRect(x - 7, y - 7, w + 14, h + 14);
  const swatches = room.floor === 'wood' ? colors.wood : colors.stone;
  const rows = room.floor === 'wood' ? room.height * 2 : room.height;
  const rowH = h / rows;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < room.width; column++) {
      const left = x + column * cell;
      const top = y + row * rowH;
      g.fillStyle(swatches[row % swatches.length]!).fillRect(left, top, cell, rowH);
      g.fillStyle(colors.trim, room.floor === 'wood' ? .16 : .12).fillRect(left, top + rowH - pixel, cell, pixel);
      if ((column + row) % 3 === 0) {
        g.fillStyle(colors.trim, .18).fillRect(left, top, pixel, rowH);
        if (room.floor === 'wood') g.fillStyle(0xffefd1, .16).fillRect(left + pixel * 3, top + pixel * 2, cell * .6, pixel);
      }
    }
  }
  // Woven sitting/work rug, off the doorway. Its inset border reads at low zoom.
  const rugX = x + cell * 1.5, rugY = y + cell * (room.height > 9 ? 6.5 : 4.5);
  const rugW = cell * 4.5, rugH = cell * (room.height > 9 ? 3.3 : 2.6);
  g.fillStyle(colors.trim, .15).fillRect(rugX + pixel * 2, rugY + pixel * 3, rugW, rugH);
  g.fillStyle(colors.rug).fillRect(rugX, rugY, rugW, rugH);
  g.lineStyle(pixel * 2, 0xf1d6a1, .65).strokeRect(rugX + pixel * 3, rugY + pixel * 3, rugW - pixel * 6, rugH - pixel * 6);
  for (let i = 0; i < rugW; i += pixel * 4) {
    g.fillStyle(0xe6cea4, .65).fillRect(rugX + i, rugY - pixel, pixel * 2, pixel);
    g.fillRect(rugX + i, rugY + rugH, pixel * 2, pixel);
  }
  // Timber wainscot and two inset daylight windows sit above the walkable floor.
  g.fillStyle(colors.wall).fillRect(x - 5, y, w + 10, cell * .7);
  g.fillStyle(colors.trim).fillRect(x - 5, y + cell * .7 - pixel * 2, w + 10, pixel * 2);
  for (const ratio of [.24, .76]) {
    const wx = x + w * ratio - cell * .55, wy = y + cell * .1;
    g.fillStyle(colors.trim).fillRect(wx - pixel, wy - pixel, cell * 1.1 + pixel * 2, cell * .35 + pixel * 2);
    g.fillStyle(0xb7d9cf).fillRect(wx, wy, cell * 1.1, cell * .35);
    g.fillStyle(0xf7e4b6).fillRect(wx + cell * .52, wy, pixel, cell * .35);
    g.fillStyle(0xffecc4, .08).fillRect(wx, y + cell * .7, cell * 1.1, cell * 1.3);
  }
  // Visible threshold makes the south entry legible without changing collision geometry.
  g.fillStyle(colors.trim).fillRect(x + Math.floor(room.width / 2) * cell, y + h - pixel * 3, cell, pixel * 3);
  g.lineStyle(pixel, colors.trim).strokeRect(x - 5, y - 5, w + 10, h + 10);
}

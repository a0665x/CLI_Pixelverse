import type Phaser from 'phaser';

// Native pixel geometry. The solid mattress completes the bundled open bed frame.
export const BED_MATTRESS = { x: 14, y: 10, width: 21, height: 28 } as const;
export function completeVillageBed(scene: Phaser.Scene): void {
  const source = scene.textures?.get?.('village-furniture-bed')?.getSourceImage?.();
  if (!source || !scene.textures.createCanvas) return;
  const texture = scene.textures.createCanvas('village-furniture-bed-complete', 48, 48);
  if (!texture) return;
  const context = texture.context;
  context.imageSmoothingEnabled = false;
  context.drawImage(source as HTMLImageElement, 0, 0);
  context.fillStyle = '#f5e6bf';
  context.fillRect(BED_MATTRESS.x, BED_MATTRESS.y, BED_MATTRESS.width, BED_MATTRESS.height);
  context.fillStyle = '#7a987e'; context.fillRect(14, 19, 21, 19);
  context.fillStyle = '#91ae90'; context.fillRect(16, 21, 17, 2);
  context.fillStyle = '#607b69'; context.fillRect(14, 35, 21, 3);
  context.fillStyle = '#fff5d7'; context.fillRect(17, 12, 15, 5);
  texture.refresh();
}

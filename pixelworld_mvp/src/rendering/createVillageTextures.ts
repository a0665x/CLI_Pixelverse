import Phaser from 'phaser';

function generate(scene: Phaser.Scene, key: string, width: number, height: number, draw: (graphics: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function createVillageTextures(scene: Phaser.Scene): void {
  generate(scene, 'terrain-grass', 16, 16, (g) => { g.fillStyle(0x78ad58).fillRect(0, 0, 16, 16); g.fillStyle(0x6c9f4f).fillRect(3, 4, 1, 2).fillRect(12, 9, 1, 2); });
  generate(scene, 'terrain-path', 16, 16, (g) => { g.fillStyle(0xd6bd7b).fillRect(0, 0, 16, 16); g.fillStyle(0xc4a96b).fillRect(2, 3, 2, 1).fillRect(10, 12, 3, 1); });
  generate(scene, 'terrain-water', 16, 16, (g) => { g.fillStyle(0x4f9bc4).fillRect(0, 0, 16, 16); g.fillStyle(0x7fc7de).fillRect(2, 4, 8, 1).fillRect(7, 11, 7, 1); });
  generate(scene, 'tree-trunk', 16, 16, (g) => { g.fillStyle(0x6e4529).fillRect(5, 0, 6, 16); g.fillStyle(0x9a6538).fillRect(6, 1, 2, 14); });
  generate(scene, 'tree-canopy', 48, 48, (g) => { g.fillStyle(0x245c35).fillCircle(24, 24, 22); g.fillStyle(0x3d8a48).fillCircle(18, 18, 16).fillCircle(31, 20, 13); g.fillStyle(0x62ad55).fillRect(13, 9, 12, 5).fillRect(28, 15, 7, 4); });
  generate(scene, 'flower-bed', 16, 16, (g) => { g.fillStyle(0x52783f).fillRect(0, 0, 16, 16); g.fillStyle(0xf6d365).fillRect(3, 4, 2, 2).fillRect(11, 10, 2, 2); g.fillStyle(0xf58aa6).fillRect(9, 3, 2, 2).fillRect(4, 12, 2, 2); });
}

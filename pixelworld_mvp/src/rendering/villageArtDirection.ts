/** Restrained daylight palette: painted timber, warm stone and botanical greens. */
export interface VillagePalette {
  roof: number;
  wall: number;
  wood: readonly [number, number, number];
  stone: readonly [number, number, number];
  rug: number;
  trim: number;
  furniture: number;
}
const palette = (roof: number, wall: number, rug: number, wood: VillagePalette['wood'], furniture = 0xffedcf): VillagePalette => ({
  roof, wall, rug, wood, furniture, stone: [0xb5b8a1, 0xa9ae98, 0x969e8c], trim: 0x655344,
});
export const BUILDING_PALETTES: Readonly<Record<string, VillagePalette>> = {
  'arrival-lodge': palette(0xffdda7, 0xe6d3a6, 0x9a594c, [0xc99f6c, 0xd5ad79, 0xb78e60]),
  'thinkers-cottage': palette(0xdde8ae, 0xd6ddbc, 0x718673, [0xb9a47e, 0xc7b48c, 0xaa9673]),
  'archive-library': palette(0xe0d1fa, 0xdad0be, 0x78617e, [0xbb986f, 0xc8a67b, 0xaa8761]),
  'network-lab': palette(0xb7e9e2, 0xc6dcd0, 0x4f8584, [0xc2b59b, 0xcfc2a7, 0xb2a58c], 0xe6fff2),
  'heartbeat-tower': palette(0xffe4a8, 0xe4d9ad, 0x9b8050, [0xc5aa7d, 0xd3b88a, 0xb59a6d]),
  'offline-dormitory': palette(0xcdd1ef, 0xd1cfdc, 0x777a9a, [0xb4a293, 0xc2b0a0, 0xa49283]),
  'maker-workshop': palette(0xffd69e, 0xe4c49f, 0xb27b46, [0xc49b6c, 0xd3ab7b, 0xb68a5c]),
  'tool-smithy': palette(0xf4c2a8, 0xcbb6a3, 0x8f6355, [0xaa8d73, 0xb89b81, 0x9a7d63]),
  'awaiting-post': palette(0xffecc5, 0xe3dbb8, 0x6e8c77, [0xc9b087, 0xd7be96, 0xb9a078]),
  'collaboration-barn': palette(0xcfe6ae, 0xd3d4b0, 0x8c6455, [0xc49e70, 0xd2ad80, 0xb48e60]),
  'recovery-clinic': palette(0xf4d8dc, 0xd7dfca, 0x739389, [0xcac0a8, 0xd8ceb6, 0xbab098], 0xf4ffeb),
  'rest-cabin': palette(0xe9d5ab, 0xe6d4b1, 0xa67859, [0xd0ac7b, 0xddb98a, 0xbf9b6b]),
};
export const buildingPalette = (id: string): VillagePalette => BUILDING_PALETTES[id] ?? BUILDING_PALETTES['arrival-lodge']!;

/** Seeded variations keep the ground stable across frames and reloads. */
export function grassTint(x: number, y: number): number {
  return [0xcce4cd, 0xcee6cf, 0xcbe3cb, 0xcde5cd][Math.abs(x * 13 + y * 7 + x * y) % 4]!;
}

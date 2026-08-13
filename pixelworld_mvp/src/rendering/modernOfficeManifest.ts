export interface ModernOfficeAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export type ModernOfficeFurnitureKind =
  | 'sofa' | 'office-chair' | 'computer' | 'bookcase' | 'whiteboard' | 'display'
  | 'desk' | 'meeting-table' | 'cabinet' | 'plant' | 'beverage-station' | 'printer';

const ROOT = '/assets/private/modern-office-v1.2';
const sheet = (key: string, filename: string, frameWidth = 16, frameHeight = 16): ModernOfficeAsset => ({
  key: `modern-office-v1.2-${key}`,
  path: `${ROOT}/${filename}`,
  frameWidth,
  frameHeight,
});
const single = (key: ModernOfficeFurnitureKind, id: number): ModernOfficeAsset =>
  sheet(key, `Modern_Office_Singles_${id}.png`, 32, 48);

export const MODERN_OFFICE_ASSETS = {
  atlas: sheet('atlas', 'Modern_Office_16x16.png'),
  roomBuilder: sheet('room-builder', 'Room_Builder_Office_16x16.png'),
  furniture: {
    sofa: single('sofa', 200),
    'office-chair': single('office-chair', 101),
    computer: single('computer', 225),
    bookcase: single('bookcase', 176),
    whiteboard: single('whiteboard', 171),
    display: single('display', 129),
    desk: single('desk', 193),
    'meeting-table': single('meeting-table', 4),
    cabinet: single('cabinet', 175),
    plant: single('plant', 98),
    'beverage-station': single('beverage-station', 173),
    printer: single('printer', 177),
  },
} as const;

export function modernOfficeAsset(kind: ModernOfficeFurnitureKind): ModernOfficeAsset {
  return MODERN_OFFICE_ASSETS.furniture[kind];
}

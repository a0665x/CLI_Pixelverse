export const OFFICE_LIFE_PACK = {
  name: 'Pixel Life: Office Essentials',
  author: 'Chris Perich',
  sourceUrl: 'https://christianperich.itch.io/pixel-life-office-essentials',
  license: 'Creative Commons Attribution 4.0 International',
  gridSize: 32,
  notes: 'Optional local override pack. Do not redistribute standalone asset files from paid downloads.',
};

export const HIGH_CLARITY_OFFICE_PROPS = new Set([
  'bed',
  'board',
  'bookshelf',
  'cabinet',
  'chair',
  'coffee',
  'desk',
  'locker',
  'portal',
  'server',
  'sofa',
  'table',
  'terminal',
  'workbench',
]);

export function shouldUseHighClarityProp(type = '') {
  return HIGH_CLARITY_OFFICE_PROPS.has(type);
}

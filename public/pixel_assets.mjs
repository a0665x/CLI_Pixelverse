const SVG_NS = 'http://www.w3.org/2000/svg';

function svgDataUri(inner, viewBox = '0 0 32 32') {
  const svg = `<svg xmlns="${SVG_NS}" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function rect(x, y, width, height, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
}

function circle(cx, cy, r, fill, extra = '') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

function line(x1, y1, x2, y2, stroke, width = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" />`;
}

function accentForState(state, color) {
  if (state === 'thinking') return '#fbbf24';
  if (state === 'planning') return '#67e8f9';
  if (state === 'working') return '#4ade80';
  if (state === 'offline') return '#ef4444';
  return color;
}

function roleBodyColor(role, color) {
  if (role === 'subagent') return '#9f7aea';
  if (role === 'branch_session') return '#38bdf8';
  return color;
}

function eyeSet(facing = 'right') {
  if (facing === 'left') {
    return `${rect(11, 9, 2, 2, '#111827')}${rect(15, 10, 2, 2, '#111827')}`;
  }
  if (facing === 'up') {
    return `${rect(11, 9, 2, 2, '#111827')}${rect(15, 9, 2, 2, '#111827')}`;
  }
  return `${rect(11, 10, 2, 2, '#111827')}${rect(15, 9, 2, 2, '#111827')}`;
}

function armPose(frame = 0) {
  return frame % 2 === 0
    ? `${rect(8, 15, 2, 6, '#f0c9a4')}${rect(22, 16, 2, 5, '#f0c9a4')}`
    : `${rect(7, 16, 2, 5, '#f0c9a4')}${rect(23, 15, 2, 6, '#f0c9a4')}`;
}

function legPose(frame = 0) {
  return frame % 2 === 0
    ? `${rect(11, 22, 4, 8, '#334155')}${rect(18, 21, 4, 9, '#334155')}`
    : `${rect(10, 21, 4, 9, '#334155')}${rect(18, 22, 4, 8, '#334155')}`;
}

export function createAgentSprite({ role = 'main_agent', state = 'idle', color = '#60a5fa', facing = 'right', frame = 0 } = {}) {
  const accent = accentForState(state, color);
  const body = roleBodyColor(role, color);
  const bag = role === 'subagent' ? '#fde68a' : role === 'branch_session' ? '#bfdbfe' : '#fbcfe8';
  const accessory = state === 'planning' ? '#22d3ee' : state === 'thinking' ? '#fde047' : state === 'working' ? '#86efac' : '#cbd5e1';
  const hairShift = facing === 'left' ? 1 : facing === 'right' ? -1 : 0;
  return svgDataUri([
    rect(8, 27, 16, 3, accent, 'opacity="0.28"'),
    rect(11, 4, 10, 8, '#f0c9a4'),
    rect(10 + hairShift, 3, 12, 3, '#0f172a'),
    rect(9 + hairShift, 5, 2, 4, '#0f172a'),
    rect(21 + hairShift, 5, 2, 4, '#0f172a'),
    eyeSet(facing),
    rect(13, 12, 6, 1, '#9a3412'),
    rect(9, 13, 14, 10, body),
    rect(12, 14, 8, 2, '#0f172a', 'opacity="0.18"'),
    armPose(frame),
    legPose(frame),
    rect(14, 14, 4, 3, accessory),
    rect(20, 16, 3, 5, bag),
    rect(3, 4, 6, 6, accent),
    rect(5, 6, 2, 2, '#f8fafc'),
    state === 'working' ? rect(24, 5, 4, 4, '#34d399') : '',
    state === 'thinking' ? circle(26, 7, 2, '#fde68a') : '',
    state === 'planning' ? rect(24, 5, 4, 4, '#67e8f9') : '',
    state === 'offline' ? rect(24, 5, 4, 4, '#f87171') : '',
  ].join(''));
}

export function createPropSprite(type = 'desk') {
  switch (type) {
    case 'bookshelf':
      return svgDataUri([
        rect(3, 4, 26, 24, '#5b3518'),
        rect(5, 6, 22, 20, '#7a4a22'),
        rect(6, 8, 4, 16, '#f8d88a'),
        rect(11, 8, 3, 16, '#60a5fa'),
        rect(15, 8, 4, 16, '#f472b6'),
        rect(20, 8, 3, 16, '#a78bfa'),
        rect(24, 8, 2, 16, '#fde68a'),
        line(5, 15, 27, 15, '#3f2412', 1),
      ].join(''));
    case 'desk':
      return svgDataUri([
        rect(3, 8, 26, 16, '#5b3414'),
        rect(5, 6, 22, 16, '#9a642f'),
        rect(6, 8, 20, 3, '#c8893d'),
        rect(7, 13, 7, 6, '#704117'),
        rect(18, 13, 7, 6, '#704117'),
        rect(13, 7, 7, 4, '#1f2937'),
        rect(14, 8, 5, 2, '#67e8f9'),
        rect(22, 7, 2, 3, '#fde68a'),
      ].join(''));
    case 'table':
      return svgDataUri([
        rect(3, 9, 26, 15, '#7c2d12'),
        rect(5, 7, 22, 15, '#b7791f'),
        rect(7, 10, 18, 2, '#d69e2e'),
        rect(9, 14, 6, 4, '#bfdbfe'),
        rect(17, 14, 7, 4, '#93c5fd'),
        rect(6, 23, 3, 5, '#5b3414'),
        rect(23, 23, 3, 5, '#5b3414'),
      ].join(''));
    case 'terminal':
      return svgDataUri([
        rect(4, 5, 24, 18, '#111827'),
        rect(7, 7, 18, 11, '#0f172a'),
        rect(9, 9, 13, 2, '#67e8f9'),
        rect(9, 13, 9, 2, '#22c55e'),
        rect(10, 20, 12, 3, '#475569'),
        rect(6, 24, 20, 4, '#1e293b'),
        rect(8, 25, 2, 2, '#cbd5e1'),
        rect(12, 25, 2, 2, '#cbd5e1'),
        rect(16, 25, 2, 2, '#cbd5e1'),
      ].join(''));
    case 'workbench':
      return svgDataUri([
        rect(3, 9, 26, 15, '#14532d'),
        rect(5, 7, 22, 14, '#22c55e'),
        rect(7, 10, 5, 5, '#fbbf24'),
        rect(14, 10, 6, 3, '#f87171'),
        rect(21, 10, 4, 5, '#c084fc'),
        rect(7, 17, 18, 2, '#166534'),
        rect(6, 23, 3, 5, '#14532d'),
        rect(23, 23, 3, 5, '#14532d'),
      ].join(''));
    case 'cabinet':
    case 'locker':
      return svgDataUri([
        rect(5, 3, 22, 26, '#334155'),
        rect(7, 5, 18, 22, '#64748b'),
        rect(8, 7, 16, 8, '#94a3b8'),
        rect(8, 17, 16, 8, '#475569'),
        rect(21, 10, 2, 2, '#f8fafc'),
        rect(21, 20, 2, 2, '#f8fafc'),
        line(7, 16, 25, 16, '#1e293b', 1),
      ].join(''));
    case 'board':
      return svgDataUri([
        rect(2, 3, 28, 21, '#5b3414'),
        rect(4, 5, 24, 17, '#0f766e'),
        rect(7, 8, 15, 2, '#f8fafc'),
        rect(7, 12, 10, 2, '#fde68a'),
        rect(7, 16, 14, 2, '#7dd3fc'),
        rect(23, 9, 3, 8, '#f8fafc'),
        rect(6, 24, 3, 6, '#5b3414'),
        rect(23, 24, 3, 6, '#5b3414'),
      ].join(''));
    case 'lamp':
      return svgDataUri([
        rect(14, 7, 4, 11, '#94a3b8'),
        rect(10, 3, 12, 6, '#fde68a'),
        rect(8, 22, 16, 4, '#64748b'),
      ].join(''));
    case 'plant':
      return svgDataUri([
        rect(12, 5, 8, 6, '#22c55e'),
        rect(9, 9, 14, 8, '#16a34a'),
        rect(9, 18, 14, 8, '#92400e'),
      ].join(''));
    case 'chair':
      return svgDataUri([
        rect(10, 6, 12, 8, '#6b21a8'),
        rect(8, 12, 16, 13, '#a855f7'),
        rect(10, 14, 12, 8, '#c084fc'),
        rect(7, 24, 4, 4, '#4c1d95'),
        rect(21, 24, 4, 4, '#4c1d95'),
      ].join(''));
    case 'bed':
      return svgDataUri([
        rect(3, 5, 26, 23, '#1d4ed8'),
        rect(5, 7, 22, 19, '#60a5fa'),
        rect(6, 8, 9, 7, '#e2e8f0'),
        rect(16, 8, 10, 16, '#93c5fd'),
        rect(6, 17, 9, 7, '#bfdbfe'),
        rect(3, 26, 4, 3, '#1e3a8a'),
        rect(25, 26, 4, 3, '#1e3a8a'),
      ].join(''));
    case 'portal':
      return svgDataUri([
        rect(8, 4, 16, 4, '#6d28d9'),
        rect(6, 8, 20, 16, '#8b5cf6'),
        rect(10, 10, 12, 12, '#f5d0fe'),
        rect(11, 24, 10, 4, '#4c1d95'),
      ].join(''));
    case 'crate':
      return svgDataUri([
        rect(6, 8, 20, 18, '#92400e'),
        rect(8, 12, 16, 2, '#fbbf24'),
        rect(8, 18, 16, 2, '#fbbf24'),
        rect(14, 8, 3, 18, '#d97706'),
      ].join(''));
    case 'charger':
      return svgDataUri([
        rect(7, 18, 18, 8, '#0f172a'),
        rect(11, 8, 10, 10, '#38bdf8'),
        rect(14, 4, 4, 6, '#fbbf24'),
      ].join(''));
    case 'sofa':
      return svgDataUri([
        rect(4, 10, 24, 14, '#be185d'),
        rect(6, 7, 20, 8, '#fb7185'),
        rect(7, 14, 8, 7, '#f472b6'),
        rect(17, 14, 8, 7, '#f472b6'),
        rect(4, 23, 5, 4, '#831843'),
        rect(23, 23, 5, 4, '#831843'),
      ].join(''));
    case 'coffee':
      return svgDataUri([
        rect(8, 6, 12, 18, '#475569'),
        rect(10, 8, 8, 5, '#0f172a'),
        rect(21, 10, 3, 12, '#94a3b8'),
        rect(9, 24, 12, 3, '#1e293b'),
      ].join(''));
    case 'server':
      return svgDataUri([
        rect(7, 4, 18, 24, '#111827'),
        rect(9, 7, 14, 4, '#334155'),
        rect(9, 13, 14, 4, '#1d4ed8'),
        rect(9, 19, 14, 4, '#16a34a'),
        circle(21, 9, 1, '#38bdf8'),
        circle(21, 15, 1, '#67e8f9'),
        circle(21, 21, 1, '#4ade80'),
      ].join(''));
    case 'window':
      return svgDataUri([
        rect(3, 4, 26, 18, '#bfdbfe'),
        rect(4, 5, 24, 16, '#7dd3fc'),
        rect(15, 5, 2, 16, '#e2e8f0'),
        rect(4, 12, 24, 2, '#e2e8f0'),
        rect(2, 3, 28, 20, '#64748b', 'fill-opacity="0" stroke="#475569" stroke-width="2"'),
      ].join(''));
    case 'rug':
      return svgDataUri([
        rect(3, 10, 26, 12, '#1d4ed8'),
        rect(5, 12, 22, 8, '#60a5fa'),
        line(6, 16, 26, 16, '#bfdbfe', 1),
      ].join(''));
    case 'poster':
      return svgDataUri([
        rect(6, 3, 20, 24, '#f8fafc'),
        rect(8, 6, 16, 6, '#fbbf24'),
        rect(8, 14, 12, 2, '#38bdf8'),
        rect(8, 18, 10, 2, '#34d399'),
        rect(8, 22, 13, 2, '#f472b6'),
        rect(4, 1, 24, 28, '#475569', 'fill-opacity="0" stroke="#475569" stroke-width="2"'),
      ].join(''));
    default:
      return svgDataUri([
        rect(6, 6, 20, 20, '#334155'),
        rect(10, 10, 12, 12, '#94a3b8'),
      ].join(''));
  }
}

const PROP_FX = {
  portal: { className: 'prop-fx-pulse', intensity: 'high' },
  server: { className: 'prop-fx-flicker', intensity: 'medium' },
  terminal: { className: 'prop-fx-terminal', intensity: 'medium' },
  coffee: { className: 'prop-fx-coffee', intensity: 'low' },
  lamp: { className: 'prop-fx-glow', intensity: 'low' },
  board: { className: 'prop-fx-shimmer', intensity: 'low' },
  charger: { className: 'prop-fx-pulse-soft', intensity: 'low' },
};

const ZONE_KIND_FX = {
  scan: { className: 'zone-fx-scan', intensity: 'medium' },
  terminal: { className: 'zone-fx-terminal', intensity: 'medium' },
  server: { className: 'zone-fx-flicker', intensity: 'medium' },
  portal: { className: 'zone-fx-pulse', intensity: 'high' },
  rest: { className: 'zone-fx-rest', intensity: 'low' },
  break: { className: 'zone-fx-rest', intensity: 'low' },
  plan: { className: 'zone-fx-plan', intensity: 'low' },
  briefing: { className: 'zone-fx-plan', intensity: 'low' },
  craft: { className: 'zone-fx-craft', intensity: 'medium' },
  work: { className: 'zone-fx-craft', intensity: 'medium' },
};

const ZONE_KEY_FX = {
  'scanner-nook': { className: 'zone-fx-scan', intensity: 'medium' },
  'clone-nodes': { className: 'zone-fx-flicker', intensity: 'medium' },
  'portal-stage': { className: 'zone-fx-pulse', intensity: 'high' },
  'bed-alcove': { className: 'zone-fx-rest', intensity: 'low' },
};

export function getPropFx(type = '', roomKey = '') {
  return PROP_FX[type] || { className: '', intensity: 'none', roomKey };
}

export function getZoneFx(zone = {}) {
  return ZONE_KEY_FX[zone.key] || ZONE_KIND_FX[zone.kind] || { className: '', intensity: 'none' };
}

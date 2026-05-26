export function supportsEventStream(runtime = globalThis) {
  return typeof runtime?.EventSource === 'function';
}

export function buildStreamUrl(baseHref = 'http://localhost/') {
  const url = new URL(baseHref, 'http://localhost');
  url.pathname = '/api/world/stream';
  url.search = '';
  return url.toString();
}

export function parseStreamMessage(raw = '{}') {
  const payload = JSON.parse(raw);
  return {
    event: payload.event || 'world.update',
    id: Number(payload.id || 0),
    snapshot: payload.snapshot || null,
  };
}

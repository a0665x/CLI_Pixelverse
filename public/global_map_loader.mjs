const FLOW_OBJECT_RE = /^\{(.*)\}$/;
const FLOW_ARRAY_RE = /^\[(.*)\]$/;

function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && line[i - 1] !== '\\') quote = quote === ch ? '' : ch;
    if (ch === '#' && !quote) return line.slice(0, i);
  }
  return line;
}

function splitTopLevel(value, delimiter = ',') {
  const parts = [];
  let current = '';
  let quote = '';
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if ((ch === '"' || ch === "'") && value[i - 1] !== '\\') {
      quote = quote === ch ? '' : ch;
      current += ch;
      continue;
    }
    if (!quote && (ch === '[' || ch === '{')) depth += 1;
    if (!quote && (ch === ']' || ch === '}')) depth -= 1;
    if (!quote && depth === 0 && ch === delimiter) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseScalar(raw = '') {
  const value = raw.trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (FLOW_ARRAY_RE.test(value)) return parseFlowArray(value);
  if (FLOW_OBJECT_RE.test(value)) return parseFlowObject(value);
  const number = Number(value);
  return Number.isFinite(number) && /^-?\d+(\.\d+)?$/.test(value) ? number : value;
}

function parseKeyValue(raw = '') {
  const index = raw.indexOf(':');
  if (index < 0) return [raw.trim(), ''];
  return [raw.slice(0, index).trim(), raw.slice(index + 1).trim()];
}

function parseFlowArray(raw = '') {
  const body = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!body.trim()) return [];
  return splitTopLevel(body).map((item) => parseScalar(item));
}

function parseFlowObject(raw = '') {
  const body = raw.trim().replace(/^\{/, '').replace(/\}$/, '');
  const result = {};
  splitTopLevel(body).forEach((part) => {
    const [key, value] = parseKeyValue(part);
    result[key] = parseScalar(value);
  });
  return result;
}

function lineInfo(line) {
  const clean = stripComment(line);
  if (!clean.trim()) return null;
  return {
    indent: clean.match(/^\s*/)[0].length,
    text: clean.trim(),
  };
}

function parseRoomBlock(lines, startIndex) {
  const room = {};
  let index = startIndex;
  while (index < lines.length) {
    const info = lineInfo(lines[index]);
    if (!info) {
      index += 1;
      continue;
    }
    if (info.indent <= 2) break;
    if (info.indent !== 4) {
      index += 1;
      continue;
    }
    const [key, value] = parseKeyValue(info.text);
    if (key === 'furniture') {
      room.furniture = [];
      index += 1;
      while (index < lines.length) {
        const item = lineInfo(lines[index]);
        if (!item) {
          index += 1;
          continue;
        }
        if (item.indent <= 4) break;
        if (item.indent === 6 && item.text.startsWith('- ')) {
          room.furniture.push(parseScalar(item.text.slice(2).trim()));
        }
        index += 1;
      }
      continue;
    }
    room[key] = parseScalar(value);
    index += 1;
  }
  return { room, index };
}

export function parseGlobalMapYaml(text = '') {
  const lines = String(text).split(/\r?\n/);
  const manifest = { corridors: [], rooms: {} };
  for (let index = 0; index < lines.length;) {
    const info = lineInfo(lines[index]);
    if (!info) {
      index += 1;
      continue;
    }
    if (info.indent !== 0) {
      index += 1;
      continue;
    }
    const [key, value] = parseKeyValue(info.text);
    if (key === 'corridors') {
      index += 1;
      while (index < lines.length) {
        const item = lineInfo(lines[index]);
        if (!item) {
          index += 1;
          continue;
        }
        if (item.indent === 0) break;
        if (item.indent === 2 && item.text.startsWith('- ')) {
          manifest.corridors.push(parseScalar(item.text.slice(2).trim()));
        }
        index += 1;
      }
      continue;
    }
    if (key === 'rooms') {
      index += 1;
      while (index < lines.length) {
        const roomInfo = lineInfo(lines[index]);
        if (!roomInfo) {
          index += 1;
          continue;
        }
        if (roomInfo.indent === 0) break;
        if (roomInfo.indent === 2 && roomInfo.text.endsWith(':')) {
          const roomKey = roomInfo.text.slice(0, -1).trim();
          const parsed = parseRoomBlock(lines, index + 1);
          manifest.rooms[roomKey] = parsed.room;
          index = parsed.index;
          continue;
        }
        index += 1;
      }
      continue;
    }
    manifest[key] = parseScalar(value);
    index += 1;
  }
  return manifest;
}

export async function fetchGlobalMapManifest(url = '/global_map/default.yaml') {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load global map manifest: HTTP ${response.status}`);
  return parseGlobalMapYaml(await response.text());
}

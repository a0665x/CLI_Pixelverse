export const DASHBOARD_CARD_IDS = Object.freeze(['events', 'agents', 'help']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function dashboardCardPage(items, page = 0, pageSize = 1) {
  const source = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.trunc(finite(pageSize, 1)));
  const pageCount = Math.max(1, Math.ceil(source.length / size));
  const resolvedPage = clamp(Math.trunc(finite(page, 0)), 0, pageCount - 1);
  return {
    items: source.slice(resolvedPage * size, (resolvedPage + 1) * size),
    page: resolvedPage,
    pageCount,
    canPrevious: resolvedPage > 0,
    canNext: resolvedPage + 1 < pageCount,
  };
}

const rectFrom = (value = {}) => {
  const left = finite(value.left, finite(value.x));
  const top = finite(value.top, finite(value.y));
  const right = finite(value.right, left + finite(value.width));
  const bottom = finite(value.bottom, top + finite(value.height));
  return { left, top, right, bottom };
};

const intersectRect = (first, second) => {
  const rect = {
    left: Math.max(first.left, second.left),
    top: Math.max(first.top, second.top),
    right: Math.min(first.right, second.right),
    bottom: Math.min(first.bottom, second.bottom),
  };
  return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
};

const subtractRect = (space, exclusion) => {
  const overlap = intersectRect(space, exclusion);
  if (!overlap) return [space];
  return [
    { left: space.left, top: space.top, right: space.right, bottom: overlap.top },
    { left: space.left, top: overlap.bottom, right: space.right, bottom: space.bottom },
    { left: space.left, top: overlap.top, right: overlap.left, bottom: overlap.bottom },
    { left: overlap.right, top: overlap.top, right: space.right, bottom: overlap.bottom },
  ].filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
};

export function placeDashboardCard(triggerRect, cardSize, viewport, exclusions = []) {
  const trigger = rectFrom(triggerRect);
  const desiredWidth = Math.max(0, finite(cardSize?.width));
  const desiredHeight = Math.max(0, finite(cardSize?.height));
  const viewportWidth = Math.max(0, finite(viewport?.width));
  const viewportHeight = Math.max(0, finite(viewport?.height));
  const margin = Math.max(0, finite(viewport?.margin, 8));
  const gap = Math.max(0, finite(viewport?.gap, 8));
  const bounds = {
    left: Math.min(margin, viewportWidth),
    top: Math.min(margin, viewportHeight),
    right: Math.max(Math.min(margin, viewportWidth), viewportWidth - margin),
    bottom: Math.max(Math.min(margin, viewportHeight), viewportHeight - margin),
  };
  const blocked = (Array.isArray(exclusions) ? exclusions : [])
    .filter(Boolean)
    .map(rectFrom)
    .map((rect) => ({
      left: rect.left - gap,
      top: rect.top - gap,
      right: rect.right + gap,
      bottom: rect.bottom + gap,
    }))
    .map((rect) => intersectRect(rect, bounds))
    .filter(Boolean);
  const availableWidth = Math.max(0, bounds.right - bounds.left);
  const availableHeight = Math.max(0, bounds.bottom - bounds.top);
  const targetWidth = Math.min(desiredWidth, availableWidth);
  const targetHeight = Math.min(desiredHeight, availableHeight);
  const minimumWidth = Math.min(targetWidth, Math.max(1, finite(viewport?.minimumCardWidth, 240)));
  const minimumHeight = Math.min(targetHeight, Math.max(1, finite(viewport?.minimumCardHeight, 220)));
  const ideal = {
    left: clamp(trigger.right - targetWidth, bounds.left, bounds.right - targetWidth),
    top: clamp(trigger.bottom + gap, bounds.top, bounds.bottom - targetHeight),
  };
  const fullXs = [ideal.left, bounds.left, bounds.right - targetWidth];
  const fullYs = [ideal.top, bounds.top, bounds.bottom - targetHeight];
  blocked.forEach((rect) => {
    fullXs.push(rect.left - targetWidth, rect.right);
    fullYs.push(rect.top - targetHeight, rect.bottom);
  });
  const fullCandidates = [];
  const seen = new Set();
  fullXs.forEach((rawLeft) => {
    fullYs.forEach((rawTop) => {
      const left = clamp(rawLeft, bounds.left, bounds.right - targetWidth);
      const top = clamp(rawTop, bounds.top, bounds.bottom - targetHeight);
      const key = `${left}:${top}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rect = { left, top, right: left + targetWidth, bottom: top + targetHeight };
      if (blocked.some((exclusion) => intersectRect(rect, exclusion))) return;
      fullCandidates.push({
        left,
        top,
        width: targetWidth,
        height: targetHeight,
        visible: true,
        distance: Math.abs(left - ideal.left) + Math.abs(top - ideal.top),
      });
    });
  });
  fullCandidates.sort((first, second) => (
    first.distance - second.distance
    || first.top - second.top
    || second.left - first.left
  ));
  if (fullCandidates[0]) {
    const { left, top, width, height, visible } = fullCandidates[0];
    return { left, top, width, height, visible };
  }
  let spaces = [bounds];
  blocked.forEach((exclusion) => {
    spaces = spaces.flatMap((space) => subtractRect(space, exclusion));
  });

  const candidates = spaces.flatMap((space) => {
    const spaceWidth = space.right - space.left;
    const spaceHeight = space.bottom - space.top;
    if (spaceWidth < minimumWidth || spaceHeight < minimumHeight) return [];
    const width = Math.min(targetWidth, spaceWidth);
    const height = Math.min(targetHeight, spaceHeight);
    const left = clamp(trigger.right - width, space.left, space.right - width);
    const top = clamp(trigger.bottom + gap, space.top, space.bottom - height);
    const sizePenalty = (targetWidth - width) + (targetHeight - height);
    const distance = Math.abs(left - (trigger.right - width)) + Math.abs(top - (trigger.bottom + gap));
    return [{ left, top, width, height, visible: true, sizePenalty, distance }];
  });
  candidates.sort((first, second) => (
    first.sizePenalty - second.sizePenalty
    || first.distance - second.distance
    || first.top - second.top
    || second.left - first.left
  ));
  const best = candidates[0];
  if (!best) return { left: bounds.left, top: bounds.top, width: 0, height: 0, visible: false };
  return { left: best.left, top: best.top, width: best.width, height: best.height, visible: true };
}

export function dashboardCardPageSize(name, cardSize = {}) {
  if (name === 'help') return 1;
  const height = Math.max(0, finite(cardSize.height));
  const width = Math.max(0, finite(cardSize.width));
  if (height < 320 || width < 300) return 1;
  if (height < 370 || width < 360) return 2;
  return 3;
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function dashboardCardItemMarkup({ title = '', meta = '', detail = '' } = {}) {
  const accessible = [title, meta, detail].filter(Boolean).join(' · ');
  return `<article class="dashboard-card-item" aria-label="${escapeHtml(accessible)}">
    <div class="dashboard-card-item-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
    ${meta ? `<div class="dashboard-card-item-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</div>` : ''}
    <div class="dashboard-card-item-detail dashboard-card-item-detail--clamped" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div>
  </article>`;
}

export function buildDashboardLiveSnapshot(snapshot = {}, nowMs = Date.now()) {
  const serverTimeMs = Number(snapshot.server_time_ms || nowMs);
  const elapsedSeconds = Math.max(0, (nowMs - serverTimeMs) / 1000);
  const staleAfterSeconds = Number(snapshot.stats?.stale_after_seconds || 0);
  const agents = Array.isArray(snapshot.agents)
    ? snapshot.agents.map((agent) => {
      const ageSeconds = Number((Number(agent.age_seconds || 0) + elapsedSeconds).toFixed(1));
      const becameStale = staleAfterSeconds > 0
        && ageSeconds > staleAfterSeconds
        && agent.connection_status !== 'awaiting_attach';
      return becameStale ? {
        ...agent,
        age_seconds: ageSeconds,
        state: 'offline',
        is_stale: true,
        connection_status: 'stale',
        can_delete: true,
      } : {
        ...agent,
        age_seconds: ageSeconds,
      };
    })
    : [];
  return { ...snapshot, server_time_ms: nowMs, agents };
}

export function renderDashboardCardView(view = {}, model = {}) {
  let mutations = 0;
  const setText = (node, value) => {
    const next = String(value ?? '');
    if (!node || node.textContent === next) return;
    node.textContent = next;
    mutations += 1;
  };
  const setBoolean = (node, property, value) => {
    const next = Boolean(value);
    if (!node || node[property] === next) return;
    node[property] = next;
    mutations += 1;
  };
  const signature = String(model.signature ?? '');
  if (view.card && view.card.dataset.renderSignature !== signature) {
    view.card.dataset.renderSignature = signature;
    if (view.items) view.items.innerHTML = String(model.markup ?? '');
    mutations += 1;
  }
  setBoolean(view.settings, 'hidden', !model.settingsVisible);
  setText(view.previous, model.previousLabel);
  setBoolean(view.previous, 'disabled', model.previousDisabled);
  setText(view.next, model.nextLabel);
  setBoolean(view.next, 'disabled', model.nextDisabled);
  setText(view.page, model.pageLabel);
  setText(view.liveStatus, model.liveText);
  const pageSize = String(Math.max(1, Math.trunc(finite(model.pageSize, 1))));
  if (view.items?.style?.getPropertyValue?.('--dashboard-page-size') !== pageSize) {
    view.items?.style?.setProperty?.('--dashboard-page-size', pageSize);
    mutations += 1;
  }
  return mutations;
}

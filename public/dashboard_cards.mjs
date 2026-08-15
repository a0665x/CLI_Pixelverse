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

const intersectionArea = (first, second) => (
  Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
  * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
);

export function placeDashboardCard(triggerRect, cardSize, viewport, exclusions = []) {
  const trigger = rectFrom(triggerRect);
  const width = Math.max(0, finite(cardSize?.width));
  const height = Math.max(0, finite(cardSize?.height));
  const viewportWidth = Math.max(width, finite(viewport?.width));
  const viewportHeight = Math.max(height, finite(viewport?.height));
  const margin = Math.max(0, finite(viewport?.margin, 8));
  const gap = Math.max(0, finite(viewport?.gap, 8));
  const minLeft = Math.min(margin, Math.max(0, viewportWidth - width));
  const minTop = Math.min(margin, Math.max(0, viewportHeight - height));
  const maxLeft = Math.max(minLeft, viewportWidth - margin - width);
  const maxTop = Math.max(minTop, viewportHeight - margin - height);
  const blocked = (Array.isArray(exclusions) ? exclusions : [])
    .filter(Boolean)
    .map(rectFrom)
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  const ideal = {
    left: clamp(trigger.right - width, minLeft, maxLeft),
    top: clamp(trigger.bottom + gap, minTop, maxTop),
  };
  const xs = [ideal.left, minLeft, maxLeft, trigger.left, trigger.right + gap, trigger.left - width - gap];
  const ys = [ideal.top, minTop, maxTop, trigger.top, trigger.bottom + gap, trigger.top - height - gap];
  blocked.forEach((rect) => {
    xs.push(rect.left - width - gap, rect.right + gap, rect.left, rect.right - width);
    ys.push(rect.top - height - gap, rect.bottom + gap, rect.top, rect.bottom - height);
  });

  const candidates = [];
  const seen = new Set();
  xs.forEach((rawLeft) => {
    ys.forEach((rawTop) => {
      const left = clamp(finite(rawLeft), minLeft, maxLeft);
      const top = clamp(finite(rawTop), minTop, maxTop);
      const key = `${left}:${top}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rect = { left, top, right: left + width, bottom: top + height };
      const collisionArea = blocked.reduce((total, exclusion) => total + intersectionArea(rect, exclusion), 0);
      const distance = Math.abs(left - ideal.left) + Math.abs(top - ideal.top);
      candidates.push({ left, top, collisionArea, distance });
    });
  });

  candidates.sort((first, second) => (
    first.collisionArea - second.collisionArea
    || first.distance - second.distance
    || first.top - second.top
    || second.left - first.left
  ));
  const best = candidates[0] || ideal;
  return { left: best.left, top: best.top };
}

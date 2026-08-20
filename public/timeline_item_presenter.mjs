import { localizeToolSummary, timelineItemForLocale } from './ui_strings.mjs';

function localizedExplicitTool(value, locale) {
  if (!value) return '';
  return localizeToolSummary(value, locale) || String(value);
}

export function formatTimelineItemForLocale(locale, item = {}) {
  const toolName = item.tool_name || (item.tool_names || [])[0] || '';
  return timelineItemForLocale(locale, item, {
    toolLabel: localizedExplicitTool(toolName, locale),
    toolRouteLabel: localizedExplicitTool((item.tool_names || []).join(', '), locale),
  });
}

export interface EditorRect { x: number; y: number; width: number; height: number }

export interface InteriorEditorLayout {
  frame: EditorRect;
  header: EditorRect;
  roomToolbar: EditorRect;
  room: EditorRect;
  catalog: EditorRect;
  inspector: EditorRect;
}

export interface InteriorEditorLayoutOptions {
  editMode: boolean;
  catalogExpanded: boolean;
  inspectorExpanded: boolean;
}

export type ContextToolbarSide = 'above' | 'below' | 'left' | 'right';

export interface ContextToolbarPlacement extends EditorRect { side: ContextToolbarSide }

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const interiorInspectorAvailable = (frame: Pick<EditorRect, 'width'>): boolean =>
  frame.width > 0;

export function interiorEditorLayout(
  viewportWidth: number,
  viewportHeight: number,
  options: InteriorEditorLayoutOptions,
  responsiveFrameWidth?: number,
): InteriorEditorLayout {
  const safeViewportWidth = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  const marginX = safeViewportWidth > 16 ? 8 : 0;
  const marginY = safeViewportHeight > 16 ? 8 : 0;
  const width = Math.min(720, Math.max(0, safeViewportWidth - marginX * 2));
  const height = Math.min(495, Math.max(0, safeViewportHeight - marginY * 2));
  const frame = {
    x: Math.max(0, Math.round((safeViewportWidth - width) / 2)),
    y: Math.max(0, Math.round((safeViewportHeight - height) / 2)),
    width,
    height,
  };
  const headerHeight = Math.min(40, height);
  const afterHeader = Math.max(0, height - headerHeight);
  const roomToolbarHeight = options.editMode ? Math.min(32, afterHeader) : 0;
  const availableContentHeight = Math.max(0, afterHeader - roomToolbarHeight);
  const responsiveWidth = responsiveFrameWidth !== undefined && Number.isFinite(responsiveFrameWidth)
    ? Math.max(0, responsiveFrameWidth)
    : width;
  const compactInspector = options.editMode && options.inspectorExpanded && responsiveWidth < 620;
  const catalogHeight = options.editMode && options.catalogExpanded && !compactInspector
    ? Math.min(112, height * 0.28, availableContentHeight)
    : 0;
  const compactInspectorHeight = compactInspector
    ? Math.min(96, height * 0.28, availableContentHeight)
    : 0;
  const inspectorWidth = options.editMode && options.inspectorExpanded && !compactInspector
    ? Math.min(168, width)
    : 0;
  const roomHeight = Math.max(0, availableContentHeight - catalogHeight - compactInspectorHeight);
  const room = {
    x: frame.x,
    y: frame.y + headerHeight + roomToolbarHeight,
    width: Math.max(0, frame.width - inspectorWidth),
    height: roomHeight,
  };
  const bottomY = room.y + room.height;
  return {
    frame,
    header: { x: frame.x, y: frame.y, width: frame.width, height: headerHeight },
    roomToolbar: {
      x: frame.x, y: frame.y + headerHeight, width: frame.width, height: roomToolbarHeight,
    },
    room,
    catalog: { x: frame.x, y: bottomY, width: frame.width, height: catalogHeight },
    inspector: compactInspector
      ? { x: frame.x, y: bottomY, width: frame.width, height: compactInspectorHeight }
      : { x: room.x + room.width, y: room.y, width: inspectorWidth, height: room.height },
  };
}

export function contextToolbarPlacement(
  selection: EditorRect,
  room: EditorRect,
  size: Pick<EditorRect, 'width' | 'height'>,
): ContextToolbarPlacement {
  const gap = 8;
  const width = Math.min(Math.max(0, size.width), room.width);
  const height = Math.min(Math.max(0, size.height), room.height);
  const above = selection.y - height - gap;
  const below = selection.y + selection.height + gap;
  const side: ContextToolbarSide = above >= room.y ? 'above'
    : below + height <= room.y + room.height ? 'below'
      : selection.x + selection.width / 2 < room.x + room.width / 2 ? 'right' : 'left';
  const desiredX = side === 'right' ? selection.x + selection.width + gap
    : side === 'left' ? selection.x - width - gap
      : selection.x + (selection.width - width) / 2;
  const desiredY = side === 'above' ? above
    : side === 'below' ? below
      : selection.y + (selection.height - height) / 2;
  return {
    side,
    x: clamp(desiredX, room.x, room.x + room.width - width),
    y: clamp(desiredY, room.y, room.y + room.height - height),
    width,
    height,
  };
}

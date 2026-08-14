export interface EditorRect { x: number; y: number; width: number; height: number }

export interface InteriorEditorLayout {
  frame: EditorRect;
  header: EditorRect;
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
  frame.width >= 620;

export function interiorEditorLayout(
  viewportWidth: number,
  viewportHeight: number,
  options: InteriorEditorLayoutOptions,
): InteriorEditorLayout {
  const margin = 8;
  const width = Math.min(720, Math.max(320, viewportWidth - margin * 2));
  const height = Math.min(495, Math.max(280, viewportHeight - margin * 2));
  const frame = {
    x: Math.round((viewportWidth - width) / 2),
    y: Math.round((viewportHeight - height) / 2),
    width,
    height,
  };
  const headerHeight = 40;
  const catalogHeight = options.editMode && options.catalogExpanded ? Math.min(112, height * 0.28) : 0;
  const inspectorWidth = options.editMode && options.inspectorExpanded && interiorInspectorAvailable(frame) ? 168 : 0;
  const room = {
    x: frame.x,
    y: frame.y + headerHeight,
    width: frame.width - inspectorWidth,
    height: frame.height - headerHeight - catalogHeight,
  };
  return {
    frame,
    header: { x: frame.x, y: frame.y, width: frame.width, height: headerHeight },
    room,
    catalog: { x: frame.x, y: room.y + room.height, width: frame.width, height: catalogHeight },
    inspector: { x: room.x + room.width, y: room.y, width: inspectorWidth, height: room.height },
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

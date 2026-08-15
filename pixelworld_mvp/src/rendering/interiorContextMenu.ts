export type ContextAction = 'duplicate' | 'rotate' | 'resize' | 'return' | 'group' | 'dissolve';

export interface ContextSelection {
  itemIds: string[];
  grouped: boolean;
  canRotate?: boolean;
}

export interface ContextPoint { x: number; y: number }

export interface ContextMenuSize { width: number; height: number }

export interface ContextRoomBounds extends ContextPoint, ContextMenuSize {}

export function contextActions(selection: ContextSelection): readonly ContextAction[] {
  if (selection.itemIds.length === 0) return [];
  const rotation = selection.canRotate === false ? [] : ['rotate' as const];
  if (selection.itemIds.length === 1) return ['duplicate', ...rotation, 'resize', 'return'];
  return [selection.grouped ? 'dissolve' : 'group', 'duplicate', ...rotation, 'return'];
}

export function placeContextMenu(
  pointer: ContextPoint,
  menuSize: ContextMenuSize,
  roomBounds: ContextRoomBounds,
): ContextPoint {
  const gap = 8;
  const minimumX = roomBounds.x;
  const minimumY = roomBounds.y;
  const maximumX = roomBounds.x + roomBounds.width - menuSize.width;
  const maximumY = roomBounds.y + roomBounds.height - menuSize.height;
  const preferredX = pointer.x + gap + menuSize.width <= roomBounds.x + roomBounds.width
    ? pointer.x + gap
    : pointer.x - gap - menuSize.width;
  const preferredY = pointer.y + gap + menuSize.height <= roomBounds.y + roomBounds.height
    ? pointer.y + gap
    : pointer.y - gap - menuSize.height;
  return {
    x: Math.min(maximumX, Math.max(minimumX, preferredX)),
    y: Math.min(maximumY, Math.max(minimumY, preferredY)),
  };
}

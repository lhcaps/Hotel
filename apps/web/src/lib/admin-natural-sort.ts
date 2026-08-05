type RoomSortKey = readonly [number, number, string];

function roomSortKey(value: string): RoomSortKey {
  const normalized = value.trim().toUpperCase();
  const numeric = Number(normalized.match(/\d+$/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  const group = normalized.startsWith('G') ? 0 : /^\d/.test(normalized) ? 1 : 2;
  return [group, Number.isSafeInteger(numeric) ? numeric : Number.MAX_SAFE_INTEGER, normalized];
}

export function compareRoomDisplayOrder(left: string, right: string): number {
  const leftKey = roomSortKey(left);
  const rightKey = roomSortKey(right);
  if (leftKey[0] !== rightKey[0]) return leftKey[0] - rightKey[0];
  if (leftKey[1] !== rightKey[1]) return leftKey[1] - rightKey[1];
  return leftKey[2].localeCompare(rightKey[2], 'en', { numeric: true, sensitivity: 'base' });
}

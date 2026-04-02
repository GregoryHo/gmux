export interface ZoneHeights {
  session: number;
  detail: number;
  notify: number;
}

const HEADER_HEIGHT = 1;
const INPUT_HEIGHT = 1;
const BORDER_COUNT = 6; // 3 bordered zones × 2 rows each (top + bottom)

export function calculateZoneHeights(rows: number): ZoneHeights {
  const flexRows = rows - HEADER_HEIGHT - INPUT_HEIGHT - BORDER_COUNT;
  const sessionHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const notifyHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const detailHeight = Math.max(3, flexRows - sessionHeight - notifyHeight);

  return {
    session: sessionHeight,
    detail: detailHeight,
    notify: notifyHeight,
  };
}

export function calculateFocusHeight(rows: number): number {
  return rows - HEADER_HEIGHT - INPUT_HEIGHT;
}

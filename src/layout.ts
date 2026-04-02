export interface ZoneHeights {
  header: number;
  session: number;
  detail: number;
  notify: number;
  input: number;
}

const HEADER_HEIGHT = 1;
const INPUT_HEIGHT = 1;
const BORDER_COUNT = 3;

export function calculateZoneHeights(rows: number): ZoneHeights {
  const flexRows = rows - HEADER_HEIGHT - INPUT_HEIGHT - BORDER_COUNT;
  const sessionHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const notifyHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const detailHeight = Math.max(3, flexRows - sessionHeight - notifyHeight);

  return {
    header: HEADER_HEIGHT,
    session: sessionHeight,
    detail: detailHeight,
    notify: notifyHeight,
    input: INPUT_HEIGHT,
  };
}

export function calculateFocusHeight(rows: number): number {
  return rows - HEADER_HEIGHT - INPUT_HEIGHT - 1;
}

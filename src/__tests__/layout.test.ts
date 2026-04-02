import { describe, it, expect } from "vitest";
import { calculateZoneHeights, calculateFocusHeight } from "../layout.js";

describe("calculateZoneHeights", () => {
  it("calculates zone heights from terminal rows", () => {
    const heights = calculateZoneHeights(40);

    expect(heights.header).toBe(1);
    expect(heights.input).toBe(1);
    expect(heights.session + heights.detail + heights.notify).toBe(40 - 1 - 1 - 3);
    expect(heights.session).toBeGreaterThanOrEqual(3);
    expect(heights.notify).toBeGreaterThanOrEqual(3);
    expect(heights.detail).toBeGreaterThan(heights.session);
  });

  it("enforces minimum zone heights for small terminals", () => {
    const heights = calculateZoneHeights(20);

    expect(heights.session).toBeGreaterThanOrEqual(3);
    expect(heights.notify).toBeGreaterThanOrEqual(3);
    expect(heights.detail).toBeGreaterThanOrEqual(3);
  });

  it("gives detail the largest share", () => {
    const heights = calculateZoneHeights(50);
    expect(heights.detail).toBeGreaterThan(heights.session);
    expect(heights.detail).toBeGreaterThan(heights.notify);
  });
});

describe("calculateFocusHeight", () => {
  it("calculates focus mode height", () => {
    const height = calculateFocusHeight(40);
    // rows - header(1) - input(1) - border(1)
    expect(height).toBe(37);
  });

  it("works for small terminals", () => {
    const height = calculateFocusHeight(20);
    expect(height).toBe(17);
  });
});

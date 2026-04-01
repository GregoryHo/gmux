import { describe, it, expect } from "vitest";
import { StatusOverrideStore } from "../status-overrides.js";

describe("StatusOverrideStore", () => {
  it("stores and retrieves overrides", () => {
    const store = new StatusOverrideStore();
    store.set("arcforge:1.1", "idle");
    expect(store.get("arcforge:1.1")).toBe("idle");
    expect(store.has("arcforge:1.1")).toBe(true);
  });

  it("returns undefined for unknown targets", () => {
    const store = new StatusOverrideStore();
    expect(store.get("unknown:1.1")).toBeUndefined();
    expect(store.has("unknown:1.1")).toBe(false);
  });

  it("overwrites existing overrides", () => {
    const store = new StatusOverrideStore();
    store.set("arcforge:1.1", "idle");
    store.set("arcforge:1.1", "active");
    expect(store.get("arcforge:1.1")).toBe("active");
  });

  it("clears a specific override", () => {
    const store = new StatusOverrideStore();
    store.set("arcforge:1.1", "idle");
    store.clear("arcforge:1.1");
    expect(store.has("arcforge:1.1")).toBe(false);
  });

  it("prunes stale overrides for disappeared panes", () => {
    const store = new StatusOverrideStore();
    store.set("arcforge:1.1", "idle");
    store.set("workspace:1.1", "active");
    store.set("settings:1.1", "needs_attention");

    // Only arcforge and workspace still exist
    const activeTargets = new Set(["arcforge:1.1", "workspace:1.1"]);
    store.pruneStale(activeTargets);

    expect(store.has("arcforge:1.1")).toBe(true);
    expect(store.has("workspace:1.1")).toBe(true);
    expect(store.has("settings:1.1")).toBe(false);
    expect(store.size).toBe(2);
  });

  it("reports correct size", () => {
    const store = new StatusOverrideStore();
    expect(store.size).toBe(0);
    store.set("a:1.1", "idle");
    store.set("b:1.1", "active");
    expect(store.size).toBe(2);
  });
});

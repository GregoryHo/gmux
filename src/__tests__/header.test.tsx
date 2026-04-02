import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Header } from "../components/header.js";

describe("Header", () => {
  it("renders session count and time", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("gmux");
    expect(output).toContain("5 sessions");
    expect(output).toContain("3 active");
  });

  it("renders singular session", () => {
    const { lastFrame } = render(
      <Header sessionCount={1} activeCount={0} degraded={false} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("1 session");
    expect(output).not.toContain("1 sessions");
  });

  it("shows warning icon when degraded", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={0} degraded={true} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("⚠");
    expect(output).toContain("tmux");
  });

  it("shows warning icon when socket unavailable", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={0} degraded={false} socketAvailable={false} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("⚠");
    expect(output).toContain("socket");
  });

  it("renders Focus mode header with session name", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true}
        focusSession="arcforge:1.1" />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("arcforge:1.1");
    expect(output).toContain("Esc");
  });

  it("does not show active count when zero", () => {
    const { lastFrame } = render(
      <Header sessionCount={3} activeCount={0} degraded={false} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).not.toContain("active");
  });

  it("shows warning when hooks not configured", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} hooksConfigured={false} />
    );
    expect(lastFrame()).toContain("⚠");
    expect(lastFrame()).toContain("hooks");
  });

  it("shows no hooks warning when configured", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} hooksConfigured={true} />
    );
    expect(lastFrame()).not.toContain("hooks");
  });
});

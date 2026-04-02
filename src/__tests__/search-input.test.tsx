import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SearchInput } from "../components/search-input.js";

describe("SearchInput", () => {
  it("renders search prompt with query", () => {
    const { lastFrame } = render(
      <SearchInput query="arc" onChange={() => {}} onCancel={() => {}} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
    expect(output).toContain("arc");
  });

  it("renders empty search prompt", () => {
    const { lastFrame } = render(
      <SearchInput query="" onChange={() => {}} onCancel={() => {}} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
  });

  it("renders cursor indicator", () => {
    const { lastFrame } = render(
      <SearchInput query="test" onChange={() => {}} onCancel={() => {}} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("_");
  });
});

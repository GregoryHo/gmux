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

  it("renders match count when matchCount and totalCount are provided", () => {
    const { lastFrame } = render(
      <SearchInput
        query="arc"
        onChange={() => {}}
        onCancel={() => {}}
        matchCount={2}
        totalCount={5}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("2/5");
  });

  it("does not render match count when props are omitted", () => {
    const { lastFrame } = render(
      <SearchInput query="arc" onChange={() => {}} onCancel={() => {}} />,
    );
    const output = lastFrame() ?? "";
    expect(output).not.toContain("/5");
  });
});

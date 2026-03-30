import { describe, expect, it } from "vitest";

import { renderPromptTemplate } from "../src";

describe("renderPromptTemplate", () => {
  it("renders variables from flat objects", () => {
    const rendered = renderPromptTemplate("Hello {{name}}", { name: "Team" });

    expect(rendered).toBe("Hello Team");
  });

  it("renders variables using dot notation", () => {
    const rendered = renderPromptTemplate("Ship {{repo.name}}", {
      repo: { name: "evalrail" }
    });

    expect(rendered).toBe("Ship evalrail");
  });

  it("throws on missing variables", () => {
    expect(() => renderPromptTemplate("Missing {{value}}", {})).toThrowError(
      /Missing variable/
    );
  });
});

import type { PromptValue, PromptVariables } from "./types";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function resolveVariable(
  variables: PromptVariables,
  keyPath: string
): PromptValue | undefined {
  if (keyPath in variables) {
    return variables[keyPath];
  }

  const pathParts = keyPath.split(".");
  let current: unknown = variables;

  for (const part of pathParts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (
    current === null ||
    current === undefined ||
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean"
  ) {
    return current;
  }

  return JSON.stringify(current);
}

export function renderPromptTemplate(
  template: string,
  variables: PromptVariables = {}
): string {
  return template.replace(VARIABLE_PATTERN, (_match, rawKey: string) => {
    const value = resolveVariable(variables, rawKey);

    if (value === undefined) {
      throw new Error(
        `Missing variable \"${rawKey}\" in prompt template \"${template}\"`
      );
    }

    return value === null ? "" : String(value);
  });
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function tokenize(input: string): string[] {
  return normalizeWhitespace(input)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

export function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }

  const union = new Set([...leftTokens, ...rightTokens]);
  let intersectionSize = 0;

  for (const token of union) {
    if (leftTokens.has(token) && rightTokens.has(token)) {
      intersectionSize += 1;
    }
  }

  return intersectionSize / union.size;
}

export function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

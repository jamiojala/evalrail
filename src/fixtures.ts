import { readFile, writeFile } from "node:fs/promises";

import {
  expectContains,
  expectMatches,
  expectMinLength,
  expectNotContains,
  expectReferenceSimilarity
} from "./expectations";
import type { PromptFixture, PromptVariables } from "./types";

export interface SerializedPromptFixture {
  id: string;
  prompt: string;
  variables?: PromptVariables;
  referenceOutput?: string;
  contains?: string[];
  notContains?: string[];
  matches?: string[];
  minLength?: number;
  minReferenceSimilarity?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface FixtureFile {
  fixtures: SerializedPromptFixture[];
}

function normalizeFixtureFile(
  raw: unknown,
  filePath: string
): SerializedPromptFixture[] {
  if (Array.isArray(raw)) {
    return raw as SerializedPromptFixture[];
  }

  if (
    raw &&
    typeof raw === "object" &&
    "fixtures" in raw &&
    Array.isArray((raw as FixtureFile).fixtures)
  ) {
    return (raw as FixtureFile).fixtures;
  }

  throw new Error(
    `Invalid fixture file format in ${filePath}. Expected an array or { fixtures: [...] }`
  );
}

function compileFixture(source: SerializedPromptFixture): PromptFixture {
  const expectations = [
    ...(source.contains ?? []).map((value) => expectContains(value)),
    ...(source.notContains ?? []).map((value) => expectNotContains(value)),
    ...(source.matches ?? []).map((value) => expectMatches(value)),
    ...(source.minLength ? [expectMinLength(source.minLength)] : []),
    ...(source.minReferenceSimilarity
      ? [expectReferenceSimilarity(source.minReferenceSimilarity)]
      : [])
  ];

  const fixture: PromptFixture = {
    id: source.id,
    prompt: source.prompt,
    expectations
  };

  if (source.variables !== undefined) {
    fixture.variables = source.variables;
  }

  if (source.referenceOutput !== undefined) {
    fixture.referenceOutput = source.referenceOutput;
  }

  if (source.tags !== undefined) {
    fixture.tags = source.tags;
  }

  if (source.metadata !== undefined) {
    fixture.metadata = source.metadata;
  }

  return fixture;
}

export function defineFixtures(fixtures: PromptFixture[]): PromptFixture[] {
  const fixtureIds = new Set<string>();

  for (const fixture of fixtures) {
    if (!fixture.id || !fixture.id.trim()) {
      throw new Error("Fixture id is required and cannot be empty");
    }

    if (fixtureIds.has(fixture.id)) {
      throw new Error(`Duplicate fixture id: ${fixture.id}`);
    }

    fixtureIds.add(fixture.id);
  }

  return fixtures;
}

export async function loadFixturesFromFile(
  filePath: string
): Promise<PromptFixture[]> {
  const contents = await readFile(filePath, "utf8");
  const parsed = JSON.parse(contents) as unknown;
  const serializedFixtures = normalizeFixtureFile(parsed, filePath);

  return defineFixtures(serializedFixtures.map((fixture) => compileFixture(fixture)));
}

export async function writeFixtureFile(
  filePath: string,
  fixtures: SerializedPromptFixture[]
): Promise<void> {
  const payload: FixtureFile = { fixtures };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

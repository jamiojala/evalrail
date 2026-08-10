import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadExampleEnvironment } from "../examples/load-environment";

const testKey = "EVALRAIL_ENV_LOADER_TEST";
const originalValue = process.env[testKey];

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[testKey];
  } else {
    process.env[testKey] = originalValue;
  }
});

describe("example environment loader", () => {
  it("loads .env.local before the .env fallback without real credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evalrail-env-test-"));

    try {
      await writeFile(join(directory, ".env.local"), `${testKey}=local\n`, "utf8");
      await writeFile(join(directory, ".env"), `${testKey}=fallback\n`, "utf8");
      delete process.env[testKey];

      loadExampleEnvironment(directory);

      expect(process.env[testKey]).toBe("local");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads .env when .env.local is absent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evalrail-env-test-"));

    try {
      await writeFile(join(directory, ".env"), `${testKey}=fallback\n`, "utf8");
      delete process.env[testKey];

      loadExampleEnvironment(directory);

      expect(process.env[testKey]).toBe("fallback");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

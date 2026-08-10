import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type {
  RegressionComparator,
  RegressionComparatorInput,
  RegressionComparatorResult,
  RegressionSnapshot
} from "./types";
import { jaccardSimilarity, normalizeWhitespace, sanitizeFileSegment } from "./utils";

const SNAPSHOT_SCHEMA_VERSION = 1;

interface SnapshotDocument {
  version: number;
  suite: string;
  providerId: string;
  generatedAt: string;
  snapshots: Record<string, RegressionSnapshot>;
}

export interface FileRegressionStoreOptions {
  suite: string;
  storeDir: string;
}

function sanitizeRegressionSegment(value: string, label: string): string {
  const sanitized = sanitizeFileSegment(value);

  if (sanitized === "" || sanitized === "." || sanitized === "..") {
    throw new Error(
      `Invalid regression ${label}: value must resolve to a non-empty file segment other than "." or ".."`
    );
  }

  return sanitized;
}

export class FileRegressionStore {
  private readonly cache = new Map<string, SnapshotDocument>();
  private readonly dirtyProviderIds = new Set<string>();
  private readonly pathOwners = new Map<string, string>();

  constructor(private readonly options: FileRegressionStoreOptions) {}

  private buildPath(providerId: string): string {
    const safeSuite = sanitizeRegressionSegment(this.options.suite, "suite");
    const safeProvider = sanitizeRegressionSegment(providerId, "provider id");
    const storeRoot = resolve(this.options.storeDir);
    const filePath = resolve(
      storeRoot,
      safeSuite,
      `${safeProvider}.snapshots.json`
    );
    const pathFromStoreRoot = relative(storeRoot, filePath);

    if (
      pathFromStoreRoot === "" ||
      pathFromStoreRoot === ".." ||
      pathFromStoreRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromStoreRoot)
    ) {
      throw new Error("Regression snapshot path escapes the configured storeDir");
    }

    const portablePathKey = filePath.toLowerCase();
    const existingOwner = this.pathOwners.get(portablePathKey);
    if (existingOwner !== undefined && existingOwner !== providerId) {
      throw new Error(
        `Regression provider ids ${JSON.stringify(existingOwner)} and ${JSON.stringify(providerId)} resolve to the same portable snapshot path`
      );
    }
    this.pathOwners.set(portablePathKey, providerId);

    return filePath;
  }

  private async load(providerId: string): Promise<SnapshotDocument> {
    const existing = this.cache.get(providerId);

    if (existing) {
      return existing;
    }

    const filePath = this.buildPath(providerId);

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as SnapshotDocument;

      if (
        parsed.suite !== this.options.suite ||
        parsed.providerId !== providerId
      ) {
        throw new Error(
          "Regression snapshot identity does not match the requested suite and provider"
        );
      }

      this.cache.set(providerId, parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      const emptyDocument: SnapshotDocument = {
        version: SNAPSHOT_SCHEMA_VERSION,
        suite: this.options.suite,
        providerId,
        generatedAt: new Date().toISOString(),
        snapshots: {}
      };

      this.cache.set(providerId, emptyDocument);
      return emptyDocument;
    }
  }

  async getSnapshot(
    providerId: string,
    fixtureId: string
  ): Promise<RegressionSnapshot | undefined> {
    const document = await this.load(providerId);
    return document.snapshots[fixtureId];
  }

  async setSnapshot(
    providerId: string,
    fixtureId: string,
    output: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const document = await this.load(providerId);

    const snapshot: RegressionSnapshot = {
      fixtureId,
      output,
      recordedAt: new Date().toISOString()
    };

    if (metadata !== undefined) {
      snapshot.metadata = metadata;
    }

    document.snapshots[fixtureId] = snapshot;
    document.generatedAt = new Date().toISOString();
    this.dirtyProviderIds.add(providerId);
  }

  async flush(): Promise<void> {
    const providerIds = [...this.dirtyProviderIds];

    for (const providerId of providerIds) {
      const document = this.cache.get(providerId);

      if (!document) {
        continue;
      }

      const filePath = this.buildPath(providerId);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      this.dirtyProviderIds.delete(providerId);
    }
  }
}

export const defaultRegressionComparator: RegressionComparator = (
  input: RegressionComparatorInput
): RegressionComparatorResult => {
  const normalizedCurrent = normalizeWhitespace(input.currentOutput);
  const normalizedBaseline = normalizeWhitespace(input.baselineOutput);

  if (normalizedCurrent === normalizedBaseline) {
    return {
      ok: true,
      score: 1,
      reason: "Output matches baseline after whitespace normalization"
    };
  }

  const similarity = jaccardSimilarity(normalizedCurrent, normalizedBaseline);

  return {
    ok: false,
    score: similarity,
    reason: `Output drift detected against baseline (similarity=${similarity.toFixed(3)})`
  };
};

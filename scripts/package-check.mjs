import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8")
);
const expectedPnpmVersion = packageJson.packageManager.replace(/^pnpm@/, "");

const expectedFiles = [
  "LICENSE",
  "README.md",
  "dist/index.cjs",
  "dist/index.cjs.map",
  "dist/index.d.cts",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "package.json"
].sort();

const secretFilePatterns = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:id_dsa|id_ecdsa|id_ed25519|id_rsa)(?:\.pub)?$/i,
  /\.(?:jks|key|keystore|p12|pem|pfx)$/i,
  /(^|\/)(?:credentials|secrets?)(?:\.|\/|$)/i
];

function currentPnpmCommand(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args]
    };
  }

  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    throw new Error(`${command} exited with status ${result.status}`);
  }

  return result.stdout ?? "";
}

function runPnpm(args, options = {}) {
  const invocation = currentPnpmCommand(args);
  return run(invocation.command, invocation.args, options);
}

function parsePackManifest(output) {
  const jsonStart = output.indexOf("{");
  const jsonEnd = output.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error("pnpm pack did not return a JSON manifest");
  }

  return JSON.parse(output.slice(jsonStart, jsonEnd + 1));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const pnpmVersion = runPnpm(["--version"], { capture: true }).trim();
assertEqual(
  pnpmVersion,
  expectedPnpmVersion,
  "package check must use the packageManager pnpm version"
);

const temporaryRoot = mkdtempSync(join(tmpdir(), "evalrail-package-check-"));

try {
  const packDirectory = join(temporaryRoot, "pack");
  const consumerDirectory = join(temporaryRoot, "consumer");
  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });

  const packOutput = runPnpm(
    ["pack", "--json", "--pack-destination", packDirectory],
    { capture: true }
  );
  const manifest = parsePackManifest(packOutput);

  assertEqual(manifest.name, packageJson.name, "packed package name mismatch");
  assertEqual(
    manifest.version,
    packageJson.version,
    "packed package version mismatch"
  );

  const packedFiles = manifest.files.map(({ path }) => path).sort();
  assertEqual(
    JSON.stringify(packedFiles),
    JSON.stringify(expectedFiles),
    "packed file allowlist mismatch"
  );
  assertEqual(
    new Set(packedFiles).size,
    packedFiles.length,
    "packed manifest contains duplicate paths"
  );

  const secretLikeFiles = packedFiles.filter((path) =>
    secretFilePatterns.some((pattern) => pattern.test(path))
  );
  assertEqual(
    secretLikeFiles.length,
    0,
    `packed manifest contains secret-like paths: ${secretLikeFiles.join(", ")}`
  );

  const tarballPath = manifest.filename;
  if (!existsSync(tarballPath)) {
    throw new Error(`pnpm pack did not create ${tarballPath}`);
  }

  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "evalrail-package-smoke",
        private: true,
        version: "0.0.0",
        dependencies: {
          [packageJson.name]: pathToFileURL(tarballPath).href
        }
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    join(consumerDirectory, "esm-smoke.mjs"),
    `import * as evalrail from ${JSON.stringify(packageJson.name)};\n` +
      `if (typeof evalrail.runEvalSuite !== "function") {\n` +
      `  throw new Error("ESM export runEvalSuite is unavailable");\n` +
      `}\n` +
      `if (typeof evalrail.evaluateProviderRollout !== "function") {\n` +
      `  throw new Error("ESM export evaluateProviderRollout is unavailable");\n` +
      `}\n` +
      `const summary = { providerId: "baseline", total: 1, passed: 1, failed: 0, passRate: 1, averageDurationMs: 1, providerDurationRuns: 1, averageProviderDurationMs: 1, referenceSimilarityExpectedRuns: 0, referenceSimilarityRuns: 0 };\n` +
      `const candidate = { ...summary, providerId: "candidate" };\n` +
      `const decision = evalrail.evaluateProviderRollout({ suite: "smoke", startedAt: "", completedAt: "", fixtureResults: [], providerSummaries: [summary, candidate], totals: { total: 2, passed: 2, failed: 0 } }, { baselineProviderId: "baseline", candidateProviderId: "candidate", thresholds: { maxPassRateDrop: 0 } });\n` +
      `evalrail.expectMaxTotalTokens(10);\n` +
      `if (!evalrail.formatProviderRollout(decision).includes("PASS")) throw new Error("ESM rollout report failed");\n` +
      `evalrail.assertRolloutPassed(decision);\n`
  );
  writeFileSync(
    join(consumerDirectory, "cjs-smoke.cjs"),
    `const evalrail = require(${JSON.stringify(packageJson.name)});\n` +
      `if (typeof evalrail.runEvalSuite !== "function") {\n` +
      `  throw new Error("CommonJS export runEvalSuite is unavailable");\n` +
      `}\n` +
      `if (typeof evalrail.evaluateProviderRollout !== "function") {\n` +
      `  throw new Error("CommonJS export evaluateProviderRollout is unavailable");\n` +
      `}\n` +
      `const summary = { providerId: "baseline", total: 1, passed: 1, failed: 0, passRate: 1, averageDurationMs: 1, providerDurationRuns: 1, averageProviderDurationMs: 1, referenceSimilarityExpectedRuns: 0, referenceSimilarityRuns: 0 };\n` +
      `const candidate = { ...summary, providerId: "candidate" };\n` +
      `const decision = evalrail.evaluateProviderRollout({ suite: "smoke", startedAt: "", completedAt: "", fixtureResults: [], providerSummaries: [summary, candidate], totals: { total: 2, passed: 2, failed: 0 } }, { baselineProviderId: "baseline", candidateProviderId: "candidate", thresholds: { maxPassRateDrop: 0 } });\n` +
      `evalrail.expectMaxTotalTokens(10);\n` +
      `if (!evalrail.formatProviderRollout(decision).includes("PASS")) throw new Error("CommonJS rollout report failed");\n` +
      `evalrail.assertRolloutPassed(decision);\n`
  );
  writeFileSync(
    join(consumerDirectory, "types-smoke.mts"),
    `import { assertRolloutPassed, evaluateProviderRollout, expectMaxTotalTokens, formatProviderRollout, runEvalSuite, type ProviderRolloutDecision, type ProviderRolloutOptions, type ProviderRolloutThresholds, type RunEvalSuiteOptions } from ${JSON.stringify(packageJson.name)};\n` +
      `const runner: typeof runEvalSuite = runEvalSuite;\n` +
      `const rolloutEvaluator: typeof evaluateProviderRollout = evaluateProviderRollout;\n` +
      `const tokenGate: ReturnType<typeof expectMaxTotalTokens> = expectMaxTotalTokens(100);\n` +
      `const rolloutReporter: typeof formatProviderRollout = formatProviderRollout;\n` +
      `const rolloutAssertion: typeof assertRolloutPassed = assertRolloutPassed;\n` +
      `const options = {} as RunEvalSuiteOptions;\n` +
      `const rolloutOptions = {} as ProviderRolloutOptions;\n` +
      `const rolloutThresholds = {} as ProviderRolloutThresholds;\n` +
      `const rolloutDecision = {} as ProviderRolloutDecision;\n` +
      `void runner;\n` +
      `void rolloutEvaluator;\n` +
      `void tokenGate;\n` +
      `void rolloutReporter;\n` +
      `void rolloutAssertion;\n` +
      `void options;\n` +
      `void rolloutOptions;\n` +
      `void rolloutThresholds;\n` +
      `void rolloutDecision;\n`
  );
  writeFileSync(
    join(consumerDirectory, "types-smoke.cts"),
    `import evalrail = require(${JSON.stringify(packageJson.name)});\n` +
      `const runner: typeof evalrail.runEvalSuite = evalrail.runEvalSuite;\n` +
      `const rolloutEvaluator: typeof evalrail.evaluateProviderRollout = evalrail.evaluateProviderRollout;\n` +
      `const tokenGate: ReturnType<typeof evalrail.expectMaxTotalTokens> = evalrail.expectMaxTotalTokens(100);\n` +
      `const rolloutReporter: typeof evalrail.formatProviderRollout = evalrail.formatProviderRollout;\n` +
      `const rolloutAssertion: typeof evalrail.assertRolloutPassed = evalrail.assertRolloutPassed;\n` +
      `const rolloutOptions = {} as evalrail.ProviderRolloutOptions;\n` +
      `const rolloutThresholds = {} as evalrail.ProviderRolloutThresholds;\n` +
      `const rolloutDecision = {} as evalrail.ProviderRolloutDecision;\n` +
      `void runner;\n` +
      `void rolloutEvaluator;\n` +
      `void tokenGate;\n` +
      `void rolloutReporter;\n` +
      `void rolloutAssertion;\n` +
      `void rolloutOptions;\n` +
      `void rolloutThresholds;\n` +
      `void rolloutDecision;\n`
  );
  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: []
        },
        include: ["types-smoke.mts", "types-smoke.cts"]
      },
      null,
      2
    )}\n`
  );

  runPnpm(
    ["install", "--ignore-scripts", "--offline", "--no-frozen-lockfile"],
    { cwd: consumerDirectory }
  );
  run(process.execPath, ["esm-smoke.mjs"], { cwd: consumerDirectory });
  run(process.execPath, ["cjs-smoke.cjs"], { cwd: consumerDirectory });
  const typeScriptCompiler = join(
    repositoryRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc"
  );
  if (!existsSync(typeScriptCompiler)) {
    throw new Error("TypeScript compiler is unavailable for the consumer smoke test");
  }
  run(process.execPath, [typeScriptCompiler, "--project", "tsconfig.json"], {
    cwd: consumerDirectory
  });

  console.log("Packed manifest:");
  for (const path of packedFiles) {
    console.log(`- ${path}`);
  }
  console.log(
    "Package smoke check passed for ESM import, CommonJS require, and TypeScript resolution."
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

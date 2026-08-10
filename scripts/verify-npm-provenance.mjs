import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IN_TOTO_STATEMENT = "https://in-toto.io/Statement/v1";
const SLSA_PROVENANCE = "https://slsa.dev/provenance/v1";
const GITHUB_ACTIONS_BUILD_TYPE =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const GITHUB_ACTIONS_BUILDER =
  "https://github.com/actions/runner/github-hosted";
const GITHUB_ACTIONS_ISSUER =
  "https://token.actions.githubusercontent.com";

function fail(message) {
  throw new Error(message);
}

function decodeBase64(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    fail(`${label} is not canonical base64`);
  }

  const decoded = Buffer.from(value, "base64");
  const canonicalInput = value.replace(/=+$/, "");
  const canonicalOutput = decoded.toString("base64").replace(/=+$/, "");
  if (canonicalInput !== canonicalOutput) {
    fail(`${label} is not canonical base64`);
  }

  return decoded;
}

function expectedPackageSubject(packageName, version) {
  const encodedName = packageName.startsWith("@")
    ? `%40${packageName.slice(1)}`
    : packageName;
  return `pkg:npm/${encodedName}@${version}`;
}

function expectedIntegrityHex(integrity) {
  if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) {
    fail("npm integrity must use sha512");
  }

  const digest = decodeBase64(integrity.slice("sha512-".length), "npm integrity");
  if (digest.length !== 64) {
    fail("npm integrity must contain a 512-bit digest");
  }
  return digest.toString("hex");
}

export function verifyProvenanceClaims({
  statement,
  packageName,
  version,
  integrity,
  repositoryUrl,
  workflowPath,
  workflowRef
}) {
  if (statement?._type !== IN_TOTO_STATEMENT) {
    fail("provenance is not an in-toto v1 statement");
  }
  if (statement?.predicateType !== SLSA_PROVENANCE) {
    fail("provenance is not a SLSA v1 predicate");
  }
  if (statement?.predicate?.buildDefinition?.buildType !== GITHUB_ACTIONS_BUILD_TYPE) {
    fail("provenance build type is not GitHub Actions workflow v1");
  }
  if (statement?.predicate?.runDetails?.builder?.id !== GITHUB_ACTIONS_BUILDER) {
    fail("provenance builder is not a GitHub-hosted Actions runner");
  }

  const subjects = statement.subject;
  if (!Array.isArray(subjects) || subjects.length !== 1) {
    fail("provenance must contain exactly one package subject");
  }

  const subject = subjects[0];
  if (subject?.name !== expectedPackageSubject(packageName, version)) {
    fail("provenance subject does not match the exact npm package version");
  }
  if (subject?.digest?.sha512 !== expectedIntegrityHex(integrity)) {
    fail("provenance subject digest does not match npm integrity");
  }

  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow;
  if (
    workflow?.repository !== repositoryUrl ||
    workflow?.path !== workflowPath ||
    workflow?.ref !== workflowRef
  ) {
    fail("provenance workflow identity does not match the expected repository, path, and ref");
  }

  const expectedSourceUri = `git+${repositoryUrl}@${workflowRef}`;
  const matchingSources = (
    statement.predicate?.buildDefinition?.resolvedDependencies ?? []
  ).filter(
    (dependency) =>
      dependency?.uri === expectedSourceUri &&
      typeof dependency?.digest?.gitCommit === "string" &&
      /^[0-9a-f]{40}$/.test(dependency.digest.gitCommit)
  );

  if (matchingSources.length !== 1) {
    fail("provenance must resolve exactly one expected Git source commit");
  }

  return {
    commit: matchingSources[0].digest.gitCommit,
    subject: subject.name
  };
}

export async function verifySignedProvenance({
  attestationDocument,
  sigstore,
  packageName,
  version,
  integrity,
  repositoryUrl,
  workflowPath,
  workflowRef
}) {
  const candidates = (attestationDocument?.attestations ?? []).filter(
    (attestation) => attestation?.predicateType === SLSA_PROVENANCE
  );
  if (candidates.length !== 1) {
    fail("npm must expose exactly one SLSA v1 provenance attestation");
  }

  const bundle = candidates[0].bundle;
  const envelope = bundle?.dsseEnvelope;
  if (envelope?.payloadType !== "application/vnd.in-toto+json") {
    fail("provenance bundle does not contain an in-toto DSSE envelope");
  }

  const certificateIdentityURI =
    `${repositoryUrl}/${workflowPath}@${workflowRef}`;
  await sigstore.verify(bundle, {
    certificateIssuer: GITHUB_ACTIONS_ISSUER,
    certificateIdentityURI,
    ctLogThreshold: 1,
    tlogThreshold: 1
  });

  let statement;
  try {
    statement = JSON.parse(
      decodeBase64(envelope.payload, "DSSE payload").toString("utf8")
    );
  } catch (error) {
    fail(`DSSE payload is not valid JSON: ${error.message}`);
  }

  return verifyProvenanceClaims({
    statement,
    packageName,
    version,
    integrity,
    repositoryUrl,
    workflowPath,
    workflowRef
  });
}

async function main() {
  const [
    attestationPath,
    packageName,
    version,
    integrity,
    repositoryUrl,
    workflowPath,
    workflowRef
  ] = process.argv.slice(2);
  const sigstorePath = process.env.SIGSTORE_PATH;

  if (
    !attestationPath ||
    !packageName ||
    !version ||
    !integrity ||
    !repositoryUrl ||
    !workflowPath ||
    !workflowRef ||
    !sigstorePath
  ) {
    fail("usage: verify-npm-provenance <attestations.json> <package> <version> <integrity> <repository-url> <workflow-path> <workflow-ref>");
  }

  const require = createRequire(import.meta.url);
  const sigstore = require(sigstorePath);
  const attestationDocument = JSON.parse(
    await readFile(attestationPath, "utf8")
  );
  const result = await verifySignedProvenance({
    attestationDocument,
    sigstore,
    packageName,
    version,
    integrity,
    repositoryUrl,
    workflowPath,
    workflowRef
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

import { describe, expect, it, vi } from "vitest";

// @ts-expect-error Repository release script intentionally has no declaration file.
import { verifyProvenanceClaims, verifySignedProvenance } from "../scripts/verify-npm-provenance.mjs";

const packageName = "@jamiojala/evalrail";
const version = "0.2.1";
const repositoryUrl = "https://github.com/jamiojala/evalrail";
const workflowPath = ".github/workflows/release.yml";
const workflowRef = "refs/heads/main";
const commit = "2a5f5205fd9f38fecbdf5d08459176741b2f8916";
const digest = Buffer.alloc(64, 7);
const integrity = `sha512-${digest.toString("base64")}`;

function statement() {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: "pkg:npm/%40jamiojala/evalrail@0.2.1",
        digest: { sha512: digest.toString("hex") }
      }
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType:
          "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            repository: repositoryUrl,
            path: workflowPath,
            ref: workflowRef
          }
        },
        resolvedDependencies: [
          {
            uri: `git+${repositoryUrl}@${workflowRef}`,
            digest: { gitCommit: commit }
          }
        ]
      },
      runDetails: {
        builder: { id: "https://github.com/actions/runner/github-hosted" }
      }
    }
  };
}

const expected = {
  packageName,
  version,
  integrity,
  repositoryUrl,
  workflowPath,
  workflowRef
};

describe("npm provenance verification", () => {
  it("binds the exact artifact, workflow identity, ref, and source commit", () => {
    expect(verifyProvenanceClaims({ statement: statement(), ...expected })).toEqual({
      commit,
      subject: "pkg:npm/%40jamiojala/evalrail@0.2.1"
    });
  });

  it.each([
    ["package subject", (value: ReturnType<typeof statement>) => {
      value.subject[0]!.name = "pkg:npm/%40jamiojala/other@0.2.1";
    }],
    ["artifact digest", (value: ReturnType<typeof statement>) => {
      value.subject[0]!.digest.sha512 = "0".repeat(128);
    }],
    ["repository", (value: ReturnType<typeof statement>) => {
      value.predicate.buildDefinition.externalParameters.workflow.repository =
        "https://github.com/attacker/evalrail";
    }],
    ["workflow path", (value: ReturnType<typeof statement>) => {
      value.predicate.buildDefinition.externalParameters.workflow.path =
        ".github/workflows/other.yml";
    }],
    ["workflow ref", (value: ReturnType<typeof statement>) => {
      value.predicate.buildDefinition.externalParameters.workflow.ref =
        "refs/heads/other";
    }],
    ["source commit", (value: ReturnType<typeof statement>) => {
      value.predicate.buildDefinition.resolvedDependencies[0]!.digest.gitCommit =
        "not-a-commit";
    }]
  ])("rejects a mismatched %s", (_label, mutate) => {
    const value = statement();
    mutate(value);
    expect(() => verifyProvenanceClaims({ statement: value, ...expected })).toThrow();
  });

  it("verifies the exact Sigstore bundle and GitHub Actions certificate identity before trusting claims", async () => {
    const payload = Buffer.from(JSON.stringify(statement())).toString("base64");
    const bundle = {
      dsseEnvelope: {
        payloadType: "application/vnd.in-toto+json",
        payload
      }
    };
    const sigstore = { verify: vi.fn().mockResolvedValue(undefined) };

    await expect(
      verifySignedProvenance({
        attestationDocument: {
          attestations: [
            {
              predicateType: "https://slsa.dev/provenance/v1",
              bundle
            }
          ]
        },
        sigstore,
        ...expected
      })
    ).resolves.toEqual({
      commit,
      subject: "pkg:npm/%40jamiojala/evalrail@0.2.1"
    });

    expect(sigstore.verify).toHaveBeenCalledWith(bundle, {
      certificateIssuer: "https://token.actions.githubusercontent.com",
      certificateIdentityURI:
        "https://github.com/jamiojala/evalrail/.github/workflows/release.yml@refs/heads/main",
      ctLogThreshold: 1,
      tlogThreshold: 1
    });
  });
});

# Releasing EvalRail

EvalRail has not been published to npm yet. A source version, changelog entry, successful build, or merged version PR is not evidence of a registry release.

## Automated Preflight

The release workflow must complete these checks before Changesets can create a version PR or publish:

```bash
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 check
corepack pnpm@10.34.5 package:check
corepack pnpm@10.34.5 audit:ci
```

The release workflow runs typecheck, tests, and build on Node.js 22, 24, and 26 in a read-only job. The write-enabled Changesets job cannot start until the complete matrix passes.

`package:check` exercises the clean `prepack` lifecycle, creates a real tarball, enforces the shipped-file allowlist, installs that tarball into a clean temporary consumer, and verifies ESM import, CommonJS require, and TypeScript resolution. It removes its temporary files on exit.

`audit:ci` blocks moderate, high, and critical advisories. Lower-severity findings are reviewed explicitly instead of forcing transitive dependencies outside their upstream-supported semver ranges. As of 2026-08-10, the remaining low-severity finding is in esbuild's Windows development server through tsup; EvalRail uses tsup for builds and does not expose that server.

## External First-Release Gates

Before merging a release PR that can publish:

1. Confirm the GitHub repository description and visibility match the library in `package.json`.
2. Protect `main` and require the CI and CodeQL checks before merge.
3. Enable GitHub private vulnerability reporting and Dependabot security updates.
4. Confirm Actions is allowed to create pull requests, or configure a narrowly scoped `CHANGESETS_GITHUB_TOKEN` repository secret. The release action receives that token only in its write-enabled job.
5. Configure a narrowly scoped npm access token with publish rights to `@jamiojala/evalrail` as the `NPM_TOKEN` repository secret. Do not put token values in source, issues, pull requests, or logs.
6. Confirm the package name is still available and the intended version does not already exist.
7. Review the generated version PR, changelog, packed manifest, dependency audit, and passing CI matrix.

Repository settings and npm credentials are external state. The workflow cannot prove they are configured until the relevant GitHub Actions run succeeds.

## Post-Publish Verification

Only call a version released after all of these checks succeed:

```bash
npm view @jamiojala/evalrail version dist.integrity
```

- Install the exact registry version in a new temporary consumer project.
- Verify both ESM import and CommonJS require against the registry artifact.
- Confirm the Git tag and GitHub release point to the published source commit.
- Update the README package-status notice and this document from verified registry state.

If any check fails, treat the repository as source-only and fix forward without claiming publication.

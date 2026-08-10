# Security Policy

## Supported Code

Security fixes target the latest code on `main`. Registry consumers should verify the current published version with `npm view @jamiojala/evalrail version` and include the exact affected version in a report. No blanket support window is promised unless a release note states one.

## Reporting a Vulnerability

Do not disclose a suspected vulnerability in a public issue.

Use GitHub's **Report a vulnerability** option for this repository if it is available. If private vulnerability reporting is unavailable, contact the maintainer through a private contact method listed on the maintainer's GitHub profile. Include affected code or version, reproduction steps, impact, and any suggested mitigation.

No response-time guarantee is promised. Reports will be assessed and handled according to severity and maintainer capacity.

Never include live API keys, access tokens, customer data, or other secrets in a report or reproduction.

## Local Snapshot Trust Boundary

Treat the configured regression `storeDir` and its existing directory tree as trusted local state. EvalRail rejects unsafe path segments and verifies lexical containment, but filesystem links created by another local actor can redirect normal file operations. Do not run privileged evaluations against an attacker-controlled snapshot directory.

## Release Security Checks

The release preflight includes the test suite, a real packed-artifact install, ESM/CommonJS/type-resolution checks, an npm publisher identity check, and an audit gate for moderate and higher severities. Snapshot path containment, sanitized-name collision handling, and upstream-error redaction and body cancellation have focused regression coverage.

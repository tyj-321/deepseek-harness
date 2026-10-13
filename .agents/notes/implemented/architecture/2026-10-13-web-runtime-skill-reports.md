# Agent Note: Web runtime skill report delivery

Status: implemented

English | [中文](2026-10-13-web-runtime-skill-reports.zh.md)

## Problem

A generated report URL can remain unreachable when an optional skill catalog is absent or outdated. Report delivery must exist wherever the Web application and skill import run.

## Decision

The [Web runtime](../../../../packages/bundle/web-app/src/index.ts) owns the report route through an effect-scoped registration. Its [handler](../../../../packages/bundle/web-app/src/reports.ts) serves only published HTML from the shared Harness home. Optional catalog plugins do not register this route. The [same-origin link decision](2026-10-13-same-origin-report-links.md) continues to govern Markdown navigation and CSV downloads.

## Alternatives considered

Requiring a catalog plugin makes basic report delivery depend on an unrelated interface. Another preview listener requires deployment-specific networking and gives links a different lifecycle.

## Consequences

Web profiles provide report delivery without installing a catalog or toolbox. Old catalog builds containing the same route need an update to avoid duplicate registration. Source changes require rebuilt runtime artifacts; the skill and host still need a shared report directory. The existing Loader composition check covers HTML delivery, HEAD, method rejection, and inaccessible snapshots without a catalog plugin.

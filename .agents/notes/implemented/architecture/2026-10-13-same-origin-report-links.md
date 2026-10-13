# Agent Note: Same-origin report links

Status: implemented

English | [中文](2026-10-13-same-origin-report-links.zh.md)

## Problem

A skill running on a remote server cannot use its loopback address as a report URL for the viewing browser. Root-relative Markdown links need the browser's origin to reach the deployed web service.

## Decision

The [Markdown renderer](../../../../packages/client/ui-primitives/src/markdown/render.tsx) resolves single-slash root-relative links against the viewing HTTP(S) page and rejects destinations that change origin. Non-root relative paths, protocol-relative links, local file links, unsafe schemes, and relative images retain the existing denial. The resulting absolute URL uses the ordinary embedded-browser opener. The [browser panel](../../../../packages/client/ui-browser-panel/src/client/BrowserPanel.tsx) permits downloads so a static dashboard can export CSV.

## Alternatives considered

Embedding a server address in every generated report requires deployment-specific configuration and breaks when users access DSH through another hostname. A separate preview server adds a port that the deployment may not expose.

## Consequences

Self-contained reports can use the deployed DSH origin without model-authored hostnames or new listeners. The report-serving plugin owns filesystem restrictions and response isolation. A focused Markdown test verifies current-origin resolution, click routing, and protocol-relative rejection; the static report's HTTP and browser checks verify delivery, filtering, and CSV export.

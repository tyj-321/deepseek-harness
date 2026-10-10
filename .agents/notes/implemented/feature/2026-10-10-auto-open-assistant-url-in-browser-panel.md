# Agent Note: Auto-open live assistant URLs in the embedded browser panel

Status: implemented

English | [中文](2026-10-10-auto-open-assistant-url-in-browser-panel.zh.md)

## Problem

Clicked http(s) links in chat markdown already route through `openUrl` to the right-hand embedded browser panel (`@deepseek-ai/dsh-client-ui-browser-panel`). An assistant reply that *returns* a URL as the thing to visit still left that panel closed until the user found and clicked the link, so a typical "here is the page" turn required an extra gesture after the model had already named the destination.

## Decision

`AssistantMarkdown` watches live assistant `text` blocks and, through the same injected `openUrl` callback, opens the latest complete http(s) URL in the panel.

A node is live only after it has been observed with `streaming: true`. Settled history that mounts already complete never auto-opens, so paging older turns and reopening a session do not spawn the panel. While tokens are still arriving, a match at the very end of the accumulated text is treated as still growing and is ignored; a match followed by any later character, or any remaining match once streaming ends (including an interrupted turn), is final. Fenced-code contents and markdown image destinations are skipped so example `curl` URLs and `![alt](…)` assets do not navigate the panel. Reasoning blocks are not scanned. The latest complete URL wins; a later URL in the same reply replaces the earlier one, and the same URL is not opened twice.

## Alternatives considered

**Open on every settled assistant message, including history.** Rejected: reopening a session or scrolling in older pages would immediately load whatever URL an old turn happened to contain, stealing the column and surprising the reader.

**Wait until the whole reply settles before opening anything.** Rejected: a URL that is already followed by more prose is complete, and delaying until the last token adds latency to the common "here is the page, then an explanation" shape.

**Parse the markdown AST instead of scanning prose.** Rejected for the streaming path: an incomplete `[label](https://…` tail is not a link node yet, and the scan only needs http(s) destinations, not rendered structure. The fence-and-image exclusions cover the false positives the AST would have dropped.

**Auto-open user-bubble URLs as well.** Rejected: "the conversation returned a URL" is the assistant's reply, not the prompt that asked for it.

## Consequences

A live assistant reply that names a complete http(s) URL opens the browser column without a click, using the existing `browserPanel.open` / system-browser fallback. The cost is a conservative completeness heuristic: a reply whose only content is a URL stays closed until the stream ends, and a URL inside an unclosed fence never opens.

## Testing

`auto-open-url.client.spec.ts` pins extraction: settled vs streaming-tail, punctuation trim, latest-of-several, fenced code (closed and unclosed), image destinations, and non-http schemes. `coverage-tails.client.spec.tsx` drives `AssistantMarkdown` through history-skip, live complete, no-reopen, settle-at-tail, and reasoning-ignore. `chat-view.client.spec.tsx` checks the assembled chat path: a historical assistant URL stays closed, then a streaming partial opens once the URL is complete.

# @deepseek-ai/dsh-client-ui-browser-panel

English | [中文](README.zh.md)

Embedded browser panel plugin: a rightmost browser column for the desktop shell, the `browserPanel` service that in-chat link clicks route through, and the sidebar footer trigger that toggles the column. The panel occupies the layout's `browser` slot — a real grid column beside the tool-details column, not an overlay — so it never covers the conversation, and its width drags through the same handle interaction the details column has (contract range 400–1200px, default 560).

In the Electron desktop shell the page renders in a main-process `WebContentsView` overlaid on the panel body — a top-level WebContents, so the target site's `frame-ancestors` CSP does not apply and intranet platforms that forbid framing still load. The component measures the body placeholder's rect and reports it through the preload bridge; main positions the view. The guest's `new-window` events are intercepted and navigated in-panel instead of opening a new window, and hiding the panel keeps the WebContents alive so cookies and login sessions survive across toggles. In a plain web deployment the panel falls back to a sandboxed `<iframe>` and offers an external-browser affordance when a site refuses embedding. The header carries an address bar (Enter navigates, bare hosts gain `https://`), refresh, an open-externally button (routed through the desktop preload bridge when present), and close.

The `browserPanel` service (`ctx.browserPanel`) is the cross-plugin face: it publishes an observable `{ open, url }` snapshot and the `open(url)` / `close()` verbs, driving the column's geometry through `ctx.layout` (`openBrowser` / `closeBrowser`). [ui-conversation](../ui-conversation/README.md) reads it through `ctx.get` — never a value import, per the client bundle purity gate — and routes every http(s) link in chat markdown and the web tool cards to it, falling back to the system browser when the plugin is not composed in. A live assistant reply that contains a complete http(s) URL also opens that URL in the panel without a click; historical messages and a URL still growing at the streaming tail stay closed.

The `/client` exports are the plugin body (`apply`/`inject`), the service face (`IBrowserPanel`, `BrowserPanelController`), and the locale key type; the panel and trigger components remain package-internal behind the slot registrations.

## Model Experience

None, as the panel renders web pages the model's results merely link to; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Web deployment embedding is best-effort** — the `<iframe>` fallback cannot load sites that send `X-Frame-Options`/`frame-ancestors`; the failure overlay offers the external browser instead. The desktop shell (WebContentsView) has no such limit.
- **Narrow viewports auto-close the column** — the concession chain shrinks then derives a zero browser width to keep the center readable; re-widening restores the preferred width.

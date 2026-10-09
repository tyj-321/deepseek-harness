/**
 * BrowserPanelController: the cross-plugin face behind ctx.browserPanel.
 * Panel content state (open flag + current URL) lives in this service,
 * published as an observable snapshot; the column component subscribes, and
 * link-click producers (chat markdown, web cards) call open(). Column
 * GEOMETRY (open width, drag resizing, viewport concession) lives with the
 * layout store — the service only asks ctx.layout for open/close transitions.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Snapshot of the embedded browser panel. */
export interface BrowserPanelState {
  /** Whether the panel is visible. */
  readonly open: boolean
  /** The URL the panel shows; null while nothing has been opened. */
  readonly url: string | null
}

/** The outward browser-panel face (ctx.browserPanel). */
export interface IBrowserPanel {
  /** Observable panel state for the column component. */
  readonly state: ObservableSnapshot<BrowserPanelState>
  /** Open the panel and navigate to the URL; null opens the empty address-bar state. */
  open(url: string | null): void
  /** Close the panel (the URL is kept for the sidebar reopen gesture). */
  close(): void
}

/** Cross-plugin browser-panel face (ctx.browserPanel). */
export class BrowserPanelController implements IBrowserPanel {
  readonly #store = createSnapshotStore<BrowserPanelState>({ open: false, url: null })

  readonly state: ObservableSnapshot<BrowserPanelState> = this.#store

  /**
   * @param layout - panel-transition face: opening the panel opens the
   *   browser column, closing releases it.
   */
  constructor(private readonly layout: ILayout) {}

  open(url: string | null): void {
    const snapshot = this.#store.getSnapshot()
    if (snapshot.open && snapshot.url === url) return
    this.#store.set({ open: true, url })
    this.layout.openBrowser()
  }

  close(): void {
    const snapshot = this.#store.getSnapshot()
    if (!snapshot.open) return
    this.#store.set({ ...snapshot, open: false })
    this.layout.closeBrowser()
  }
}

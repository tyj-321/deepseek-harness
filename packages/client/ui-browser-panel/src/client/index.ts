/**
 * Embedded-browser plugin, browser half: provides the `browserPanel` service
 * (the cross-plugin face link clicks route through), registers the panel into
 * the layout's rightmost `browser` column slot, and adds the sidebar footer
 * trigger. The panel itself lives in BrowserPanel.tsx; the service in
 * service.ts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot declarations this package registers into.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { BrowserPanel } from './BrowserPanel.tsx'
import { SidebarTrigger } from './SidebarTrigger.tsx'
import { BrowserPanelController } from './service.ts'
import { en, NS, zh, type BrowserPanelKey } from './locales.ts'

export { BrowserPanelController } from './service.ts'
export type { BrowserPanelState, IBrowserPanel } from './service.ts'
export type { BrowserPanelKey } from './locales.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Embedded browser panel face; link-click producers call open(). */
    browserPanel: import('./service.ts').IBrowserPanel
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Embedded browser panel copy. */
    browserPanel: BrowserPanelKey
  }
}

/** Injected share both slot entries receive: the panel face plus the bound translate. */
interface BrowserPanelInjected {
  readonly panel: BrowserPanelController
  readonly t: TranslateNS<'browserPanel'>
}

/** Services required by the browser-panel plugin. */
export const inject = ['slots', 'layout', 'locale']

/**
 * Mount the browser panel plugin.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const panel = new BrowserPanelController(ctx.layout)
  const t = ctx.locale.bind(NS)
  const injectPanel = (): BrowserPanelInjected => ({ panel, t })

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-browser-panel: dictionaries')

  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('browserPanel', panel)
    return () => { void disposeService() }
  }, 'ui-browser-panel: service')

  // The sidebar trigger sits beside Settings at the column foot. Registration
  // is declaration-aware: slots.inject defers until ui-sidebar's children
  // table declares the hole, so activation order between the plugins is free.
  ctx.effect(
    () => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'browser-panel', order: 0, locale: NS, inject: injectPanel },
      SidebarTrigger,
    )),
    'ui-browser-panel: sidebar trigger',
  )

  // The panel occupies the layout's rightmost `browser` column (declared by
  // ui-layout's root entry; same declaration-aware deferral). Column geometry
  // — open width, drag resizing, concession under a narrow viewport — lives
  // with the layout store; the service only asks for open/close transitions.
  ctx.effect(
    () => ctx.slots.inject('browser', () => ctx.slots.register(
      { name: 'browser', locale: NS, inject: injectPanel },
      BrowserPanel,
    )),
    'ui-browser-panel: browser column',
  )
}

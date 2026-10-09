/**
 * BrowserPanel: the embedded browser surface, registered into the layout's
 * rightmost `browser` column slot. The column stays mounted at zero width
 * while closed (the guest page survives a close), so the component renders
 * null while the service says closed and lets the grid track do the hiding.
 *
 * Rendering: in the Electron desktop shell a `<webview>` carries the page
 * (webviewTag is enabled in main.ts; it is a full Chromium guest, so sites
 * that forbid iframing still load). Elsewhere — the plain web deployment —
 * the panel falls back to a sandboxed `<iframe>` and surfaces the load-failure
 * affordance when a site refuses embedding.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import clsx from 'clsx'
import {
  IconCloseOutline16, IconGlobeOutline14, IconRefreshOutline16, IconRightUpOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { BrowserPanelController } from './service.ts'
import css from './BrowserPanel.module.css'

/** The preload bridge the desktop shell installs (apps/desktop/src/preload.ts). */
interface DesktopBridge {
  readonly isDesktop?: boolean
  openExternal(url: string): void
}

function desktopBridge(): DesktopBridge | undefined {
  return (window as unknown as { dshDesktop?: DesktopBridge }).dshDesktop
}

/** The subset of Electron's WebviewTag the panel drives. */
interface WebviewElement extends HTMLElement {
  src: string
  reload(): void
  loadURL(url: string): Promise<void>
}

/** True when the value parses as an absolute http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Normalize address-bar input into a navigable URL (bare hosts gain https://). */
function normalizeAddress(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (isHttpUrl(trimmed)) return trimmed
  // A bare host or host/path gains the https scheme; anything else is not a URL.
  if (/^[\w-]+(\.[\w-]+)+(?::\d+)?(?:[/?#].*)?$/.test(trimmed)) return `https://${trimmed}`
  return null
}

/** Full panel props: the injected panel face plus the bound translate. */
export interface BrowserPanelProps {
  readonly panel: BrowserPanelController
  readonly t: TranslateNS<'browserPanel'>
}

export function BrowserPanel({ panel, t }: BrowserPanelProps) {
  const state = useSyncExternalStore(
    fn => panel.state.subscribe(fn),
    () => panel.state.getSnapshot(),
  )
  const webviewRef = useRef<WebviewElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [address, setAddress] = useState(state.url ?? '')
  const desktop = useMemo(() => desktopBridge()?.isDesktop === true, [])

  // The address bar follows navigation that originates outside it (link clicks,
  // in-page redirects); edits stay local until Enter commits them.
  useEffect(() => {
    if (state.url !== null) setAddress(state.url)
  }, [state.url])

  // Attach the guest's lifecycle events. The webview element exists only in
  // the desktop branch, so the effect keys off the rendered URL and the
  // desktop flag; every attachment re-binds against the current element.
  useEffect(() => {
    if (!desktop || !state.open || state.url === null) return
    const view = webviewRef.current
    if (view === null) return
    setLoading(true)
    setFailed(false)
    const onStart = (): void => { setLoading(true); setFailed(false) }
    const onStop = (): void => { setLoading(false) }
    const onFail = (event: Event): void => {
      // ERR_ABORTED (-3) fires for same-document navigation and user aborts.
      const code = (event as { errorCode?: number }).errorCode
      if (code === -3) return
      setLoading(false)
      setFailed(true)
    }
    const onNavigate = (event: Event): void => {
      const url = (event as { url?: string }).url
      if (typeof url === 'string') setAddress(url)
    }
    const onNewWindow = (event: Event): void => {
      // Guest target=_blank: navigate the panel itself instead of letting
      // Electron open a new BrowserWindow.
      const url = (event as { url?: string }).url
      if (typeof url === 'string' && isHttpUrl(url)) void view.loadURL(url)
    }
    view.addEventListener('did-start-loading', onStart)
    view.addEventListener('did-stop-loading', onStop)
    view.addEventListener('did-fail-load', onFail)
    view.addEventListener('did-navigate', onNavigate)
    view.addEventListener('did-navigate-in-page', onNavigate)
    view.addEventListener('new-window', onNewWindow)
    return () => {
      view.removeEventListener('did-start-loading', onStart)
      view.removeEventListener('did-stop-loading', onStop)
      view.removeEventListener('did-fail-load', onFail)
      view.removeEventListener('did-navigate', onNavigate)
      view.removeEventListener('did-navigate-in-page', onNavigate)
      view.removeEventListener('new-window', onNewWindow)
    }
  }, [desktop, state.open, state.url])

  if (!state.open) return null

  const commitAddress = (): void => {
    const next = normalizeAddress(address)
    if (next === null) {
      setAddress(state.url ?? '')
      return
    }
    panel.open(next)
  }
  const onAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commitAddress()
    if (event.key === 'Escape') setAddress(state.url ?? '')
  }
  const refresh = (): void => {
    if (desktop) webviewRef.current?.reload()
    else if (state.url !== null) panel.open(state.url)
  }
  const openExternal = (): void => {
    if (state.url === null) return
    const bridge = desktopBridge()
    if (bridge !== undefined) bridge.openExternal(state.url)
    else window.open(state.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={css.panel} data-browser-panel>
      <div className={css.header}>
        <IconGlobeOutline14 size={14} className={css.headerIcon} />
        <input
          className={css.address}
          value={address}
          placeholder={t('panel.addressPlaceholder')}
          spellCheck={false}
          onChange={(event) => { setAddress(event.target.value) }}
          onKeyDown={onAddressKeyDown}
          onBlur={() => { setAddress(state.url ?? '') }}
        />
        <Tooltip label={t('panel.refresh')} delayMs={500}>
          <button type="button" className={css.action} aria-label={t('panel.refresh')} onClick={refresh}>
            <IconRefreshOutline16 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('panel.openExternal')} delayMs={500}>
          <button
            type="button"
            className={css.action}
            aria-label={t('panel.openExternal')}
            disabled={state.url === null}
            onClick={openExternal}
          >
            <IconRightUpOutline16 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('panel.close')} delayMs={500}>
          <button type="button" className={css.action} aria-label={t('panel.close')} onClick={() => { panel.close() }}>
            <IconCloseOutline16 size={14} />
          </button>
        </Tooltip>
      </div>
      <div className={clsx(css.body, loading && css.bodyLoading)}>
        {state.url === null ? (
          <div className={css.placeholder}>{t('panel.empty')}</div>
        ) : desktop ? (
          <webview ref={webviewRef} src={state.url} className={css.guest} />
        ) : (
          <iframe
            key={state.url}
            src={state.url}
            className={css.guest}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title={t('panel.title')}
            onLoad={() => { setLoading(false) }}
          />
        )}
        {failed && (
          <div className={css.failure}>
            <div className={css.failureTitle}>{t('panel.loadFailed')}</div>
            <div className={css.failureDetail}>{t('panel.loadFailedDetail')}</div>
            <button type="button" className={css.failureAction} onClick={openExternal}>
              {t('panel.openExternal')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

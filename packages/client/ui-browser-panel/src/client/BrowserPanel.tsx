/**
 * BrowserPanel: the embedded browser surface, registered into the layout's
 * rightmost `browser` column slot. The column stays mounted at zero width
 * while closed (the guest page survives a close), so the component renders
 * null while the service says closed and lets the grid track do the hiding.
 *
 * Rendering: in the Electron desktop shell the guest page lives in a
 * main-process `WebContentsView` overlaid on the panel body — a top-level
 * WebContents, so the target site's `frame-ancestors` CSP does not apply and
 * intranet platforms that forbid framing still load. The component measures
 * the body placeholder's rect (ResizeObserver + rAF throttle, the AppFrame
 * pattern) and reports it through the preload bridge; main positions the
 * view. Elsewhere — the plain web deployment — the panel falls back to a
 * sandboxed `<iframe>` and surfaces the load-failure affordance when a site
 * refuses embedding.
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

/** Viewport-relative rectangle reported to the main-process guest overlay. */
interface EmbedRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Guest lifecycle event pushed from main (address bar / loading state). */
type EmbedStateEvent =
  | { readonly type: 'loading' }
  | { readonly type: 'navigated'; readonly url: string }
  | { readonly type: 'failed' }

/** The preload bridge the desktop shell installs (apps/desktop/src/preload.ts). */
interface DesktopBridge {
  readonly isDesktop?: boolean
  openExternal(url: string): void
  readonly embedBrowser?: {
    open(url: string): void
    navigate(url: string): void
    reload(): void
    hide(): void
    setRect(rect: EmbedRect): void
    onStateEvent(callback: (event: EmbedStateEvent) => void): () => void
  }
}

function desktopBridge(): DesktopBridge | undefined {
  return (window as unknown as { dshDesktop?: DesktopBridge }).dshDesktop
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
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [address, setAddress] = useState(state.url ?? '')
  const embed = useMemo(() => desktopBridge()?.embedBrowser, [])

  // The address bar follows navigation that originates outside it (link clicks,
  // in-page redirects); edits stay local until Enter commits them.
  useEffect(() => {
    if (state.url !== null) setAddress(state.url)
  }, [state.url])

  // Drive the main-process guest: open/navigate on URL change, hide on close.
  // The effect lives here (not in the service) so the web deployment never
  // touches the desktop bridge.
  useEffect(() => {
    if (embed === undefined) return
    if (!state.open) {
      embed.hide()
      return
    }
    if (state.url !== null) {
      const el = bodyRef.current
      if (el !== null) {
        const rect = el.getBoundingClientRect()
        embed.setRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      }
      setLoading(true)
      setFailed(false)
      embed.open(state.url)
    }
  }, [embed, state.open, state.url])

  // Subscribe to guest lifecycle events (loading bar, address-bar follow,
  // failure overlay). On failure the native view hides so the React failure
  // overlay (beneath it in z-order) becomes visible and clickable.
  useEffect(() => {
    if (embed === undefined) return
    return embed.onStateEvent((event) => {
      if (event.type === 'loading') {
        setLoading(true)
        setFailed(false)
      } else if (event.type === 'navigated') {
        setLoading(false)
        setAddress(event.url)
      } else {
        setLoading(false)
        setFailed(true)
        embed.hide()
      }
    })
  }, [embed])

  // Report the body placeholder's rect so main can position the guest view
  // over it. rAF-throttled ResizeObserver, the AppFrame frame-width pattern.
  useEffect(() => {
    if (embed === undefined || !state.open) return
    const el = bodyRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the body div renders whenever the panel is open. */
    if (el === null) return
    let raf: number | null = null
    const report = (): void => {
      const rect = el.getBoundingClientRect()
      embed.setRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        report()
      })
    })
    observer.observe(el)
    report()
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [embed, state.open])

  if (!state.open) return null

  const commitAddress = (): void => {
    const next = normalizeAddress(address)
    if (next === null) {
      setAddress(state.url ?? '')
      return
    }
    // Same-URL commits after a failure must re-drive the guest: the service
    // dedupes identical URLs (its state doesn't change), so the open effect
    // wouldn't fire and the hidden view would stay hidden.
    if (embed !== undefined && next === state.url) {
      setFailed(false)
      setLoading(true)
      embed.open(next)
      return
    }
    panel.open(next)
  }
  const onAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commitAddress()
    if (event.key === 'Escape') setAddress(state.url ?? '')
  }
  const refresh = (): void => {
    if (embed !== undefined) {
      // After a failure the view is hidden (the React overlay owns the
      // surface); re-open to reveal it. Otherwise a plain reload suffices.
      if (failed && state.url !== null) {
        setFailed(false)
        setLoading(true)
        embed.open(state.url)
      } else {
        embed.reload()
      }
    } else if (state.url !== null) panel.open(state.url)
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
      <div ref={bodyRef} className={clsx(css.body, loading && css.bodyLoading)}>
        {state.url === null ? (
          <div className={css.placeholder}>{t('panel.empty')}</div>
        ) : embed === undefined ? (
          // Web deployment: a sandboxed iframe is the only channel a plain
          // browser has; sites that forbid framing hit the failure overlay.
          <iframe
            key={state.url}
            src={state.url}
            className={css.guest}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title={t('panel.title')}
            onLoad={() => { setLoading(false) }}
          />
        ) : null}
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

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
  IconCloseOutline16,
  IconFullscreenExitOutline16,
  IconFullscreenOutline16,
  IconGlobeOutline14,
  IconRefreshOutline16,
  IconRightUpOutline16,
  Tooltip,
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
    setFullscreen(fullscreen: boolean): void
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
  const [fullscreen, setFullscreen] = useState(false)
  const [address, setAddress] = useState(state.url ?? '')
  // Web-deployment reload token: the iframe remounts when this changes, so a
  // same-URL refresh forces a fresh load even though the service dedupes the
  // URL (its state would not change, so the key would stay the same). The
  // desktop path reloads the native guest directly and never reads this.
  const [reloadSeq, setReloadSeq] = useState(0)
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
  // While fullscreen the main process owns the bounds (whole window), so the
  // panel rect is not reported — reporting it would poison lastRect and the
  // exit-fullscreen frame would flash the wrong geometry.
  useEffect(() => {
    if (embed === undefined || !state.open || fullscreen) return
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
  }, [embed, state.open, fullscreen])

  // Fullscreen: the desktop guest is a main-process WebContentsView, so main
  // must re-bound it over the whole window; the web iframe just restyles.
  // Closing the panel always drops fullscreen first.
  useEffect(() => {
    if (!state.open && fullscreen) setFullscreen(false)
  }, [state.open, fullscreen])
  useEffect(() => {
    if (embed === undefined) return
    embed.setFullscreen(fullscreen)
  }, [embed, fullscreen])
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [fullscreen])

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
    } else if (state.url !== null) {
      // Web deployment: the service dedupes an identical URL (its state
      // doesn't change), so re-open alone wouldn't remount the iframe.
      // Bump the reload token to force a fresh mount — the web equivalent
      // of reload().
      setLoading(true)
      setFailed(false)
      setReloadSeq(n => n + 1)
    }
  }
  const openExternal = (): void => {
    if (state.url === null) return
    const bridge = desktopBridge()
    if (bridge !== undefined) bridge.openExternal(state.url)
    else window.open(state.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={clsx(css.panel, fullscreen && css.panelFullscreen)} data-browser-panel>
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
            <IconRefreshOutline16 size={14} className={css.actionIcon} />
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
            {/* The right-up glyph is a full-bleed solid arrow (0–16 canvas);
                rendered a step smaller so its visual weight matches the
                stroked refresh/close/fullscreen glyphs. */}
            <IconRightUpOutline16 size={12} className={css.actionIcon} />
          </button>
        </Tooltip>
        <Tooltip label={fullscreen ? t('panel.exitFullscreen') : t('panel.fullscreen')} delayMs={500}>
          <button
            type="button"
            className={css.action}
            aria-label={fullscreen ? t('panel.exitFullscreen') : t('panel.fullscreen')}
            aria-pressed={fullscreen}
            disabled={state.url === null}
            onClick={() => { setFullscreen(!fullscreen) }}
          >
            {fullscreen
              ? <IconFullscreenExitOutline16 size={14} className={css.actionIcon} />
              : <IconFullscreenOutline16 size={14} className={css.actionIcon} />}
          </button>
        </Tooltip>
        <Tooltip label={t('panel.close')} delayMs={500}>
          <button type="button" className={css.action} aria-label={t('panel.close')} onClick={() => { panel.close() }}>
            <IconCloseOutline16 size={14} className={css.actionIcon} />
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
            key={`${state.url}#${reloadSeq}`}
            src={state.url}
            className={css.guest}
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
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

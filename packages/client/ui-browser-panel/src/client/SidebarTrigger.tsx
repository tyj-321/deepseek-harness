/** Sidebar footer trigger: the globe icon that toggles the embedded browser panel. */
import { useSyncExternalStore } from 'react'
import { IconGlobeOutline14, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { BrowserPanelController } from './service.ts'
import css from './SidebarTrigger.module.css'

/** Full trigger props: the sidebar's owner share plus the panel face and locale seat. */
export interface SidebarTriggerProps extends SidebarFooterActionOwnerProps {
  readonly panel: BrowserPanelController
  readonly t: TranslateNS<'browserPanel'>
}

/**
 * The trigger renders in both sidebar widths: wide shows icon + label, the
 * collapsed rail shows the icon alone (the tooltip carries the label there).
 */
export function SidebarTrigger({ wide, panel, t }: SidebarTriggerProps) {
  const { open } = useSyncExternalStore(
    fn => panel.state.subscribe(fn),
    () => panel.state.getSnapshot(),
  )
  const toggle = (): void => {
    const snapshot = panel.state.getSnapshot()
    if (snapshot.open) panel.close()
    else panel.open(snapshot.url)
  }
  return (
    <Tooltip label={t('sidebar.open')} delayMs={500} disabled={wide}>
      <button
        type="button"
        className={css.trigger}
        aria-label={t('sidebar.open')}
        aria-pressed={open}
        onClick={toggle}
      >
        <IconGlobeOutline14 size={wide ? 14 : 18} />
        {wide && <span className={css.label}>{t('panel.title')}</span>}
      </button>
    </Tooltip>
  )
}

/**
 * General Settings row for voice input: enable toggle + wake words editor.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/settings/VoiceSettingsRow
 */

import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VoiceKey } from '../locales.ts'
import type { VoiceSettingsView } from '../settings-policy.ts'
import css from './VoiceSettingsRow.module.css'

/** Registration-side preference face. */
export interface VoiceSettingsRowInjected {
  hooks: {
    /** Persisted voice settings bound as a store. */
    voice: SnapshotStore<VoiceSettingsView>
  }
  /** Update one settings field. */
  setField: (field: keyof VoiceSettingsView, value: boolean | string) => void
}

/** Full Settings-row props. */
export type VoiceSettingsRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'voice'>
  & InjectFace<VoiceSettingsRowInjected>

export function VoiceSettingsRow({ useVoice, setField, t }: VoiceSettingsRowProps) {
  const settings = useVoice(value => value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings.wakeWords)

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.title')}</div>
        <div className={css.desc}>{t('settings.description')}</div>
      </div>
      <div className={css.controls}>
        <label className={css.toggle}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => { setField('enabled', e.target.checked) }}
          />
          <span>{t('settings.enabled')}</span>
        </label>
        {editing ? (
          <input
            className={css.wakeInput}
            value={draft}
            onChange={(e) => { setDraft(e.target.value) }}
            onBlur={() => { setField('wakeWords', draft); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setField('wakeWords', draft); setEditing(false) } }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className={css.wakeDisplay}
            onClick={() => { setDraft(settings.wakeWords); setEditing(true) }}
            title={t('settings.wakeWords')}
          >
            {settings.wakeWords}
          </button>
        )}
      </div>
    </div>
  )
}

// Re-export for the locale key type used in the t() seat.
export type { VoiceKey }

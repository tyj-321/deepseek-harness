/**
 * The voice input overlay: a floating panel above the composer showing the
 * current pipeline state (recording / wake-listening / command-listening /
 * converting) with a wave animation and a stop button.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/VoiceOverlay
 */

import { useSyncExternalStore } from 'react'
import type { VoiceOverlayProps } from './slots.ts'
import css from './VoiceOverlay.module.css'

export function VoiceOverlay({ controller, t }: VoiceOverlayProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  if (view.state === 'idle') return null

  const statusText = view.state === 'converting'
    ? t('overlay.converting')
    : view.state === 'command-listening'
      ? t('overlay.commandListening')
      : view.state === 'recording'
        ? t('overlay.recording')
        : t('overlay.wakeListening')

  return (
    <div className={css.overlay}>
      <div className={css.panel}>
        {view.state === 'converting' ? (
          <div className={css.convertingRow}>
            <div className={css.spinner} />
            <span className={css.statusText}>{statusText}</span>
          </div>
        ) : (
          <div className={css.listeningRow}>
            <div className={css.wave}>
              <div className={css.waveBar} />
              <div className={css.waveBar} />
              <div className={css.waveBar} />
              <div className={css.waveBar} />
              <div className={css.waveBar} />
            </div>
            <div className={css.textColumn}>
              <span className={css.statusText}>{statusText}</span>
              {view.state === 'wake-listening' && (
                <span className={css.hintText}>{t('overlay.wakeHint')}</span>
              )}
            </div>
          </div>
        )}
        {view.error !== null && (
          <div className={css.errorText}>{t(`error.${view.error}` as never)}</div>
        )}
        <button
          type="button"
          className={css.stopButton}
          onClick={() => { void controller.stop() }}
        >
          {t('overlay.stop')}
        </button>
      </div>
    </div>
  )
}

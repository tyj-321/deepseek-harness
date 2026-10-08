/**
 * The microphone button in the composer tool row: click for single-shot
 * recording, right-click (or long-press) for the wake-word listening loop.
 * Binds the session's input actions into the controller on mount so a
 * recognized command lands in the draft.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/VoiceButton
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { IconMicrophoneOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { VoiceButtonProps } from './slots.ts'
import css from './VoiceButton.module.css'

export function VoiceButton({ controller, useInput, inputActions, t }: VoiceButtonProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const active = view.state !== 'idle'
  // Track the live draft so the controller can append recognized text.
  const draft = useInput(s => s.draft)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // Bind the composer write path for the recognized command.
  useEffect(() => {
    if (!inputActions) return
    controller.bindInput(inputActions, () => draftRef.current)
    return () => { controller.unbindInput() }
  }, [controller, inputActions])

  const handleClick = (): void => {
    if (active) {
      void controller.stop()
    } else {
      void controller.startManual()
    }
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    if (active) {
      void controller.stop()
    } else {
      void controller.startWake()
    }
  }

  const tooltip = active
    ? t('button.stop')
    : `${t('button.start')} / ${t('button.wake')}`

  return (
    <Tooltip label={tooltip} side="top" delayMs={500}>
      <button
        type="button"
        className={active ? `${css.button} ${css.active}` : css.button}
        aria-label={tooltip}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <IconMicrophoneOutline16 size={16} />
      </button>
    </Tooltip>
  )
}

/**
 * The microphone button in the composer tool row. Wake-word listening runs in
 * the background (started by the plugin while enabled); clicking the button
 * starts a manual recording round on top of it, clicking again stops.
 * Binds the session's input actions into the controller on mount so a
 * recognized command lands in the draft.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/VoiceButton
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { IconMicrophoneOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { VoiceButtonProps } from './slots.ts'
import css from './VoiceButton.module.css'

export function VoiceButton({ controller, useInput, inputActions, t }: VoiceButtonProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  // wake-listening is background silence: the button stays in its idle look
  // and a click starts a manual round on top of the loop.
  const active = view.state === 'recording' || view.state === 'command-listening' || view.state === 'converting'
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

  const label = view.error !== null
    ? t(`error.${view.error}` as never)
    : active ? t('button.stop') : t('button.start')

  return (
    <button
      type="button"
      className={active ? `${css.button} ${css.active}` : css.button}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <IconMicrophoneOutline16 size={16} />
    </button>
  )
}

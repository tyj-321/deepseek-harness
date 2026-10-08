/**
 * The voice input entries' injected faces. The target slots are declared and
 * typed by ui-conversation; this package only contributes the entries, so no
 * SlotMap merge lives here. Live per-session state arrives through the
 * `voice` hook (the framework standard kit binds it into `useVoice`).
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/slots
 */

import type {
  InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'voice' seat).
import type {} from './locales.ts'
import type { VoiceController } from './controller.ts'

/** Injected face of the voice button entry. */
export interface VoiceButtonInjected {
  /** The owning Session's voice controller. */
  controller: VoiceController
}

/** Injected face of the voice overlay entry. */
export interface VoiceOverlayInjected {
  /** The owning Session's voice controller (same instance as the button's). */
  controller: VoiceController
}

/** Full props of the voice button entry. */
export type VoiceButtonProps =
  PropsRuntime<'conversation.input.right'>
  & InjectFace<VoiceButtonInjected>
  & PropsLocale<'voice'>

/** Full props of the voice overlay entry. */
export type VoiceOverlayProps =
  PropsRuntime<'conversation.input.overlay'>
  & InjectFace<VoiceOverlayInjected>
  & PropsLocale<'voice'>

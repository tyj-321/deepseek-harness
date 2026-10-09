/**
 * Voice input plugin, browser half: the microphone button in the composer
 * tool row plus the listening overlay. One VoiceController per Session owns
 * the wake-listening loop; recognized commands land in the session's composer
 * draft through the bound InputActions.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the input.right/overlay entries).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { VoiceController } from './controller.ts'
import { VoiceSettingsPolicy } from './settings-policy.ts'
import { VoiceButton } from './VoiceButton.tsx'
import { VoiceOverlay } from './VoiceOverlay.tsx'
import { VoiceSettingsRow } from './settings/VoiceSettingsRow.tsx'
import type { VoiceButtonInjected, VoiceOverlayInjected } from './slots.ts'
import type { VoiceSettingsRowInjected } from './settings/VoiceSettingsRow.tsx'
import { en, zh } from './locales.ts'
import type { VoiceSettings } from '../settings.ts'
import { VOICE_SETTINGS_NAMESPACE } from '../settings.ts'

export type { VoiceController, VoiceView } from './controller.ts'
export type { VoiceButtonInjected, VoiceOverlayInjected, VoiceButtonProps, VoiceOverlayProps } from './slots.ts'
export type { VoiceKey } from './locales.ts'
export type { VoiceState } from './wake-recorder.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'voice'

/** Required services: the slot registry, the settings binder, and the copy. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body: the voice button, overlay, and settings row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-voice-input: dictionaries')

  const policy = new VoiceSettingsPolicy(
    ctx.settingsScope.bind<VoiceSettings>({ namespace: VOICE_SETTINGS_NAMESPACE }),
  )

  const controllers = new Map<SessionId, VoiceController>()
  const controllerFor = (sessionId: SessionId): VoiceController => {
    let controller = controllers.get(sessionId)
    if (controller === undefined) {
      const settings = policy.current
      controller = new VoiceController({
        wakeWords: settings.wakeWords.split(',').map(w => w.trim()).filter(w => w !== ''),
        asrPath: settings.asrPath,
      })
      controllers.set(sessionId, controller)
      // Start the background wake loop for the fresh controller when enabled.
      if (policy.current.enabled) void controller.ensureWakeListening()
    }
    return controller
  }

  // Background wake-word listening: run whenever voice input is enabled.
  // Clicking the microphone button layers a manual round on top of the loop.
  const syncWakeListening = (): void => {
    const enabled = policy.current.enabled
    for (const controller of controllers.values()) {
      if (enabled) {
        void controller.ensureWakeListening()
      } else {
        void controller.stop()
      }
    }
  }
  policy.store.subscribe(syncWakeListening)

  // Microphone button in the composer tool row.
  ctx.slots.inject('conversation.input.right', () => {
    const dispose = ctx.slots.register({
      name: 'conversation.input.right',
      id: 'voice-input',
      order: 10,
      locale: NS,
      inject: (sessionId): VoiceButtonInjected => ({
        controller: controllerFor(sessionId),
      }),
    }, VoiceButton)
    return () => {
      dispose()
      for (const controller of controllers.values()) controller.dispose()
      controllers.clear()
    }
  })

  // Listening overlay above the composer.
  ctx.slots.inject('conversation.input.overlay', () => {
    const dispose = ctx.slots.register({
      name: 'conversation.input.overlay',
      id: 'voice-overlay',
      order: 10,
      locale: NS,
      inject: (sessionId): VoiceOverlayInjected => ({
        controller: controllerFor(sessionId),
      }),
    }, VoiceOverlay)
    return dispose
  })

  // Settings row.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'voice-input',
    order: 30,
    locale: NS,
    inject: (): VoiceSettingsRowInjected => ({
      hooks: { voice: policy.store },
      setField: (field, value) => { policy.setField(field, value) },
    }),
  }, VoiceSettingsRow))
}

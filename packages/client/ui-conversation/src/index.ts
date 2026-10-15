/** Host registration for browser conversation preferences. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema } from './submission-settings.ts'
import type { Config } from './plugin-config.ts'

export {
  BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR, type BusyEnterBehavior, type ConversationSettings,
} from './submission-settings.ts'

export { Config } from './plugin-config.ts'

/**
 * Register the durable conversation section when a settings provider exists.
 * The exported {@link Config} is the same schema the browser half reads, so a
 * profile patch (`workspaceChip` / `permissionChip`) stays on the host loader
 * entry and rides the `__DSH_BOOT__` wire.
 * @param ctx - Host context whose optional settings service owns the section.
 * @param _config - validated {@link Config}; host apply does not branch on it.
 */
export function apply(ctx: Context, _config?: Config): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(CONVERSATION_SETTINGS_NAMESPACE),
      ConversationSettingsSchema,
    )
  })
}

/** Dual-face plugin config: host Loader validates it, browser apply reads it. */
import z from '@deepseek-ai/schemastery'

/** Plugin config (profile patch `config:` seat). */
export interface Config {
  /**
   * Hero workspace chip + its picker trigger. Sealed deliveries set
   * `workspaceChip: false` (alongside disabling ui-workspace) so end users
   * never see the workspace concept; the composer then relies on the
   * auto-connected Workspace seeded into the profile storage.
   */
  workspaceChip?: boolean
  /**
   * The composer's access chip — the permission-preset picker beside the
   * model seat. Sealed deliveries set `permissionChip: false` (alongside
   * disabling ui-permission) so end users cannot move a session off the
   * preset the deployment pinned; the chip's own surfaces go with it, while
   * the host `/permission` command stays available to operators.
   */
  permissionChip?: boolean
}

/** Schemastery schema Cordis binds as the plugin `Config` export. */
export const Config: z<Config> = z.object({
  workspaceChip: z.boolean().default(true),
  permissionChip: z.boolean().default(true),
})

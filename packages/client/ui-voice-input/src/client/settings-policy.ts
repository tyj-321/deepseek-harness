/**
 * Voice settings policy: wraps the durable SettingsScope in a SnapshotStore
 * the settings row and the controller factory can both read.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { VoiceSettings } from '../settings.ts'

export interface VoiceSettingsView {
  enabled: boolean
  wakeWords: string
  asrPath: string
}

const DEFAULTS: VoiceSettingsView = {
  enabled: true,
  wakeWords: '小海小海,小孩小孩,小海小孩',
  asrPath: '/api/voice/asr',
}

export class VoiceSettingsPolicy {
  /** Reactive preference source for the Settings row and controller factory. */
  readonly store: SnapshotStore<VoiceSettingsView> = createSnapshotStore(DEFAULTS)
  private readonly host: SettingsScope<VoiceSettings> | undefined

  constructor(host?: SettingsScope<VoiceSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /** Current snapshot. */
  get current(): VoiceSettingsView {
    return this.store.getSnapshot()
  }

  /** Update one field; the live value publishes before the durable write. */
  setField(field: keyof VoiceSettingsView, value: boolean | string): void {
    const next = { ...this.store.getSnapshot(), [field]: value }
    this.store.set(next)
    void this.host?.set(field, value)
  }

  private adopt(host: SettingsScope<VoiceSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    this.store.set({
      enabled: section.enabled,
      wakeWords: section.wakeWords,
      asrPath: section.asrPath,
    })
  }
}

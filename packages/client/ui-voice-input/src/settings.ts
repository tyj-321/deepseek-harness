import z from '@deepseek-ai/schemastery'

export const VOICE_SETTINGS_NAMESPACE = 'ui-voice-input'

export interface VoiceSettings {
  /** Master switch for the voice input surface. */
  enabled: boolean
  /** Comma-separated wake words (ASR homophone variants included). */
  wakeWords: string
  /** Host-proxied ASR endpoint path. */
  asrPath: string
}

export const VoiceSettingsSchema: z<VoiceSettings> = z.object({
  enabled: z.boolean().default(true),
  wakeWords: z.string().default('小海小海,小孩小孩,小海小孩'),
  asrPath: z.string().default('/api/voice/asr'),
})

export const DEFAULT_WAKE_WORDS = '小海小海,小孩小孩,小海小孩'
export const DEFAULT_ASR_PATH = '/api/voice/asr'

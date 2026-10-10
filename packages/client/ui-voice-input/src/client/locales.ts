/** `voice` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'button.start': '语音输入',
  'button.stop': '停止语音输入',
  'overlay.wakeListening': '正在监听唤醒词…',
  'overlay.wakeHint': '说"小海小海"唤醒',
  'overlay.commandListening': '已唤醒，请说指令',
  'overlay.recording': '正在录音…',
  'overlay.converting': '正在识别…',
  'overlay.stop': '停止',
  'overlay.elapsed': '已监听',
  'error.micDenied': '麦克风未授权，请检查浏览器权限设置',
  'error.asrFailed': '语音识别失败，请重试',
  'error.tooLong': '录音时间不能超过10分钟',
  'settings.title': '语音输入',
  'settings.description': '唤醒词语音输入：说"小海小海"唤醒后开始说话，说完自动识别填入输入框',
  'settings.enabled': '启用语音输入',
} satisfies Record<string, string>

/** The voice namespace key union. */
export type VoiceKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The voice input controls' copy. */
    voice: VoiceKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'button.start': 'Voice input',
  'button.stop': 'Stop voice input',
  'overlay.wakeListening': 'Listening for wake word…',
  'overlay.wakeHint': 'Say the wake word to begin',
  'overlay.commandListening': 'Awake — speak your command',
  'overlay.recording': 'Recording…',
  'overlay.converting': 'Recognizing…',
  'overlay.stop': 'Stop',
  'overlay.elapsed': 'Elapsed',
  'error.micDenied': 'Microphone not authorized; check browser permission settings',
  'error.asrFailed': 'Speech recognition failed; please retry',
  'error.tooLong': 'Recording cannot exceed 10 minutes',
  'settings.title': 'Voice input',
  'settings.description': 'Wake-word voice input: say "小海小海" to wake, then speak; recognition fills the composer automatically',
  'settings.enabled': 'Enable voice input',
} satisfies Record<VoiceKey, string>

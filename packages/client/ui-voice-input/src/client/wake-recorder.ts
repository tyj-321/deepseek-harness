/**
 * Wake-word voice recorder: a self-contained state machine over
 * js-audio-recorder. Two modes:
 *  - manual: click → record → VAD silence → recognize → onCommand → idle
 *  - wake:   wake-listening → (wake word heard) → command-listening →
 *            (VAD silence) → recognize → onCommand → back to wake-listening
 * No React dependency; the controller layer subscribes.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/wake-recorder
 */

import Recorder from 'js-audio-recorder'

/** Voice pipeline states. */
export type VoiceState = 'idle' | 'recording' | 'wake-listening' | 'command-listening' | 'converting'

/** Volume threshold above which the user is considered speaking. */
const VOLUME_THRESHOLD = 30
/** Silence after speech that ends a turn (seconds). */
const SPEAK_DURATION = 2
/** Total silence that ends a listening round (seconds). */
const NONE_SPEAK_DURATION = 10
/** Hard recording cap (seconds). */
const MAX_DURATION = 600
/** Minimum recording duration to bother with ASR (seconds). */
const MIN_DURATION = 0.5

interface RecorderProgress {
  duration: number
  fileSize: number
  vol: number
}

export interface WakeRecorderOptions {
  /** Wake words; a transcript containing any of them triggers the awake transition. */
  wakeWords: readonly string[]
  /** Host-proxied ASR endpoint path (same-origin). */
  asrPath: string
  /** State transition notification. */
  onStateChange?: (state: VoiceState) => void
  /** Recognized command text (post-wake or manual). */
  onCommand?: (text: string) => void
  /** Recognized wake-word transcript (for UI feedback). */
  onWake?: (text: string) => void
  /** Error notification (permission, ASR failure, …). */
  onError?: (message: string) => void
}

export class WakeRecorder {
  private recorder: Recorder | null = null
  private state: VoiceState = 'idle'
  private speakingTimestamp = 0
  private awake = false
  private disposed = false
  /** 'manual' = single-shot recording; 'wake' = continuous wake-word loop. */
  private mode: 'manual' | 'wake' = 'manual'

  constructor(private readonly options: WakeRecorderOptions) {}

  get currentState(): VoiceState {
    return this.state
  }

  /**
   * Start a single-shot manual recording: record → VAD → recognize → idle.
   * Requests microphone permission first.
   */
  async startManual(): Promise<void> {
    if (this.state !== 'idle') return
    this.mode = 'manual'
    if (!(await this.ensurePermission())) return
    this.disposed = false
    this.awake = false
    this.createRecorder()
    this.setState('recording')
    await this.startRecording()
  }

  /**
   * Start the wake-listening loop: listen for wake word continuously.
   * Requests microphone permission first.
   */
  async startWake(): Promise<void> {
    if (this.state !== 'idle') return
    this.mode = 'wake'
    if (!(await this.ensurePermission())) return
    this.disposed = false
    this.awake = false
    this.createRecorder()
    this.setState('wake-listening')
    await this.startRecording()
  }

  /** Stop everything and release the microphone. */
  async stop(): Promise<void> {
    this.disposed = true
    this.awake = false
    const recorder = this.recorder
    this.recorder = null
    this.setState('idle')
    if (recorder) {
      try {
        recorder.stop()
      } catch { /* already stopped */ }
      try {
        await recorder.destroy()
      } catch { /* best-effort */ }
    }
  }

  private async ensurePermission(): Promise<boolean> {
    try {
      await (Recorder as unknown as { getPermission: () => Promise<void> }).getPermission()
      return true
    } catch {
      this.options.onError?.('mic-denied')
      return false
    }
  }

  private createRecorder(): void {
    this.recorder = new Recorder({
      sampleBits: 16,
      sampleRate: 16000,
      numChannels: 1,
      compiling: false,
    })
    this.recorder.onprogress = (payload: RecorderProgress) => {
      this.onProgress(payload.duration, payload.vol)
    }
  }

  private setState(next: VoiceState): void {
    if (this.state === next) return
    this.state = next
    this.options.onStateChange?.(next)
  }

  private async startRecording(): Promise<void> {
    if (this.disposed || !this.recorder) return
    this.speakingTimestamp = 0
    try {
      await this.recorder.start()
    } catch {
      this.options.onError?.('mic-denied')
      this.setState('idle')
    }
  }

  private onProgress(duration: number, vol: number): void {
    if (this.disposed || this.state === 'idle' || this.state === 'converting') return
    if (duration > MAX_DURATION) {
      this.options.onError?.('too-long')
      void this.stop()
      return
    }
    if (vol > VOLUME_THRESHOLD) {
      this.speakingTimestamp = duration
      return
    }
    const silence = duration - this.speakingTimestamp
    if (this.speakingTimestamp === 0 && silence > NONE_SPEAK_DURATION) {
      // Nobody spoke at all for NONE_SPEAK_DURATION: end this round.
      void this.stopAndRecognize()
    } else if (this.speakingTimestamp > 0 && silence > SPEAK_DURATION) {
      // Speech followed by SPEAK_DURATION silence: turn complete.
      void this.stopAndRecognize()
    }
  }

  private async stopAndRecognize(): Promise<void> {
    const recorder = this.recorder
    if (!recorder || this.disposed) return
    try {
      recorder.stop()
    } catch { /* already stopped */ }
    const wav = recorder.getWAVBlob() as Blob
    const duration = recorder.duration
    if (!wav || wav.size === 0 || duration < MIN_DURATION) {
      // Too short or empty: skip ASR, just move to the next round.
      await this.afterRound()
      return
    }
    this.setState('converting')
    const text = await this.recognize(wav)
    if (this.disposed) return

    if (this.mode === 'manual') {
      // Manual mode: any recognized text is the command.
      if (text !== '') this.options.onCommand?.(text)
      this.setState('idle')
      await this.cleanup()
      return
    }

    // Wake mode.
    if (!this.awake) {
      // Wake-word detection phase.
      if (text !== '' && this.options.wakeWords.some(word => text.includes(word))) {
        this.awake = true
        this.options.onWake?.(text)
        this.setState('command-listening')
        await this.afterRound()
      } else {
        // Not the wake word: keep listening.
        await this.afterRound()
      }
    } else {
      // Command recognition phase.
      this.awake = false
      if (text !== '') this.options.onCommand?.(text)
      this.setState('wake-listening')
      await this.afterRound()
    }
  }

  /** After one round: restart for wake mode, clean up for manual mode. */
  private async afterRound(): Promise<void> {
    if (this.disposed) return
    if (this.mode === 'manual') {
      this.setState('idle')
      await this.cleanup()
      return
    }
    // Wake mode: restart recording for the next round.
    if (this.state === 'converting') {
      this.setState(this.awake ? 'command-listening' : 'wake-listening')
    }
    // js-audio-recorder cannot restart after stop on the same instance in all
    // browsers; create a fresh one for the next round.
    await this.cleanup()
    this.createRecorder()
    await this.startRecording()
  }

  /** Destroy the current recorder instance. */
  private async cleanup(): Promise<void> {
    const recorder = this.recorder
    this.recorder = null
    if (recorder) {
      try {
        await recorder.destroy()
      } catch { /* best-effort */ }
    }
  }

  private async recognize(wav: Blob): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('files', new File([wav], 'temp.wav', { type: 'audio/wav' }))
      formData.append('lang', 'zh')
      const res = await fetch(this.options.asrPath, { method: 'POST', body: formData })
      if (!res.ok) {
        this.options.onError?.('asr-failed')
        return ''
      }
      const data = await res.json() as { text?: string }
      return data.text ?? ''
    } catch {
      this.options.onError?.('asr-failed')
      return ''
    }
  }
}

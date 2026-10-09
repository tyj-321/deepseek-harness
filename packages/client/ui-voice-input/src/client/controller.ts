/**
 * Per-session voice controller: owns one WakeRecorder, publishes its state
 * through the HostObservable pattern, and writes recognized commands into the
 * session's composer draft through the bound InputActions.
 * @module @deepseek-ai/dsh-client-ui-voice-input/client/controller
 */

import { WakeRecorder } from './wake-recorder.ts'
import type { VoiceState } from './wake-recorder.ts'

/**
 * Structural mirror of ui-conversation's InputActions (the type is not
 * exported across the package boundary; the slot props carry it). Only the
 * one verb this controller needs.
 */
export interface VoiceInputActions {
  setDraft(text: string): void
}

/** Immutable view published to the voice button and overlay. */
export interface VoiceView {
  state: VoiceState
  /** Latest error key (locale key suffix), cleared on the next state change. */
  error: string | null
}

export interface VoiceControllerOptions {
  wakeWords: readonly string[]
  asrPath: string
}

export class VoiceController {
  private recorder: WakeRecorder | null = null
  private view: VoiceView = { state: 'idle', error: null }
  private readonly listeners = new Set<() => void>()
  private inputActions: VoiceInputActions | null = null
  private getDraft: (() => string) | null = null

  constructor(private readonly options: VoiceControllerOptions) {}

  /** Bind the session's composer write path. Called by the button on mount. */
  bindInput(actions: VoiceInputActions, getDraft: () => string): void {
    this.inputActions = actions
    this.getDraft = getDraft
  }

  /** Release the composer binding. Called by the button on unmount. */
  unbindInput(): void {
    this.inputActions = null
    this.getDraft = null
  }

  /** Start a single-shot manual recording (click-to-talk). */
  async startManual(): Promise<void> {
    this.clearError()
    if (this.recorder !== null && this.recorder.currentState !== 'idle') {
      // Wake loop already running: switch it to a manual round so the click
      // starts recording immediately instead of being rejected.
      this.recorder.switchToManual()
      return
    }
    const recorder = this.createRecorder()
    this.recorder = recorder
    await recorder.startManual()
    this.releaseIfIdle(recorder)
  }

  /**
   * Ensure the background wake-listening loop is running. Idempotent: a
   * no-op when any recorder is already active.
   */
  async ensureWakeListening(): Promise<void> {
    if (this.recorder !== null && this.recorder.currentState !== 'idle') return
    this.clearError()
    const recorder = this.createRecorder()
    this.recorder = recorder
    await recorder.startWake()
    this.releaseIfIdle(recorder)
  }

  /** Stop the loop and release the microphone. */
  async stop(): Promise<void> {
    const recorder = this.recorder
    this.recorder = null
    if (recorder) await recorder.stop()
    this.view = { state: 'idle', error: null }
    this.emit()
  }

  /** Tear down on session dispose. */
  dispose(): void {
    void this.stop()
    this.listeners.clear()
    this.inputActions = null
    this.getDraft = null
  }

  // HostObservable pattern: subscribe + getSnapshot for useSyncExternalStore.
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  getSnapshot = (): VoiceView => this.view

  private createRecorder(): WakeRecorder {
    return new WakeRecorder({
      wakeWords: this.options.wakeWords,
      asrPath: this.options.asrPath,
      onStateChange: (state) => {
        // Keep a permission or ASR error across the return to idle so the
        // overlay can show it. The next start clears it.
        this.view = { state, error: this.view.error }
        this.emit()
        // When the recorder finishes a manual round and returns to idle,
        // clear the reference so the next click creates a fresh instance.
        if (state === 'idle') {
          this.recorder = null
        }
      },
      onCommand: (text) => {
        const actions = this.inputActions
        const draft = this.getDraft?.() ?? ''
        if (actions && text !== '') {
          actions.setDraft(draft + text)
        }
      },
      onRoundStart: () => { this.clearError() },
      onError: (key) => {
        this.view = { ...this.view, error: key }
        this.emit()
      },
    })
  }

  /** Drop a recorder that never left idle, so a later click can retry. */
  private releaseIfIdle(recorder: WakeRecorder): void {
    if (this.recorder === recorder && recorder.currentState === 'idle') {
      this.recorder = null
    }
  }

  private clearError(): void {
    if (this.view.error === null) return
    this.view = { ...this.view, error: null }
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

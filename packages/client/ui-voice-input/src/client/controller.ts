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
    if (this.recorder) return
    this.recorder = this.createRecorder()
    await this.recorder.startManual()
  }

  /** Start the wake-listening loop. */
  async startWake(): Promise<void> {
    if (this.recorder) return
    this.recorder = this.createRecorder()
    await this.recorder.startWake()
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
        this.view = { state, error: null }
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
      onError: (key) => {
        this.view = { ...this.view, error: key }
        this.emit()
      },
    })
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

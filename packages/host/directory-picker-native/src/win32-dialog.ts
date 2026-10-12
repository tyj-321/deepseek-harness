/**
 * Main-thread driver for the Win32 folder dialog: spawns the dialog child
 * process (which blocks inside the modal `Show`), maps its message protocol
 * onto a promise, and services aborts by posting `WM_CLOSE` to the dialog
 * thread's windows until the child reports back. The real process/window
 * surface is injectable so every driver path is testable on any platform.
 */

import { closeThreadWindows as hostCloseThreadWindows, raiseThreadWindows as hostRaiseThreadWindows, spawnDialogWorker } from './win32-dialog-host.ts'
import type { Win32DialogWorkerData, Win32DialogWorkerMessage } from './win32-dialog-worker.ts'

/** The child-process surface the driver drives (satisfied by `node:child_process`). */
export interface Win32DialogWorkerLike {
  /**
   * Subscribe to a child-process event.
   * @param event - `message`, `error`, or `exit`.
   * @param listener - the event consumer.
   */
  on(event: 'message', listener: (message: Win32DialogWorkerMessage) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  /**
   * Force-stop the child; the abort path's last resort when `WM_CLOSE`
   * never lands (e.g. the dialog window was never created).
   * @returns whether a kill signal was delivered.
   */
  kill(): boolean
  /**
   * Release the event-loop reference. Called once the pick settles so a
   * child stuck in the native modal call never blocks process exit.
   */
  unref?(): void
}

/** Injectable process surface for deterministic driver tests. */
export interface Win32DialogInternals {
  /** Replaces the real child spawn (`win32-dialog-host.ts`). */
  spawnWorker?: (data: Win32DialogWorkerData) => Win32DialogWorkerLike
  /** Replaces the real `WM_CLOSE` poster (`win32-dialog-host.ts`). */
  closeThreadWindows?: (threadId: number) => Promise<void>
  /**
   * Replaces the real foreground raiser (`win32-dialog-host.ts`).
   * @returns how many visible windows were raised (0 = not created yet, retry).
   */
  raiseThreadWindows?: (threadId: number) => Promise<number>
  /** Abort-service cadence override so tests never wait wall-clock time. */
  closeRetryMs?: number
  /** Raise-service cadence override so tests never wait wall-clock time. */
  raiseRetryMs?: number
  /** Raise-service attempt budget override so tests never wait wall-clock time. */
  raiseMaxAttempts?: number
}

/** The dialog title every host shows. */
export const DIALOG_TITLE = 'Select Workspace Directory'

/** `WM_CLOSE` re-post cadence while an abort waits for the worker to unwind. */
const CLOSE_RETRY_MS = 150
/** Abort-service attempts before force-terminating the worker. */
const CLOSE_MAX_ATTEMPTS = 20
/** Foreground-raise retry cadence while the dialog window is being created. */
const RAISE_RETRY_MS = 100
/** Foreground-raise attempts before accepting the default z-order. */
const RAISE_MAX_ATTEMPTS = 30

/** Fail loudly if the closed worker-to-driver union gains an unhandled member. */
/* v8 ignore start -- closed-union backstop; unreachable without a TypeScript contract violation */
function assertNever(value: never): never {
  throw new TypeError(`unknown win32 dialog worker message kind: ${String(value)}`)
}
/* v8 ignore stop */

/**
 * Open the modern Win32 folder picker off the event loop.
 * @param signal - caller lifetime; abort closes the dialog and rejects.
 * @param internals - Worker/window hooks for deterministic tests.
 * @returns the selected path, or null when the user cancels.
 */
export async function pickWin32Directory(
  signal: AbortSignal,
  internals: Win32DialogInternals = {},
): Promise<string | null> {
  if (signal.aborted) throw new Error('native directory picker aborted')
  const spawnWorker = internals.spawnWorker ?? spawnDialogWorker
  const closeWindows = internals.closeThreadWindows ?? hostCloseThreadWindows
  const raiseWindows = internals.raiseThreadWindows ?? hostRaiseThreadWindows
  const closeRetryMs = internals.closeRetryMs ?? CLOSE_RETRY_MS
  const raiseRetryMs = internals.raiseRetryMs ?? RAISE_RETRY_MS
  const raiseMaxAttempts = internals.raiseMaxAttempts ?? RAISE_MAX_ATTEMPTS

  const worker: Win32DialogWorkerLike = spawnWorker({ title: DIALOG_TITLE })
  let dialogThreadId: number | undefined
  let closeTimer: NodeJS.Timeout | undefined
  let raiseTimer: NodeJS.Timeout | undefined
  let settled = false

  return await new Promise<string | null>((resolve, reject) => {
    const settle = (outcome: () => void): void => {
      if (settled) return
      settled = true
      if (closeTimer !== undefined) clearInterval(closeTimer)
      if (raiseTimer !== undefined) clearInterval(raiseTimer)
      signal.removeEventListener('abort', onAbort)
      worker.unref?.()
      outcome()
    }

    const stopRaising = (): void => {
      if (raiseTimer !== undefined) {
        clearInterval(raiseTimer)
        raiseTimer = undefined
      }
    }

    // The dialog opens as the worker's first window, but Windows
    // foreground-lock can keep it behind an already-foreground window (the
    // Electron shell), which reads as a dead button. Force it up ourselves:
    // the `showing` notice precedes the blocking `Show`, so retry until the
    // window exists (a raise count over 0) or the budget runs out and the
    // default z-order is accepted.
    const serviceRaise = (threadId: number): void => {
      let attempts = 0
      const attempt = (): void => {
        attempts += 1
        if (attempts > raiseMaxAttempts) {
          stopRaising()
          return
        }
        // A rejected attempt (a refusing EnumThreadWindows or a dying worker)
        // is discarded: the interval retries it and the budget caps the wait.
        void raiseWindows(threadId).then(
          (raised) => { if (raised > 0) stopRaising() },
          () => undefined,
        )
      }
      attempt()
      raiseTimer = setInterval(attempt, raiseRetryMs)
    }

    const postClose = (): void => {
      // Before `showing` there is no window to close; the budget below still
      // runs so a child that never reports cannot dangle the pick. A
      // rejected close attempt (EnumThreadWindows/PostMessageW refusing) is
      // discarded: the interval retries it and kill is the backstop.
      if (dialogThreadId !== undefined) void closeWindows(dialogThreadId).catch(() => undefined)
    }

    // Sole caller: the once-registered abort listener, so no re-entry guard.
    const serviceAbort = (): void => {
      // The window is about to be closed; raising it now would only flicker.
      stopRaising()
      let attempts = 0
      // The `showing` notice precedes the blocking `Show`, so the very first
      // WM_CLOSE can race the window's creation; re-post until the child
      // reports back, then force-kill as a last resort. The budget is
      // unconditional — an abort before `showing` (child hung in koffi or
      // COM init) still ends in kill instead of a dangling promise.
      closeTimer = setInterval(() => {
        attempts += 1
        if (attempts > CLOSE_MAX_ATTEMPTS) {
          settle(() => {
            worker.kill()
            reject(new Error('native directory picker aborted (dialog unresponsive; worker killed)'))
          })
          return
        }
        postClose()
      }, closeRetryMs)
      postClose()
    }

    const onAbort = (): void => {
      serviceAbort()
    }
    signal.addEventListener('abort', onAbort, { once: true })

    worker.on('message', (message: Win32DialogWorkerMessage) => {
      switch (message.kind) {
        case 'showing':
          dialogThreadId = message.threadId
          // An abort that raced ahead of this notice now has a window to hit.
          if (signal.aborted) postClose()
          else serviceRaise(message.threadId)
          return
        case 'done':
          settle(() => {
            if (signal.aborted) reject(new Error('native directory picker aborted'))
            else resolve(message.path)
          })
          return
        case 'error':
          settle(() => {
            reject(new Error(`win32 folder dialog failed: ${message.message}`))
          })
          return
        /* v8 ignore next 2 -- closed worker-owned union; a fourth kind becomes a compile error */
        default:
          assertNever(message)
      }
    })
    worker.on('error', (error: Error) => {
      settle(() => {
        reject(error)
      })
    })
    worker.on('exit', () => {
      settle(() => {
        reject(new Error('win32 folder dialog worker exited before reporting a result'))
      })
    })
  })
}

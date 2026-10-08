import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'voice-asr'
export const inject = ['webServer']

export interface Config {
  /** Upstream SenseVoice ASR endpoint. */
  asrUrl?: string
  /** Maximum request body size in bytes. */
  maxBytes?: number
  /** Upstream request timeout in milliseconds. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  asrUrl: z.string().default('http://10.19.224.185:50000/api/v1/asr'),
  maxBytes: z.natural().default(25 * 1024 * 1024),
  timeoutMs: z.natural().default(30_000),
})

const DEFAULT_CONFIG: Required<Config> = {
  asrUrl: 'http://10.19.224.185:50000/api/v1/asr',
  maxBytes: 25 * 1024 * 1024,
  timeoutMs: 30_000,
}

/** Read the request body as a buffer. */
async function readBody(req: IncomingMessage, maxSize: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let totalSize = 0
  for await (const chunk of req) {
    totalSize += chunk.length
    if (totalSize > maxSize) {
      throw new Error(`Request body too large (max ${maxSize} bytes)`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** Send a JSON response. */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/** Send an error response. */
function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { ok: false, error: message })
}

interface AsrResult {
  text?: string
  clean_text?: string
}

export function apply(ctx: Context, config: Config = {}): void {
  const asrUrl = config.asrUrl ?? DEFAULT_CONFIG.asrUrl
  const maxBytes = config.maxBytes ?? DEFAULT_CONFIG.maxBytes
  const timeoutMs = config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/voice/asr',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed')
        return
      }
      try {
        const body = await readBody(req, maxBytes)
        // Transparent pass-through: forward the raw multipart body with its
        // original content-type so the upstream boundary stays intact. The
        // client is responsible for including `lang=zh` in the form.
        const upstream = await fetch(asrUrl, {
          method: 'POST',
          body: new Uint8Array(body),
          headers: {
            'content-type': req.headers['content-type'] ?? 'application/octet-stream',
          },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => '')
          sendError(res, 502, `ASR upstream ${upstream.status}: ${text.slice(0, 200)}`)
          return
        }
        const data = await upstream.json() as { result?: AsrResult[] }
        const text = data.result?.[0]?.text ?? data.result?.[0]?.clean_text ?? ''
        sendJson(res, 200, { text })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendError(res, 502, message)
      }
    },
  })
}

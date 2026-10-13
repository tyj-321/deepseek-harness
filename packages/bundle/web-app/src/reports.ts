/** Static skill reports served by the existing DSH HTTP server. */
import { realpath, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

const REPORT_PATH = '/api/skill-reports'
const REPORT_PATTERN = /^\/api\/skill-reports\/([a-f0-9]{32})\/index\.html$/
const MISSING_CODES = new Set(['ENOENT', 'ENOTDIR', 'EISDIR'])

/**
 * Serve only published self-contained HTML. The random report ID is a bearer
 * capability; no directory listing, snapshots, or arbitrary file paths exist.
 * @param dshHome - Harness home shared with the skill process.
 * @returns One effect-scoped prefix route; GET and HEAD survive DSH restarts.
 */
export function makeReportRoute(dshHome: string): WebRoute {
  const root = resolve(dshHome, 'reports')
  return {
    kind: 'prefix', path: REPORT_PATH,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return
      }
      const match = REPORT_PATTERN.exec(new URL(req.url ?? '/', 'http://x').pathname)
      if (!match) { res.writeHead(404); res.end(); return }
      let target: string
      let size: number
      try {
        const realRoot = await realpath(root)
        const reportId = match[1]!
        const expected = join(realRoot, reportId, 'index.html')
        target = await realpath(join(root, reportId, 'index.html'))
        if (target !== expected) { res.writeHead(403); res.end(); return }
        const info = await stat(target)
        if (!info.isFile()) { res.writeHead(404); res.end(); return }
        size = info.size
      } catch (error) {
        if (!MISSING_CODES.has((error as NodeJS.ErrnoException).code ?? '')) throw error
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': size,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        // Scripts can filter/export data but have an opaque origin and cannot
        // read DSH cookies, storage, or call its APIs.
        'content-security-policy': "sandbox allow-scripts allow-downloads; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      })
      if (req.method === 'HEAD') { res.end(); return }
      await pipeline(createReadStream(target), res)
    },
  }
}

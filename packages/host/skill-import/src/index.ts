import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, basename } from 'node:path'
import AdmZip from 'adm-zip'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

export const name = 'skill-import'
export const inject = ['webServer']

export interface Config {
  /** Maximum ZIP file size in bytes (default: 10MB) */
  maxZipSize: number
}

export const Config: z<Config> = z.object({
  maxZipSize: z.natural().default(10 * 1024 * 1024),
})

const DEFAULT_CONFIG: Config = {
  maxZipSize: 10 * 1024 * 1024,
}

interface SkillInfo {
  name: string
  description: string
  path: string
  source: 'user' | 'project' | 'global'
}

/** Parse YAML frontmatter from a Markdown file. */
function parseFrontmatter(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown)
  if (!match || !match[1]) return {}
  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()
    frontmatter[key] = value
  }
  return frontmatter
}

/** Find all directories containing a SKILL.md file in the extracted tree. */
async function findSkillRoots(dir: string): Promise<string[]> {
  const roots: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  // Check if current directory has SKILL.md
  const hasSkillMd = entries.some(e => e.isFile() && (e.name === 'SKILL.md' || e.name === 'skill.md'))
  if (hasSkillMd) {
    roots.push(dir)
    return roots // Don't recurse if current dir is a skill root
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subdir = join(dir, entry.name)
      const subRoots = await findSkillRoots(subdir)
      roots.push(...subRoots)
    }
  }

  return roots
}

/** Sanitize a skill name for use as a directory name. */
function sanitizeName(name: string): string {
  return name.replace(/[/:*?"<>|\\]/g, '-')
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

/**
 * Extract the ZIP bytes from a request body. Accepts either a raw ZIP body
 * (Content-Type: application/zip or octet-stream) or a multipart/form-data
 * body with the archive in the `file` field.
 */
function extractZipBuffer(req: IncomingMessage, body: Buffer): Buffer {
  const contentType = req.headers['content-type'] ?? ''
  if (!contentType.includes('multipart/form-data')) return body

  const boundaryMatch = /boundary=(?:("([^"]+)")|([^;]+))/i.exec(contentType)
  const boundary = boundaryMatch?.[2] ?? boundaryMatch?.[3]
  if (!boundary) throw new Error('Invalid multipart body: missing boundary')

  const delimiter = Buffer.from(`--${boundary}`)
  const start = body.indexOf(delimiter)
  if (start === -1) throw new Error('Invalid multipart body: boundary not found')

  // First part headers end at the first blank line after the opening boundary.
  const headerEnd = body.indexOf('\r\n\r\n', start)
  if (headerEnd === -1) throw new Error('Invalid multipart body: malformed part headers')

  const partStart = headerEnd + 4
  const partEnd = body.indexOf(delimiter, partStart)
  if (partEnd === -1) throw new Error('Invalid multipart body: closing boundary not found')

  // Strip the CRLF that precedes the closing boundary.
  return body.subarray(partStart, partEnd - 2)
}

export function apply(ctx: Context, config: Config = DEFAULT_CONFIG): void {
  const dshHome = resolveDshHome()
  const skillsDir = join(dshHome, 'skills')

  // Ensure directories exist
  void mkdir(skillsDir, { recursive: true })

  // POST /api/skills/import - Upload and extract a ZIP file
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/skills/import',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed')
        return
      }
      try {
        const body = await readBody(req, config.maxZipSize)
        const zip = new AdmZip(extractZipBuffer(req, body))
        const zipEntries = zip.getEntries()

        // Extract to a temporary directory
        const tmpDir = join(tmpdir(), `skill-import-${createHash('sha256').update(body).digest('hex').slice(0, 16)}`)
        await mkdir(tmpDir, { recursive: true })

        try {
          for (const entry of zipEntries) {
            // Security: reject path traversal
            if (entry.entryName.includes('..')) {
              throw new Error(`Unsafe path in ZIP: ${entry.entryName}`)
            }
            const targetPath = join(tmpDir, entry.entryName)
            if (entry.isDirectory) {
              await mkdir(targetPath, { recursive: true })
            } else {
              await mkdir(resolve(targetPath, '..'), { recursive: true })
              await writeFile(targetPath, entry.getData())
            }
          }

          // Find all skill roots
          const skillRoots = await findSkillRoots(tmpDir)
          if (skillRoots.length === 0) {
            throw new Error('No SKILL.md found in ZIP')
          }

          // Copy each skill to ~/.dsh/skills/
          const imported: string[] = []
          for (const skillRoot of skillRoots) {
            const skillMdPath = join(skillRoot, 'SKILL.md')
            const skillMdContent = await readFile(skillMdPath, 'utf8')
            const frontmatter = parseFrontmatter(skillMdContent)
            const skillName = frontmatter.name ?? basename(skillRoot)
            const safeName = sanitizeName(skillName)
            const targetDir = join(skillsDir, safeName)

            // Remove existing skill (overwrite)
            await rm(targetDir, { recursive: true, force: true })

            // Copy skill directory
            await mkdir(targetDir, { recursive: true })
            const entries = await readdir(skillRoot, { withFileTypes: true })
            for (const entry of entries) {
              const srcPath = join(skillRoot, entry.name)
              const destPath = join(targetDir, entry.name)
              if (entry.isDirectory()) {
                await mkdir(destPath, { recursive: true })
                // Recursively copy directory
                const copyDir = async (src: string, dest: string) => {
                  const subEntries = await readdir(src, { withFileTypes: true })
                  for (const subEntry of subEntries) {
                    const subSrcPath = join(src, subEntry.name)
                    const subDestPath = join(dest, subEntry.name)
                    if (subEntry.isDirectory()) {
                      await mkdir(subDestPath, { recursive: true })
                      await copyDir(subSrcPath, subDestPath)
                    } else {
                      await writeFile(subDestPath, await readFile(subSrcPath))
                    }
                  }
                }
                await copyDir(srcPath, destPath)
              } else {
                await writeFile(destPath, await readFile(srcPath))
              }
            }

            imported.push(safeName)
          }

          sendJson(res, 200, { ok: true, imported, count: imported.length })
        } finally {
          // Clean up temporary directory
          await rm(tmpDir, { recursive: true, force: true })
        }
      } catch (error) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      }
    },
  })

  // GET /api/skills/list - Scan ~/.dsh/skills/ and return skill list
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/skills/list',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        sendError(res, 405, 'Method not allowed')
        return
      }
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true })
        const skills: SkillInfo[] = []
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const skillDir = join(skillsDir, entry.name)
          const skillMdPath = join(skillDir, 'SKILL.md')
          try {
            const skillMdContent = await readFile(skillMdPath, 'utf8')
            const frontmatter = parseFrontmatter(skillMdContent)
            skills.push({
              name: frontmatter.name ?? entry.name,
              description: frontmatter.description ?? '',
              path: skillDir,
              source: 'user',
            })
          } catch {
            // Skip directories without SKILL.md
          }
        }
        sendJson(res, 200, skills)
      } catch (error) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      }
    },
  })

  // GET /api/skills/content?name=<name> - Read SKILL.md content
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/skills/content',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        sendError(res, 405, 'Method not allowed')
        return
      }
      try {
        const url = new URL(req.url ?? '', 'http://x')
        const name = url.searchParams.get('name')
        if (!name) {
          sendError(res, 400, 'Missing name parameter')
          return
        }
        const skillMdPath = join(skillsDir, sanitizeName(name), 'SKILL.md')
        const content = await readFile(skillMdPath, 'utf8')
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(content)
      } catch (error) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      }
    },
  })

  // POST /api/skills/delete - Delete a skill
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/skills/delete',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed')
        return
      }
      try {
        const body = await readBody(req, 1024 * 1024) // 1MB max
        const { name } = JSON.parse(body.toString('utf8'))
        if (!name) {
          sendError(res, 400, 'Missing name parameter')
          return
        }
        const skillDir = join(skillsDir, sanitizeName(name))
        await rm(skillDir, { recursive: true, force: true })
        sendJson(res, 200, { ok: true })
      } catch (error) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      }
    },
  })
}

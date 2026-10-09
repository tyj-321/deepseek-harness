import type { ImportResult, SkillInfo } from './types'

const API_BASE = '/api'

export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch(`${API_BASE}/skills/list`)
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.statusText}`)
  return res.json()
}

export async function importSkill(file: File): Promise<ImportResult> {
  // Send the ZIP as a raw binary body instead of multipart/form-data. The
  // server's hand-rolled multipart parser (skill-import extractZipBuffer)
  // truncates the payload if the ZIP bytes happen to contain the boundary
  // string, corrupting the archive ("No END header found"). A raw body
  // sidesteps multipart parsing entirely — the server passes it through
  // unchanged when Content-Type is not multipart/form-data.
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: file,
  })
  if (!res.ok) throw new Error(`Failed to import skill: ${res.statusText}`)
  return res.json()
}

export async function deleteSkill(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Failed to delete skill: ${res.statusText}`)
}

export async function fetchSkillContent(name: string): Promise<string> {
  const res = await fetch(`${API_BASE}/skills/content?name=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Failed to fetch skill content: ${res.statusText}`)
  return res.text()
}

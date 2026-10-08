import type { ImportResult, SkillInfo } from './types'

const API_BASE = '/api'

export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch(`${API_BASE}/skills/list`)
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.statusText}`)
  return res.json()
}

export async function importSkill(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.set('file', file)
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: 'POST',
    body: form,
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

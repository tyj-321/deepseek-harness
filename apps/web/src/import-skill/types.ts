export interface SkillInfo {
  name: string
  description: string
  path: string
  source: 'user' | 'project' | 'global'
}

export interface ImportResult {
  ok: boolean
  imported: string[]
  count: number
  error?: string
}

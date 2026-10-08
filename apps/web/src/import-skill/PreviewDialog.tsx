import { useEffect, useState } from 'react'
import type { SkillInfo } from './types'
import * as api from './api'

interface Props {
  skill: SkillInfo
  onClose: () => void
}

export default function PreviewDialog({ skill, onClose }: Props) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const text = await api.fetchSkillContent(skill.name)
        // Strip YAML frontmatter
        const stripped = text.replace(/^---[\s\S]*?---\s*\n/, '')
        setContent(stripped)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [skill.name])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '8px',
          width: '680px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{skill.name}</h2>
            <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0 0' }}>{skill.path}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            关闭
          </button>
        </div>
        {loading && <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>加载中...</div>}
        {error && (
          <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {content}
          </div>
        )}
      </div>
    </div>
  )
}

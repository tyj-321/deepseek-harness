import { useEffect, useState } from 'react'
import type { SkillInfo } from './types'
import * as api from './api'
import SkillList from './SkillList'
import ImportDialog from './ImportDialog'
import PreviewDialog from './PreviewDialog'

// favicon 的 link href 已被 vite 按 base 重写，直接借来用（免 import.meta.env 类型依赖）
const faviconHref =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '/favicon-32.png'

export default function App() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [previewSkill, setPreviewSkill] = useState<SkillInfo | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const skillsData = await api.fetchSkills()
      setSkills(skillsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleImport = async (file: File) => {
    try {
      const result = await api.importSkill(file)
      if (result.ok) {
        await load()
        setShowImport(false)
        showToast('success', `成功导入 ${result.count} 个技能：${result.imported.join(', ')}`)
      } else {
        showToast('error', `导入失败：${result.error ?? '未知错误'}`)
      }
    } catch (err) {
      showToast('error', `导入失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除技能 "${name}" 吗？`)) return
    try {
      await api.deleteSkill(name)
      await load()
      showToast('success', `已删除技能 "${name}"`)
    } catch (err) {
      showToast('error', `删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handlePreview = (skill: SkillInfo) => {
    setPreviewSkill(skill)
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <img src={faviconHref} alt="ISC 智能助手" width={32} height={32} />
        <span style={{ fontSize: '16px', fontWeight: 600, color: '#2b2b3a' }}>ISC 智能助手</span>
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>技能包管理</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        导入的技能包会在每次对话开头自动出现在可用技能列表里，模型根据描述自主决定是否调用。
      </p>

      {error && (
        <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: '16px', color: '#c00' }}>
          {error}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: toast.kind === 'success' ? '#f0f9eb' : '#fef0f0',
          border: `1px solid ${toast.kind === 'success' ? '#c2e7b0' : '#fbc4c4'}`,
          color: toast.kind === 'success' ? '#529b2e' : '#c45656',
          borderRadius: '4px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          zIndex: 9999,
        }}>
          {toast.text}
        </div>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setShowImport(true)}
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          导入技能包
        </button>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '加载中...' : '重新扫描'}
        </button>
      </div>

      <SkillList
        skills={skills}
        loading={loading}
        onPreview={handlePreview}
        onDelete={handleDelete}
      />

      {showImport && (
        <ImportDialog
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {previewSkill && (
        <PreviewDialog
          skill={previewSkill}
          onClose={() => setPreviewSkill(null)}
        />
      )}
    </div>
  )
}

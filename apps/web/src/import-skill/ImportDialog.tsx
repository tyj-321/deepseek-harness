import { useState } from 'react'

interface Props {
  onImport: (file: File) => Promise<void>
  onClose: () => void
}

export default function ImportDialog({ onImport, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const handleSubmit = async () => {
    if (!file) return
    setImporting(true)
    try {
      await onImport(file)
    } finally {
      setImporting(false)
    }
  }

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
          width: '440px',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>导入技能包</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
          选择一个 ZIP 文件，内含一个或多个 SKILL.md 文件。
        </p>
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: '16px', width: '100%' }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!file || importing}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !file || importing ? 'not-allowed' : 'pointer',
            }}
          >
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}

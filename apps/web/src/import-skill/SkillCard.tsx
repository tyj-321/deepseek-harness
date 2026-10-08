import type { SkillInfo } from './types'

interface Props {
  skill: SkillInfo
  onPreview: () => void
  onDelete: () => void
}

export default function SkillCard({ skill, onPreview, onDelete }: Props) {
  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: 'white',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onClick={onPreview}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{skill.name}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          style={{
            padding: '4px 8px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          删除
        </button>
      </div>
      <p style={{ fontSize: '14px', color: '#666', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {skill.description}
      </p>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
        来源: {skill.source === 'user' ? '用户' : skill.source === 'project' ? '项目' : '全局'}
      </div>
    </div>
  )
}

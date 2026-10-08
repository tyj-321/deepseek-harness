import type { SkillInfo } from './types'
import SkillCard from './SkillCard'

interface Props {
  skills: SkillInfo[]
  loading: boolean
  onPreview: (skill: SkillInfo) => void
  onDelete: (name: string) => void
}

export default function SkillList({ skills, loading, onPreview, onDelete }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', background: '#f5f5f5', height: '120px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', border: '2px dashed #ddd', borderRadius: '8px', color: '#999' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <div>还没有导入任何技能包</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {skills.map(skill => (
        <SkillCard
          key={skill.name}
          skill={skill}
          onPreview={() => onPreview(skill)}
          onDelete={() => onDelete(skill.name)}
        />
      ))}
    </div>
  )
}

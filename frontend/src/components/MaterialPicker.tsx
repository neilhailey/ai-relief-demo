import { useState } from 'react'
import { MATERIAL_PRESETS, CATEGORY_LABELS, type MaterialPreset, type MaterialCategory } from './materialPresets'

interface Props {
  value: MaterialPreset
  onChange: (preset: MaterialPreset) => void
}

const CATEGORIES: MaterialCategory[] = ['wood', 'metal', 'stone', 'resin']

export function MaterialPicker({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Material Preview
      </div>

      {CATEGORIES.map(cat => {
        const presets = MATERIAL_PRESETS.filter(p => p.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>
              {CATEGORY_LABELS[cat]}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map(preset => {
                const isActive  = value.id === preset.id
                const isHovered = hovered === preset.id
                const hex = '#' + preset.color.toString(16).padStart(6, '0')
                return (
                  <button
                    key={preset.id}
                    onClick={() => onChange(preset)}
                    onMouseEnter={() => setHovered(preset.id)}
                    onMouseLeave={() => setHovered(null)}
                    title={preset.label}
                    style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      background: hex,
                      border: isActive
                        ? '2px solid var(--accent)'
                        : isHovered
                          ? '2px solid var(--text-dim)'
                          : '2px solid var(--border)',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 0 0 2px rgba(37,99,235,.4)' : 'none',
                      transition: 'border-color .15s, box-shadow .15s',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {/* Metallic sheen indicator for metal presets */}
                    {preset.metalness > 0.5 && (
                      <span style={{
                        position: 'absolute', inset: 3, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Active label */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
        {value.label}
      </div>
    </div>
  )
}

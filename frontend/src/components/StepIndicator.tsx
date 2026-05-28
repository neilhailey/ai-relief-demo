type Step = 1 | 2 | 3 | 4

const AI_LABELS: Record<Step, string> = {
  1: 'Describe',
  2: 'Choose',
  3: 'Preview',
  4: 'Relief',
}

export const UPLOAD_LABELS: Record<Step, string> = {
  1: 'Upload',
  2: 'Enhance',
  3: 'Preview',
  4: 'Relief',
}

interface Props {
  current: Step
  labels?: Record<Step, string>
}

export function StepIndicator({ current, labels = AI_LABELS }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '20px 0 0', justifyContent: 'center',
    }}>
      {([1, 2, 3, 4] as Step[]).map((n, i) => {
        const done   = n < current
        const active = n === current
        const color  = done ? 'var(--green)' : active ? 'var(--accent-glow)' : 'var(--text-muted)'
        const bg     = done ? 'rgba(5,150,105,.15)' : active ? 'rgba(37,99,235,.2)' : 'transparent'
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{
                width: 32, height: 1,
                background: n <= current ? 'var(--accent)' : 'var(--border)',
                margin: '0 3px',
              }} />
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 20,
              background: bg,
              border: `1px solid ${active ? 'var(--accent)' : done ? 'var(--green)' : 'var(--border-sub)'}`,
              transition: 'all .25s',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff',
              }}>
                {done ? '✓' : n}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color }}>{labels[n]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

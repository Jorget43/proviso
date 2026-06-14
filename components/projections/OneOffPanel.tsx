'use client'

export interface OneOffRow {
  id:   number
  name: string
  amt:  number
  year: number
}

interface OneOffPanelProps {
  oneoffs:  OneOffRow[]
  onAdd:    () => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

export default function OneOffPanel({ oneoffs, onAdd, onUpdate, onDelete }: OneOffPanelProps) {
  const sorted = [...oneoffs].sort((a, b) => a.year - b.year)

  return (
    <>
      <div style={{ fontSize: '0.65rem', color: 'var(--t3)', marginBottom: '0.5rem' }}>Name · Amount · Year</div>
      <div className="da-grid">
        {sorted.map(o => (
          <div key={o.id} className="da-row">
            <input
              className="da-input name"
              defaultValue={o.name}
              onBlur={e => onUpdate(o.id, 'name', e.target.value)}
              placeholder="Name"
              style={{ flex: 1 }}
            />
            <div className="input-prefix" style={{ width: 110 }}>
              <span>$</span>
              <input
                type="number"
                defaultValue={o.amt}
                onBlur={e => onUpdate(o.id, 'amt', parseFloat(e.target.value) || 0)}
              />
            </div>
            <input
              className="da-input narrow"
              type="number"
              defaultValue={o.year}
              onBlur={e => onUpdate(o.id, 'year', parseInt(e.target.value) || o.year)}
            />
            <button className="del-btn" onClick={() => onDelete(o.id)}>×</button>
          </div>
        ))}
      </div>
      <button className="add-btn mt1" onClick={onAdd}>+ Add one-off</button>
    </>
  )
}

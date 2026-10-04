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
      <div className="da-grid">
        {sorted.map(o => (
          <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="da-row">
              <input
                className="da-input name"
                defaultValue={o.name}
                onBlur={e => onUpdate(o.id, 'name', e.target.value)}
                placeholder="Name"
                style={{ flex: 1 }}
              />
              <button className="del-btn" onClick={() => onDelete(o.id)}>×</button>
            </div>
            <div className="da-row" style={{ paddingLeft: 2 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--t3)', minWidth: 40 }}>Amount</span>
              <div className="input-prefix" style={{ flex: 1 }}>
                <span>$</span>
                <input
                  type="number"
                  defaultValue={o.amt}
                  onBlur={e => onUpdate(o.id, 'amt', parseFloat(e.target.value) || 0)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--t3)', marginLeft: 6 }}>Year</span>
              <input
                className="da-input narrow"
                type="number"
                defaultValue={o.year}
                onBlur={e => onUpdate(o.id, 'year', parseInt(e.target.value) || o.year)}
              />
            </div>
          </div>
        ))}
      </div>
      <button className="add-btn mt1" onClick={onAdd}>+ Add one-off</button>
    </>
  )
}

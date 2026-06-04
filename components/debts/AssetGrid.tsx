'use client'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface AssetItem { id: number; name: string; amt: number }

interface AssetGridProps {
  assets: AssetItem[]
  onAdd: () => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

export default function AssetGrid({ assets, onAdd, onUpdate, onDelete }: AssetGridProps) {
  return (
    <Panel title="Assets" dotColor="var(--green)">
      <div className="da-grid">
        {assets.map(a => (
          <div className="da-row" key={a.id}>
            <input
              className="da-input name"
              defaultValue={a.name}
              onBlur={e => onUpdate(a.id, 'name', e.target.value)}
            />
            <div className="input-prefix" style={{ width: 145 }}>
              <span>$</span>
              <input
                type="number"
                defaultValue={a.amt}
                onBlur={e => onUpdate(a.id, 'amt', parseFloat(e.target.value) || 0)}
              />
            </div>
            <button className="del-btn" onClick={() => onDelete(a.id)}>&#215;</button>
          </div>
        ))}
      </div>
      <button className="add-btn mt1" onClick={onAdd}>+ Add asset</button>
      {assets.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
          <span style={{ color: 'var(--t2)' }}>Total assets</span>
          <span style={{ fontWeight: 500, color: 'var(--green)' }}>
            {fmt(assets.reduce((s, a) => s + a.amt, 0))}
          </span>
        </div>
      )}
    </Panel>
  )
}

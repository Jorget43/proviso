'use client'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface DebtItem { id: number; name: string; amt: number }

interface DebtGridProps {
  debts: DebtItem[]
  onAdd: () => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

export default function DebtGrid({ debts, onAdd, onUpdate, onDelete }: DebtGridProps) {
  return (
    <Panel title="Debts" dotColor="var(--red)">
      <div className="da-grid">
        {debts.map(d => (
          <div className="da-row" key={d.id}>
            <input
              className="da-input name"
              defaultValue={d.name}
              onBlur={e => onUpdate(d.id, 'name', e.target.value)}
            />
            <div className="input-prefix" style={{ width: 145 }}>
              <span>$</span>
              <input
                type="number"
                defaultValue={d.amt}
                onBlur={e => onUpdate(d.id, 'amt', parseFloat(e.target.value) || 0)}
              />
            </div>
            <button className="del-btn" onClick={() => onDelete(d.id)}>&#215;</button>
          </div>
        ))}
      </div>
      <button className="add-btn mt1" onClick={onAdd}>+ Add debt</button>
      {debts.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
          <span style={{ color: 'var(--t2)' }}>Total debts</span>
          <span style={{ fontWeight: 500, color: 'var(--red)' }}>
            {fmt(debts.reduce((s, d) => s + d.amt, 0))}
          </span>
        </div>
      )}
    </Panel>
  )
}

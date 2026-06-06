import type { HouseholdSuperResult } from '@/lib/super'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}
function fmtM(n: number) {
  return `$${Math.round(n).toLocaleString('en-AU')}/mo`
}

interface Props {
  result:           HouseholdSuperResult
  jorgeCurrentAge:  number
  jorgeRetirementAge: number
}

export default function SuperBanner({ result, jorgeCurrentAge, jorgeRetirementAge }: Props) {
  const { combinedRetirementTotal, combinedRetirementTotalPV, monthlyIncomeGoal, combinedDepletionAge } = result
  const yearsToRetirement = jorgeRetirementAge - jorgeCurrentAge

  const depletionLabel = combinedDepletionAge
    ? `Age ${combinedDepletionAge}`
    : 'Age 100+'

  const depletionColor = !combinedDepletionAge
    ? 'var(--green)'
    : combinedDepletionAge - jorgeRetirementAge < 20
    ? 'var(--red)'
    : 'var(--amber)'

  return (
    <div className="banner">
      <div className="b-item">
        <div className="b-label">Household super at retirement</div>
        <div className="b-value" style={{ color: 'var(--blue)' }}>{fmt(combinedRetirementTotal)}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">In today's dollars</div>
        <div className="b-value" style={{ color: 'var(--teal)' }}>{fmt(combinedRetirementTotalPV)}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">Monthly income goal</div>
        <div className="b-value">{fmtM(monthlyIncomeGoal)}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">Combined fund depleted</div>
        <div className="b-value" style={{ color: depletionColor }}>{depletionLabel}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">Jorge's years to retirement</div>
        <div className="b-value">{yearsToRetirement}</div>
      </div>
    </div>
  )
}

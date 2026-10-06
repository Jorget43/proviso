// "What applies to us": the life situations that switch whole sections of the
// app on or off. Each flag lives in the settings row of the feature it belongs
// to; this gathers them, and words them the same way on every platform.

export interface Situation {
  partnerEnabled: boolean
  childcare:      boolean   // childcareSettings.enabled
  renting:        boolean   // rentSettings.enabled
  buying:         boolean   // rentSettings.purchasePlanEnabled (only meaningful while renting)
  schoolFees:     boolean   // projectionSettings.schoolFeesOn
  parentalLeave:  boolean   // projectionSettings.parentalLeaveEnabled (needs a partner)
}

/** Builds the situation from the settings rows; missing rows mean "off". */
export function situationFrom(s: {
  partnerEnabled?: boolean | null
  childcare?:  { enabled: boolean } | null
  rent?:       { enabled: boolean; purchasePlanEnabled: boolean } | null
  projection?: { schoolFeesOn: boolean; parentalLeaveEnabled: boolean } | null
}): Situation {
  const partnerEnabled = s.partnerEnabled ?? false
  const renting = s.rent?.enabled ?? false
  return {
    partnerEnabled,
    childcare:     s.childcare?.enabled ?? false,
    renting,
    buying:        renting && (s.rent?.purchasePlanEnabled ?? false),
    schoolFees:    s.projection?.schoolFeesOn ?? false,
    parentalLeave: partnerEnabled && (s.projection?.parentalLeaveEnabled ?? false),
  }
}

/** Short labels for the situations that are switched on, for summaries. */
export function situationLabels(s: Situation, person2Name: string): string[] {
  return [
    s.partnerEnabled ? `With ${person2Name}` : 'Just me',
    s.renting ? (s.buying ? 'Renting, planning to buy' : 'Renting') : 'Own our home',
    ...(s.childcare ? ['Paying for childcare'] : []),
    ...(s.schoolFees ? ['Planning school fees'] : []),
    ...(s.parentalLeave ? ['Parental leave ahead'] : []),
  ]
}

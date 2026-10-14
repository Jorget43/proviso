// People's ages and the household's children (schema v3).
//
// Adults are stored with the year they were born, so their ages move on by
// themselves each January; rows from before v3 only have an age, which is
// used until a device fills the birth year in (birthYearFromAge). Children
// are records with a birth year and, optionally, a month.
//
// Ages here are whole years "this year": an adult's age is the one they reach
// during the year. That's the convention the projection, super and retirement
// engines already use (a person's age goes up by one per projected year).

export interface AgeFacts {
  person1Age: number; person2Age: number
  person1BirthYear?: number | null; person2BirthYear?: number | null
}

/** The birth year that matches an age this year. */
export const birthYearFromAge = (age: number, year: number): number => year - age

/** Each adult's age this year: from the birth year when it's known, else the stored age. */
export function currentAges(f: AgeFacts, year: number): { person1Age: number; person2Age: number } {
  return {
    person1Age: f.person1BirthYear != null ? year - f.person1BirthYear : f.person1Age,
    person2Age: f.person2BirthYear != null ? year - f.person2BirthYear : f.person2Age,
  }
}

/**
 * What to save when someone's birth year is set: the year, and the age it
 * means this year (kept in step for app versions that only read the age).
 */
export function birthYearPatch(person: 1 | 2, birthYear: number, year: number): Record<string, number> {
  return { [`person${person}BirthYear`]: birthYear, [`person${person}Age`]: year - birthYear }
}

/**
 * Keeps an adult's age and birth year together when only one is changed:
 * a new birth year sets the age, a new age (without a birth year) sets the
 * birth year. Returns the fields to add to the update.
 */
export function agesInStep(patch: Partial<AgeFacts>, year: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const n of [1, 2] as const) {
    const born = patch[`person${n}BirthYear`], age = patch[`person${n}Age`]
    if (born != null) out[`person${n}Age`] = year - born
    else if (age != null && born === undefined) out[`person${n}BirthYear`] = year - age
  }
  return out
}

/**
 * Birth years to fill in on rows from before v3, from the stored ages. Empty
 * when there's nothing to do. Person 2's is filled in even without a partner,
 * so switching one on later starts from a sensible age.
 */
export function missingBirthYears(f: AgeFacts, year: number): Record<string, number> {
  return {
    ...(f.person1BirthYear == null ? { person1BirthYear: birthYearFromAge(f.person1Age, year) } : {}),
    ...(f.person2BirthYear == null ? { person2BirthYear: birthYearFromAge(f.person2Age, year) } : {}),
  }
}

// ── Children ─────────────────────────────────────────────────────────────────

export interface ChildLike {
  id?:        string | number   // the app's are strings, the NAS's numbers
  name:       string | null
  birthYear:  number
  birthMonth: number | null
}

/** Eldest first. A missing month counts as the middle of the year. */
export function sortChildren<C extends ChildLike>(children: C[]): C[] {
  const key = (c: C) => c.birthYear * 12 + ((c.birthMonth ?? 6.5) - 1)
  return [...children].sort((a, b) => key(a) - key(b) || String(a.id ?? '').localeCompare(String(b.id ?? '')))
}

/** "Child 2" when a child has no name; n counts from 1, eldest first. */
export const childLabel = (c: ChildLike, n: number): string => c.name?.trim() || `Child ${n}`

/** A child's age in whole years on a date (whole years this year when the month isn't known). */
export function childAge(c: ChildLike, on: Date): number {
  const age = on.getFullYear() - c.birthYear
  if (c.birthMonth == null) return Math.max(0, age)
  return Math.max(0, on.getMonth() + 1 < c.birthMonth ? age - 1 : age)
}

/** Age at which school starts (Prep / Kindergarten / Reception) and ends (Year 12). */
export const SCHOOL_START_AGE = 5
export const SCHOOL_END_AGE   = 17

/**
 * The year a child is at the school-fee schedule's first level (the year
 * before Prep), as the projection's `sfC*Start` expects. Children start Prep
 * in the year they turn 5; state cut-off months aren't modelled.
 */
export const schoolFeeStartYear = (birthYear: number): number => birthYear + SCHOOL_START_AGE - 1

/**
 * School-fee start years for the two eldest children who haven't finished
 * school this year; null when there are no such children. The projection's
 * school-fee model covers two children.
 */
export function schoolStartsFromChildren(children: ChildLike[], year: number): { sfC1Start: number; sfC2Start: number | null } | null {
  const schooling = sortChildren(children).filter(c => year - c.birthYear <= SCHOOL_END_AGE)
  if (!schooling.length) return null
  return {
    sfC1Start: schoolFeeStartYear(schooling[0].birthYear),
    sfC2Start: schooling[1] ? schoolFeeStartYear(schooling[1].birthYear) : null,
  }
}

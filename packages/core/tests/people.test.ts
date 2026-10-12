import { describe, it, expect } from 'vitest'
import {
  currentAges, birthYearFromAge, birthYearPatch, missingBirthYears, agesInStep,
  sortChildren, childLabel, childAge, schoolFeeStartYear, schoolStartsFromChildren,
} from '../src/people'

describe('adult ages', () => {
  it('come from the birth year when known, so they move on each year', () => {
    const f = { person1Age: 40, person2Age: 38, person1BirthYear: 1986, person2BirthYear: 1988 }
    expect(currentAges(f, 2026)).toEqual({ person1Age: 40, person2Age: 38 })
    expect(currentAges(f, 2027)).toEqual({ person1Age: 41, person2Age: 39 })
  })

  it('fall back to the stored age on rows from before birth years', () => {
    expect(currentAges({ person1Age: 45, person2Age: 43, person1BirthYear: null }, 2030)).toEqual({ person1Age: 45, person2Age: 43 })
  })

  it('fill in missing birth years from the stored ages, and nothing when both are there', () => {
    expect(birthYearFromAge(45, 2026)).toBe(1981)
    expect(missingBirthYears({ person1Age: 45, person2Age: 30, person1BirthYear: null, person2BirthYear: null }, 2026))
      .toEqual({ person1BirthYear: 1981, person2BirthYear: 1996 })
    expect(missingBirthYears({ person1Age: 45, person2Age: 30, person1BirthYear: 1980, person2BirthYear: 1990 }, 2026)).toEqual({})
  })

  it('keep age and birth year in step when the NAS saves one of them', () => {
    expect(agesInStep({ person1BirthYear: 1980 }, 2026)).toEqual({ person1Age: 46 })
    expect(agesInStep({ person2Age: 40 }, 2026)).toEqual({ person2BirthYear: 1986 })
    expect(agesInStep({ person1Age: 40, person1BirthYear: null }, 2026)).toEqual({})   // cleared on purpose
    expect(agesInStep({}, 2026)).toEqual({})
  })

  it('save the age with the birth year, for older app versions', () => {
    expect(birthYearPatch(2, 1990, 2026)).toEqual({ person2BirthYear: 1990, person2Age: 36 })
  })
})

describe('children', () => {
  const kids = [
    { id: 'b', name: null, birthYear: 2020, birthMonth: null },
    { id: 'a', name: 'Alex', birthYear: 2020, birthMonth: 3 },
    { id: 'c', name: '  ', birthYear: 2016, birthMonth: 11 },
  ]

  it('sort eldest first; a missing month counts as mid-year', () => {
    expect(sortChildren(kids).map(k => k.id)).toEqual(['c', 'a', 'b'])
  })

  it('are labelled by name, else by position', () => {
    const [c, a] = sortChildren(kids)
    expect(childLabel(c, 1)).toBe('Child 1')
    expect(childLabel(a, 2)).toBe('Alex')
  })

  it('have an age that turns over in their birth month when it’s known', () => {
    const k = { name: null, birthYear: 2020, birthMonth: 6 }
    expect(childAge(k, new Date(2026, 4, 15))).toBe(5)   // May
    expect(childAge(k, new Date(2026, 5, 1))).toBe(6)    // June
    expect(childAge({ ...k, birthMonth: null }, new Date(2026, 0, 1))).toBe(6)
    expect(childAge({ ...k, birthYear: 2027 }, new Date(2026, 0, 1))).toBe(0)  // not born yet
  })

  it('reach the fee schedule’s first level (the year before Prep) the year they turn 4', () => {
    // Born 2020: Kindergarten level in 2024, Prep in 2025 (the year they turn 5).
    expect(schoolFeeStartYear(2020)).toBe(2024)
  })

  it('give school-fee start years for the two eldest still at or before school', () => {
    const family = [
      { name: null, birthYear: 2005, birthMonth: null },  // 21 in 2026: finished school
      { name: null, birthYear: 2015, birthMonth: null },
      { name: null, birthYear: 2019, birthMonth: null },
      { name: null, birthYear: 2023, birthMonth: null },
    ]
    expect(schoolStartsFromChildren(family, 2026)).toEqual({ sfC1Start: 2019, sfC2Start: 2023 })
    expect(schoolStartsFromChildren([family[1]], 2026)).toEqual({ sfC1Start: 2019, sfC2Start: null })
    expect(schoolStartsFromChildren([family[0]], 2026)).toBeNull()
    expect(schoolStartsFromChildren([], 2026)).toBeNull()
  })
})

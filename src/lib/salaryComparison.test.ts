import { describe, expect, it } from 'vitest'
import { compareSalaryProjections } from './salaryComparison'
import { getMunicipality } from './localTaxes'
import { calculateSalaryProjection } from './tax'

describe('salary comparison', () => {
  it('compares the same fiscal profile without losing cents', () => {
    const comparison = compareSalaryProjections(
      {
        grossAnnualSalary: 35_000,
        annualNet: 26_000.25,
        netPerPayPeriod: 2_000.02,
        totalTaxes: 5_750.1,
        employeeContributions: 3_216.5,
      },
      {
        grossAnnualSalary: 40_000,
        annualNet: 28_600.8,
        netPerPayPeriod: 2_200.06,
        totalTaxes: 7_723.2,
        employeeContributions: 3_676,
      },
    )

    expect(comparison).toEqual({
      grossDelta: 5_000,
      annualNetDelta: 2_600.55,
      netPerPayPeriodDelta: 200.04,
      taxesDelta: 1_973.1,
      contributionsDelta: 459.5,
      retainedShare: 0.5201,
    })
  })

  it('returns no retained share when the two salaries are equal', () => {
    const projection = calculateSalaryProjection(35_000)
    expect(compareSalaryProjections(projection, projection).retainedShare).toBeNull()
  })

  it('works in both directions', () => {
    const municipality = getMunicipality('F205')
    const lower = calculateSalaryProjection(35_000, 13, municipality)
    const higher = calculateSalaryProjection(40_000, 13, municipality)
    const increase = compareSalaryProjections(lower, higher)
    const decrease = compareSalaryProjections(higher, lower)

    expect(increase.grossDelta).toBe(5_000)
    expect(increase.annualNetDelta).toBeGreaterThan(0)
    expect(decrease.grossDelta).toBe(-increase.grossDelta)
    expect(decrease.annualNetDelta).toBe(-increase.annualNetDelta)
    expect(decrease.retainedShare).toBeCloseTo(increase.retainedShare!, 8)
  })
})

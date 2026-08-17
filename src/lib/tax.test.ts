import { describe, expect, it } from 'vitest'
import {
  IRPEF_BRACKETS,
  calculateAdditionalEmploymentDeduction,
  calculateEmployeeContributions,
  calculateEmploymentDeduction,
  calculateProgressiveTax,
  calculateSalaryProjection,
  calculateTaxFreeEmploymentSum,
} from './tax'

describe('progressive taxes', () => {
  it('applies all three 2026 IRPEF brackets progressively', () => {
    expect(calculateProgressiveTax(28_000, IRPEF_BRACKETS).total).toBe(6_440)
    expect(calculateProgressiveTax(50_000, IRPEF_BRACKETS).total).toBe(13_700)
    expect(calculateProgressiveTax(60_000, IRPEF_BRACKETS).total).toBe(18_000)
  })

})

describe('employee contributions', () => {
  it('uses the general 9.19% employee share below the extra threshold', () => {
    expect(calculateEmployeeContributions(35_000)).toEqual({
      base: 3_216.5,
      additional: 0,
      total: 3_216.5,
    })
  })

  it('adds 1% only to salary above €56,224', () => {
    expect(calculateEmployeeContributions(60_000)).toEqual({
      base: 5_514,
      additional: 37.76,
      total: 5_551.76,
    })
  })
})

describe('ordinary employee relief', () => {
  it('includes the €65 increase in the statutory income band', () => {
    expect(calculateEmploymentDeduction(28_000, 10_000)).toBe(1_975)
  })

  it('transitions from the tax-free sum to the extra deduction at €20k', () => {
    expect(calculateTaxFreeEmploymentSum(20_000)).toBe(960)
    expect(calculateTaxFreeEmploymentSum(20_000.01)).toBe(0)
    expect(calculateAdditionalEmploymentDeduction(20_000.01, 2_000)).toBe(1_000)
  })
})

describe('salary projection', () => {
  it('returns a coherent annual reconciliation for a standard €35k RAL', () => {
    const result = calculateSalaryProjection(35_000, 13)

    expect(result.grossAnnualSalary - result.totalDeductions + result.totalBenefits).toBeCloseTo(
      result.annualNet,
      2,
    )
    expect(result.taxableIncome).toBe(31_783.5)
    expect(result.netPerPayPeriod * 13).toBeCloseTo(result.annualNet, 1)
  })

  it('does not charge the Milan surcharge at or below its exemption threshold', () => {
    expect(calculateSalaryProjection(24_000).taxableIncome).toBeLessThanOrEqual(23_000)
    expect(calculateSalaryProjection(24_000).municipalTax).toBe(0)
  })

  it('rejects invalid salaries', () => {
    expect(() => calculateSalaryProjection(0)).toThrow(RangeError)
  })
})

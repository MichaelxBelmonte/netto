import { describe, expect, it } from 'vitest'
import {
  IRPEF_BRACKETS,
  calculateAdditionalEmploymentDeduction,
  calculateEmployeeContributions,
  calculateEmploymentDeduction,
  calculateProgressiveTax,
  calculateSalaryProjection,
  calculateSupplementaryTreatment,
  calculateTaxFreeEmploymentSum,
  calculateTheoreticalEmploymentDeduction,
} from './tax'
import { getMunicipality } from './localTaxes'

describe('progressive taxes', () => {
  it('applies all three 2026 IRPEF brackets progressively', () => {
    expect(calculateProgressiveTax(28_000, IRPEF_BRACKETS).total).toBe(6_440)
    expect(calculateProgressiveTax(50_000, IRPEF_BRACKETS).total).toBe(13_700)
    expect(calculateProgressiveTax(60_000, IRPEF_BRACKETS).total).toBe(18_000)
  })

  it('keeps the displayed segments consistent with the total', () => {
    for (const salary of [37_383, 66_072, 35_000.555, 28_000.01, 120_000]) {
      const result = calculateSalaryProjection(salary)
      const segmentsTotal = result.irpefSegments.reduce((sum, segment) => sum + segment.tax, 0)
      expect(Math.round(segmentsTotal * 100) / 100).toBe(result.grossIrpef)
    }
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

  it('adds 1% only to salary above €56,224 (INPS circular 6/2026, par. 5)', () => {
    expect(calculateEmployeeContributions(56_224).additional).toBe(0)
    expect(calculateEmployeeContributions(56_225).additional).toBe(0.01)
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

  it('jumps from the flat €1,955 to the decreasing formula above €15,000', () => {
    expect(calculateTheoreticalEmploymentDeduction(15_000)).toBe(1_955)
    expect(calculateTheoreticalEmploymentDeduction(15_000.01)).toBe(3_100)
    expect(calculateTheoreticalEmploymentDeduction(50_000.01)).toBe(0)
  })

  it('transitions from the tax-free sum to the extra deduction at €20k', () => {
    expect(calculateTaxFreeEmploymentSum(20_000)).toBe(960)
    expect(calculateTaxFreeEmploymentSum(20_000.01)).toBe(0)
    expect(calculateAdditionalEmploymentDeduction(20_000.01, 2_000)).toBe(1_000)
    expect(calculateAdditionalEmploymentDeduction(36_000, 5_000)).toBe(500)
    expect(calculateAdditionalEmploymentDeduction(40_000.01, 5_000)).toBe(0)
  })

  it('checks the supplementary treatment against the theoretical deduction', () => {
    // Imponibile 8.000: IRPEF lorda 1.840 non supera 1.955 − 75 = 1.880 → nessun bonus.
    expect(calculateSupplementaryTreatment(8_000, 1_840)).toBe(0)
    expect(calculateSupplementaryTreatment(8_500, 1_955)).toBe(1_200)
    expect(calculateSalaryProjection(8_000).supplementaryTreatment).toBe(0)
    expect(calculateSalaryProjection(15_000).supplementaryTreatment).toBe(1_200)
  })

  it('drops the €1,200 supplementary treatment when taxable income passes €15,000', () => {
    const below = calculateSalaryProjection(16_518, 13, getMunicipality('F205'))
    const above = calculateSalaryProjection(16_519, 13, getMunicipality('F205'))

    expect(below.taxableIncome).toBe(15_000)
    expect(below.supplementaryTreatment).toBe(1_200)
    expect(below.annualNet).toBe(15_315.5)
    expect(above.supplementaryTreatment).toBe(0)
    expect(above.annualNet).toBe(15_186.14)
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

  it('matches the golden cases computed by hand from the 2026 rules (Milan, 13 pay periods)', () => {
    const milan = getMunicipality('F205')

    const thirtyK = calculateSalaryProjection(30_000, 13, milan)
    expect(thirtyK.employeeContributions).toBe(2_757)
    expect(thirtyK.grossIrpef).toBe(6_265.89)
    expect(thirtyK.employmentDeduction).toBe(2_044.29)
    expect(thirtyK.additionalEmploymentDeduction).toBe(1_000)
    expect(thirtyK.regionalTax).toBe(377.94)
    expect(thirtyK.municipalTax).toBe(217.94)
    expect(thirtyK.annualNet).toBe(23_425.52)

    const thirtyFiveK = calculateSalaryProjection(35_000, 13, milan)
    expect(thirtyFiveK.grossIrpef).toBe(7_688.56)
    expect(thirtyFiveK.employmentDeduction).toBe(1_646.52)
    expect(thirtyFiveK.netIrpef).toBe(5_042.04)
    expect(thirtyFiveK.regionalTax).toBe(454.98)
    expect(thirtyFiveK.municipalTax).toBe(254.27)
    expect(thirtyFiveK.annualNet).toBe(26_032.21)
    expect(thirtyFiveK.netPerPayPeriod).toBe(2_002.48)

    const sixtyK = calculateSalaryProjection(60_000, 13, milan)
    expect(sixtyK.employeeContributions).toBe(5_551.76)
    expect(sixtyK.employmentDeduction).toBe(0)
    expect(sixtyK.annualNet).toBe(37_554.66)
  })

  it('matches the Rome golden case and keeps 12 and 14 pay periods consistent', () => {
    const rome = calculateSalaryProjection(35_000, 13, getMunicipality('H501'))
    expect(rome.regionalTax).toBe(818.39)
    expect(rome.municipalTax).toBe(286.05)
    expect(rome.annualNet).toBe(25_637.02)

    expect(calculateSalaryProjection(35_000, 12).netPerPayPeriod).toBe(2_169.35)
    expect(calculateSalaryProjection(35_000, 14).netPerPayPeriod).toBe(1_859.44)
  })

  it('does not charge the Milan surcharge at or below its exemption threshold', () => {
    expect(calculateSalaryProjection(24_000).taxableIncome).toBeLessThanOrEqual(23_000)
    expect(calculateSalaryProjection(24_000).municipalTax).toBe(0)
  })

  it('skips local surtaxes when no net IRPEF is due', () => {
    const noTax = calculateSalaryProjection(9_360)
    expect(noTax.netIrpef).toBe(0)
    expect(noTax.regionalTax).toBe(0)
    expect(noTax.municipalTax).toBe(0)
  })

  it('rounds the summary ratios to four decimals', () => {
    const result = calculateSalaryProjection(35_000)
    expect(result.takeHomeRate).toBe(0.7438)
    expect(result.taxRate).toBe(0.1643)
  })

  it('rejects invalid salaries', () => {
    expect(() => calculateSalaryProjection(0)).toThrow(RangeError)
  })
})

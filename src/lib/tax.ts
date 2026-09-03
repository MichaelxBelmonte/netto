import {
  calculateMunicipalTax,
  calculateRegionalTax,
  getMunicipality,
  type LocalTaxSegment,
  type Municipality,
  type RegionKey,
} from './localTaxes'

export const TAX_YEAR = 2026
export const MIN_GROSS_SALARY = 15_000
export const MAX_GROSS_SALARY = 120_000

export const TAX_RULES = {
  employeeContributionRate: 0.0919,
  additionalContributionRate: 0.01,
  additionalContributionThreshold: 56_224,
} as const

type ProgressiveBracket = {
  upTo: number
  rate: number
}

export type TaxSegment = {
  from: number
  to: number
  rate: number
  taxableAmount: number
  tax: number
}

export type ProgressiveTaxResult = {
  total: number
  segments: TaxSegment[]
}

export const IRPEF_BRACKETS: readonly ProgressiveBracket[] = [
  { upTo: 28_000, rate: 0.23 },
  { upTo: 50_000, rate: 0.33 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.43 },
]

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const ratio = (value: number) => Math.round(value * 10_000) / 10_000

export function calculateProgressiveTax(
  taxableIncome: number,
  brackets: readonly ProgressiveBracket[],
): ProgressiveTaxResult {
  const income = Math.max(0, taxableIncome)
  let lowerBound = 0
  let total = 0
  const segments: TaxSegment[] = []

  for (const bracket of brackets) {
    const upperBound = bracket.upTo
    const taxableAmount = Math.max(0, Math.min(income, upperBound) - lowerBound)

    if (taxableAmount > 0) {
      // Round each segment before summing so that the displayed segments always add up to the total.
      const tax = money(taxableAmount * bracket.rate)
      total += tax
      segments.push({
        from: lowerBound,
        to: Number.isFinite(upperBound) ? upperBound : income,
        rate: bracket.rate,
        taxableAmount: money(taxableAmount),
        tax,
      })
    }

    if (income <= upperBound) break
    lowerBound = upperBound
  }

  return { total: money(total), segments }
}

export function calculateEmployeeContributions(grossAnnualSalary: number) {
  const base = grossAnnualSalary * TAX_RULES.employeeContributionRate
  const amountAboveThreshold = Math.max(
    0,
    grossAnnualSalary - TAX_RULES.additionalContributionThreshold,
  )
  const additional = amountAboveThreshold * TAX_RULES.additionalContributionRate

  return {
    base: money(base),
    additional: money(additional),
    total: money(base + additional),
  }
}

/**
 * Detrazione per lavoro dipendente teoricamente spettante (art. 13 c. 1 e 1.1 TUIR),
 * prima del limite dell'imposta lorda. Serve anche al test di capienza del trattamento integrativo.
 */
export function calculateTheoreticalEmploymentDeduction(taxableIncome: number) {
  let deduction = 0

  if (taxableIncome <= 15_000) {
    deduction = 1_955
  } else if (taxableIncome <= 28_000) {
    deduction = 1_910 + 1_190 * ((28_000 - taxableIncome) / 13_000)
  } else if (taxableIncome <= 50_000) {
    deduction = 1_910 * ((50_000 - taxableIncome) / 22_000)
  }

  if (taxableIncome > 25_000 && taxableIncome <= 35_000) {
    deduction += 65
  }

  return money(Math.max(0, deduction))
}

export function calculateEmploymentDeduction(taxableIncome: number, grossIrpef: number) {
  return money(Math.min(calculateTheoreticalEmploymentDeduction(taxableIncome), grossIrpef))
}

export function calculateAdditionalEmploymentDeduction(
  taxableIncome: number,
  residualIrpef: number,
) {
  let deduction = 0

  if (taxableIncome > 20_000 && taxableIncome <= 32_000) {
    deduction = 1_000
  } else if (taxableIncome > 32_000 && taxableIncome <= 40_000) {
    deduction = 1_000 * ((40_000 - taxableIncome) / 8_000)
  }

  return money(Math.min(Math.max(0, deduction), Math.max(0, residualIrpef)))
}

export function calculateTaxFreeEmploymentSum(taxableIncome: number) {
  if (taxableIncome <= 0 || taxableIncome > 20_000) return 0

  const rate = taxableIncome <= 8_500 ? 0.071 : taxableIncome <= 15_000 ? 0.053 : 0.048
  return money(taxableIncome * rate)
}

/**
 * Trattamento integrativo (D.L. 3/2020 art. 1): spetta se il reddito non supera 15.000 €
 * e l'imposta lorda supera la detrazione art. 13 teoricamente spettante diminuita di 75 €.
 * La detrazione teorica viene ricalcolata qui dall'imponibile: passare quella già limitata
 * all'imposta lorda renderebbe la condizione sempre vera per gli incapienti.
 */
export function calculateSupplementaryTreatment(taxableIncome: number, grossIrpef: number) {
  const qualifyingTax = Math.max(0, calculateTheoreticalEmploymentDeduction(taxableIncome) - 75)
  return taxableIncome <= 15_000 && grossIrpef > qualifyingTax ? 1_200 : 0
}

export type SalaryProjection = {
  grossAnnualSalary: number
  payPeriods: 12 | 13 | 14
  municipalityCode: string
  municipalityName: string
  municipalityProvince: string
  regionKey: RegionKey
  localRuleYear: number
  localRuleSpecial: boolean
  employeeContributions: number
  baseContributions: number
  additionalContributions: number
  taxableIncome: number
  grossIrpef: number
  irpefSegments: TaxSegment[]
  employmentDeduction: number
  additionalEmploymentDeduction: number
  netIrpef: number
  regionalTax: number
  regionalSegments: LocalTaxSegment[]
  regionalAdjustment: number
  municipalTax: number
  municipalSegments: LocalTaxSegment[]
  municipalExemptionApplied: boolean
  taxFreeEmploymentSum: number
  supplementaryTreatment: number
  totalBenefits: number
  totalTaxes: number
  totalDeductions: number
  annualNet: number
  netPerPayPeriod: number
  grossPerPayPeriod: number
  takeHomeRate: number
  taxRate: number
}

export function calculateSalaryProjection(
  grossAnnualSalary: number,
  payPeriods: 12 | 13 | 14 = 13,
  municipality: Municipality = getMunicipality('F205'),
): SalaryProjection {
  if (!Number.isFinite(grossAnnualSalary) || grossAnnualSalary <= 0) {
    throw new RangeError('La RAL deve essere un numero positivo.')
  }

  const contributions = calculateEmployeeContributions(grossAnnualSalary)
  const taxableIncome = money(grossAnnualSalary - contributions.total)
  const irpef = calculateProgressiveTax(taxableIncome, IRPEF_BRACKETS)
  const employmentDeduction = calculateEmploymentDeduction(taxableIncome, irpef.total)
  const residualAfterEmploymentDeduction = Math.max(0, irpef.total - employmentDeduction)
  const additionalEmploymentDeduction = calculateAdditionalEmploymentDeduction(
    taxableIncome,
    residualAfterEmploymentDeduction,
  )
  const netIrpef = money(
    Math.max(0, irpef.total - employmentDeduction - additionalEmploymentDeduction),
  )

  const owesLocalTaxes = netIrpef > 0
  const regional = owesLocalTaxes
    ? calculateRegionalTax(taxableIncome, municipality.g)
    : { total: 0, segments: [], adjustment: 0 }
  const municipal = owesLocalTaxes
    ? calculateMunicipalTax(taxableIncome, municipality)
    : { total: 0, segments: [], adjustment: 0, exemptionApplied: false }

  const taxFreeEmploymentSum = calculateTaxFreeEmploymentSum(taxableIncome)
  const supplementaryTreatment = calculateSupplementaryTreatment(taxableIncome, irpef.total)
  const totalBenefits = money(taxFreeEmploymentSum + supplementaryTreatment)
  const totalTaxes = money(netIrpef + regional.total + municipal.total)
  const totalDeductions = money(contributions.total + totalTaxes)
  const annualNet = money(grossAnnualSalary - totalDeductions + totalBenefits)

  return {
    grossAnnualSalary: money(grossAnnualSalary),
    payPeriods,
    municipalityCode: municipality.c,
    municipalityName: municipality.n,
    municipalityProvince: municipality.p,
    regionKey: municipality.g,
    localRuleYear: municipality.y,
    localRuleSpecial: municipality.s === 1,
    employeeContributions: contributions.total,
    baseContributions: contributions.base,
    additionalContributions: contributions.additional,
    taxableIncome,
    grossIrpef: irpef.total,
    irpefSegments: irpef.segments,
    employmentDeduction,
    additionalEmploymentDeduction,
    netIrpef,
    regionalTax: regional.total,
    regionalSegments: regional.segments,
    regionalAdjustment: regional.adjustment,
    municipalTax: municipal.total,
    municipalSegments: municipal.segments,
    municipalExemptionApplied: municipal.exemptionApplied,
    taxFreeEmploymentSum,
    supplementaryTreatment,
    totalBenefits,
    totalTaxes,
    totalDeductions,
    annualNet,
    netPerPayPeriod: money(annualNet / payPeriods),
    grossPerPayPeriod: money(grossAnnualSalary / payPeriods),
    takeHomeRate: ratio(annualNet / grossAnnualSalary),
    taxRate: ratio(totalTaxes / grossAnnualSalary),
  }
}

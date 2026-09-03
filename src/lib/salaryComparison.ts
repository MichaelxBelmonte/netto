import type { SalaryProjection } from './tax'

type ComparableSalary = Pick<
  SalaryProjection,
  | 'grossAnnualSalary'
  | 'annualNet'
  | 'netPerPayPeriod'
  | 'totalTaxes'
  | 'employeeContributions'
>

export type SalaryComparison = {
  grossDelta: number
  annualNetDelta: number
  netPerPayPeriodDelta: number
  taxesDelta: number
  contributionsDelta: number
  retainedShare: number | null
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/** Confronta due RAL calcolate con lo stesso profilo fiscale. */
export function compareSalaryProjections(
  current: ComparableSalary,
  alternative: ComparableSalary,
): SalaryComparison {
  const grossDelta = money(alternative.grossAnnualSalary - current.grossAnnualSalary)
  const annualNetDelta = money(alternative.annualNet - current.annualNet)

  return {
    grossDelta,
    annualNetDelta,
    netPerPayPeriodDelta: money(
      alternative.netPerPayPeriod - current.netPerPayPeriod,
    ),
    taxesDelta: money(alternative.totalTaxes - current.totalTaxes),
    contributionsDelta: money(
      alternative.employeeContributions - current.employeeContributions,
    ),
    retainedShare:
      grossDelta === 0 ? null : Math.round((annualNetDelta / grossDelta) * 10_000) / 10_000,
  }
}

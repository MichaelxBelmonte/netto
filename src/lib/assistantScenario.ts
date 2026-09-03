import { calculateEmployerCost, type EmployerSector, type EmployerSize } from './employerCost'
import { MUNICIPALITIES, getMunicipality, type Municipality } from './localTaxes'
import {
  MAX_GROSS_SALARY,
  MIN_GROSS_SALARY,
  calculateSalaryProjection,
} from './tax'
import type { AssistantSnapshot } from './assistantContext'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const englishCityAliases: Record<string, string[]> = {
  H501: ['Rome'],
  F205: ['Milan'],
  F839: ['Naples'],
  D612: ['Florence'],
  L219: ['Turin'],
  L736: ['Venice'],
  D969: ['Genoa'],
}

const municipalityNames = MUNICIPALITIES.flatMap((municipality) =>
  [municipality.n, ...(municipality.a ?? []), ...(englishCityAliases[municipality.c] ?? [])]
    .map(normalize)
    .filter((name) => name.length >= 3)
    .map((name) => ({ name, municipality })),
).sort((a, b) => b.name.length - a.name.length)

function findMentionedMunicipality(question: string): Municipality | undefined {
  const normalized = ` ${normalize(question)} `
  return municipalityNames.find(({ name }) => normalized.includes(` ${name} `))?.municipality
}

function findMentionedSalary(question: string) {
  const normalized = normalize(question)
  const compact = normalized.match(/(?:^|\s)(\d{2,3})(?:[.,]?\d)?\s*k(?:\s|$)/)
  const thousands = normalized.match(/(?:^|\s)(\d{2,3})\s*(?:mila|thousand)(?:\s|$)/)
  const full = question.match(/(?:^|\D)(\d{2,3})[.\s](\d{3})(?:\D|$)/)
  const plain = question.match(/(?:^|\D)(\d{5,6})(?:\D|$)/)
  const salary = compact
    ? Number(compact[1]) * 1_000
    : thousands
      ? Number(thousands[1]) * 1_000
      : full
        ? Number(`${full[1]}${full[2]}`)
        : plain
          ? Number(plain[1])
          : undefined

  return salary !== undefined && salary >= MIN_GROSS_SALARY && salary <= MAX_GROSS_SALARY
    ? salary
    : undefined
}

function findMentionedPayPeriods(question: string): 12 | 13 | 14 | undefined {
  const match = normalize(question).match(
    /(?:^|\s)(12|13|14)\s*(?:mensilita|stipendi|buste|pay periods|payments)(?:\s|$)/,
  )
  return match ? (Number(match[1]) as 12 | 13 | 14) : undefined
}

function findEmployerProfile(question: string, snapshot: AssistantSnapshot) {
  const normalized = ` ${normalize(question)} `
  let sector: EmployerSector = snapshot.employerCost.sector
  let size: EmployerSize = snapshot.employerCost.size

  if (/\b(?:industria|industriale|industry|industrial)\b/.test(normalized)) sector = 'industry'
  if (/\b(?:commercio|terziario|commerce|retail)\b/.test(normalized)) sector = 'commerce'
  if (/\b(?:oltre|piu di|more than|over)\s*15\b/.test(normalized)) size = 'over15'
  else if (/\b(?:da|from)\s*6\s*(?:a|to)\s*15\b/.test(normalized)) size = 'from6to15'
  else if (/\b(?:fino a|up to)\s*5\b/.test(normalized)) size = 'upTo5'

  return { sector, size }
}

/**
 * Estrae soltanto input espliciti dalla domanda e affida tutti i numeri al motore fiscale.
 * Gli input omessi restano quelli dello scenario corrente, così i follow-up sono naturali.
 */
export function resolveAssistantScenario(
  question: string,
  current: AssistantSnapshot,
): AssistantSnapshot {
  const municipality = findMentionedMunicipality(question) ?? getMunicipality(current.result.municipalityCode)
  const salary = findMentionedSalary(question) ?? current.result.grossAnnualSalary
  const payPeriods = findMentionedPayPeriods(question) ?? current.result.payPeriods
  const employerProfile = findEmployerProfile(question, current)
  const result = calculateSalaryProjection(salary, payPeriods, municipality)
  const changed =
    result.grossAnnualSalary !== current.result.grossAnnualSalary ||
    result.payPeriods !== current.result.payPeriods ||
    result.municipalityCode !== current.result.municipalityCode

  return {
    ...current,
    result,
    reference: changed ? current.result : current.reference,
    comparison: current.comparison
      ? calculateSalaryProjection(current.comparison.grossAnnualSalary, payPeriods, municipality)
      : undefined,
    cityComparisons: current.cityComparisons.map((item) =>
      calculateSalaryProjection(salary, payPeriods, getMunicipality(item.municipalityCode)),
    ),
    employerCost: calculateEmployerCost(salary, employerProfile),
  }
}

export function updateAssistantScenario(
  current: AssistantSnapshot,
  input: { salary?: number; municipalityCode?: string; payPeriods?: 12 | 13 | 14 },
) {
  const municipality = getMunicipality(input.municipalityCode ?? current.result.municipalityCode)
  const salary = input.salary ?? current.result.grossAnnualSalary
  const payPeriods = input.payPeriods ?? current.result.payPeriods
  const result = calculateSalaryProjection(salary, payPeriods, municipality)

  return {
    ...current,
    result,
    reference: current.result,
    comparison: current.comparison
      ? calculateSalaryProjection(current.comparison.grossAnnualSalary, payPeriods, municipality)
      : undefined,
    cityComparisons: current.cityComparisons.map((item) =>
      calculateSalaryProjection(salary, payPeriods, getMunicipality(item.municipalityCode)),
    ),
    employerCost: calculateEmployerCost(salary, {
      sector: current.employerCost.sector,
      size: current.employerCost.size,
    }),
  } satisfies AssistantSnapshot
}

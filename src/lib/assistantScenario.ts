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

export function findMentionedMunicipalities(question: string): Municipality[] {
  const normalized = ` ${normalize(question)} `
  const matches: Municipality[] = []
  for (const { name, municipality } of municipalityNames) {
    if (
      normalized.includes(` ${name} `) &&
      !matches.some((item) => item.c === municipality.c)
    ) matches.push(municipality)
  }
  return matches
}

export function findMentionedSalaries(question: string) {
  const normalized = normalize(question)
  const pattern = /\b(?:(\d{2,3})(?:[.,](\d))?\s*k|(\d{2,3})\s*(?:mila|thousand)|(\d{2,3})\s+(\d{3})|(\d{5,6}))\b/g
  const salaries: number[] = []

  for (const match of normalized.matchAll(pattern)) {
    const salary = match[1]
      ? Math.round(Number(`${match[1]}.${match[2] ?? '0'}`) * 1_000)
      : match[3]
        ? Number(match[3]) * 1_000
        : match[4] && match[5]
          ? Number(`${match[4]}${match[5]}`)
          : Number(match[6])
    if (
      salary >= MIN_GROSS_SALARY &&
      salary <= MAX_GROSS_SALARY &&
      salaries.at(-1) !== salary
    ) salaries.push(salary)
  }

  if (salaries.length < 2 && /\b(?:tra|fra|versus|vs|differenza|confront|compare|between)\b/.test(normalized)) {
    for (const match of normalized.matchAll(/\b(\d{2,3})\b/g)) {
      const salary = Number(match[1]) * 1_000
      if (
        salary >= MIN_GROSS_SALARY &&
        salary <= MAX_GROSS_SALARY &&
        !salaries.includes(salary)
      ) salaries.push(salary)
    }
  }

  return salaries
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
  const municipality = findMentionedMunicipalities(question)[0] ?? getMunicipality(current.result.municipalityCode)
  const salaries = findMentionedSalaries(question)
  const salary = salaries[0] ?? current.result.grossAnnualSalary
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
    comparison: salaries[1]
      ? calculateSalaryProjection(salaries[1], payPeriods, municipality)
      : current.comparison
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

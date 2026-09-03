import { calculateEmployerCost, type EmployerSector, type EmployerSize } from './employerCost'
import { getMunicipality, getRegionName } from './localTaxes'
import { calculateSalaryProjection } from './tax'
import type { AssistantSnapshot } from './assistantContext'
import { findMentionedMunicipalities, findMentionedSalaries } from './assistantScenario'

export type AssistantPlan = {
  salaries: number[]
  municipalityCodes: string[]
  payPeriods: 12 | 13 | 14
  includeEmployerCost: boolean
}

export type AssistantAnalysis = {
  context: string
  fallback: string
  scenarioCount: number
}

const wantsEmployerCost = (question: string) =>
  /(?:costo|costi|azienda|datore|employer|company cost)/i.test(question)

const wantsMunicipalityComparison = (question: string) =>
  /(?:comun[ei]|città|citta|municipalit|city|cities|milano|roma|napoli|torino|bologna|palermo)/i.test(question)

const wantsComparisonFollowUp = (question: string) =>
  /(?:spiega|meglio|approfond|differenza|confront|cosa cambia|explain|clarify|compare|difference)/i.test(question)

export function buildDeterministicAssistantPlan(
  question: string,
  snapshot: AssistantSnapshot,
): AssistantPlan {
  const mentionedSalaries = findMentionedSalaries(question)
  const mentionedMunicipalities = findMentionedMunicipalities(question)
  return {
    salaries: mentionedSalaries.length
      ? mentionedSalaries
      : wantsComparisonFollowUp(question) && snapshot.comparison
        ? [snapshot.result.grossAnnualSalary, snapshot.comparison.grossAnnualSalary]
        : [snapshot.result.grossAnnualSalary],
    municipalityCodes: mentionedMunicipalities.length
      ? mentionedMunicipalities.map((item) => item.c)
      : wantsMunicipalityComparison(question)
        ? snapshot.cityComparisons.map((item) => item.municipalityCode)
        : [snapshot.result.municipalityCode],
    payPeriods: snapshot.result.payPeriods,
    includeEmployerCost: wantsEmployerCost(question),
  }
}

export function getAssistantPlannerPrompt(snapshot: AssistantSnapshot) {
  return `You plan calls to a verified Italian tax engine. Return ONLY JSON, without markdown.
Schema: {"salaries":number[],"municipalities":string[],"payPeriods":12|13|14,"includeEmployerCost":boolean}.
Extract every salary and municipality explicitly requested, preserving their order. Values like 35k or 35 mean 35000 only when used as salary comparisons. If omitted, use current values.
Current salary: ${snapshot.result.grossAnnualSalary}
Current municipality: ${snapshot.result.municipalityName}
Current pay periods: ${snapshot.result.payPeriods}
Never calculate taxes or net salary.`
}

export function parseAssistantPlan(
  text: string,
  fallback: AssistantPlan,
): AssistantPlan {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return fallback
  try {
    const parsed = JSON.parse(json) as {
      salaries?: unknown
      municipalities?: unknown
      payPeriods?: unknown
      includeEmployerCost?: unknown
    }
    const parsedSalaries = Array.isArray(parsed.salaries)
      ? parsed.salaries
          .map(Number)
          .filter((salary) => salary >= 15_000 && salary <= 120_000)
          .slice(0, 4)
      : []
    const parsedMunicipalityCodes = Array.isArray(parsed.municipalities)
      ? parsed.municipalities
          .map(String)
          .map((query) => findMentionedMunicipalities(query)[0]?.c)
          .filter((code): code is string => Boolean(code))
          .slice(0, 6)
      : []
    const containsFallbackSalaries = fallback.salaries.every((salary) =>
      parsedSalaries.includes(salary),
    )
    const containsFallbackMunicipalities = fallback.municipalityCodes.every((code) =>
      parsedMunicipalityCodes.includes(code),
    )
    return {
      salaries: parsedSalaries.length && containsFallbackSalaries
        ? parsedSalaries
        : fallback.salaries,
      municipalityCodes: parsedMunicipalityCodes.length && containsFallbackMunicipalities
        ? parsedMunicipalityCodes
        : fallback.municipalityCodes,
      payPeriods: parsed.payPeriods === 12 || parsed.payPeriods === 13 || parsed.payPeriods === 14
        ? parsed.payPeriods
        : fallback.payPeriods,
      includeEmployerCost: typeof parsed.includeEmployerCost === 'boolean'
        ? parsed.includeEmployerCost
        : fallback.includeEmployerCost,
    }
  } catch {
    return fallback
  }
}

export function buildAssistantAnalysis(
  question: string,
  snapshot: AssistantSnapshot,
  plan = buildDeterministicAssistantPlan(question, snapshot),
): AssistantAnalysis {
  const language = snapshot.language
  const it = language === 'it'
  const locale = it ? 'it-IT' : 'en-IE'
  const currency = new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent', maximumFractionDigits: 1,
  })
  const salaries = plan.salaries
  const uniqueMunicipalityCodes = [...new Set(plan.municipalityCodes)]
  const payPeriods = plan.payPeriods
  const employerProfile = {
    sector: snapshot.employerCost.sector as EmployerSector,
    size: snapshot.employerCost.size as EmployerSize,
  }

  const scenarios = salaries.flatMap((salary) =>
    uniqueMunicipalityCodes.map((municipalityCode) => {
      const municipality = getMunicipality(municipalityCode)
      const projection = calculateSalaryProjection(salary, payPeriods, municipality)
      const employerCost = calculateEmployerCost(salary, employerProfile)
      return { projection, employerCost, municipality }
    }),
  )
  const baseline = scenarios[0]
  if (!baseline) throw new Error('No assistant scenarios available.')

  const rows = scenarios.map(({ projection, employerCost }, index) => {
    const annualDelta = projection.annualNet - baseline.projection.annualNet
    return [
      `SCENARIO ${index + 1}`,
      `RAL=${currency.format(projection.grossAnnualSalary)}`,
      `Comune=${projection.municipalityName} (${projection.municipalityProvince})`,
      `Regione=${getRegionName(projection.regionKey, language)}`,
      `Mensilità=${projection.payPeriods}`,
      `Netto annuo=${currency.format(projection.annualNet)}`,
      `Netto mensile=${currency.format(projection.netPerPayPeriod)}`,
      `INPS dipendente=${currency.format(projection.employeeContributions)}`,
      `Imposte=${currency.format(projection.totalTaxes)}`,
      `Costo azienda=${currency.format(employerCost.totalCost)}`,
      `Oneri azienda=${currency.format(employerCost.totalCost - employerCost.grossAnnualSalary)}`,
      `Delta netto vs scenario 1=${currency.format(annualDelta)}`,
    ].join(' | ')
  })

  let fallback: string
  if (salaries.length >= 2 && uniqueMunicipalityCodes.length === 1) {
    const first = scenarios[0]
    const second = scenarios.find((item) => item.projection.grossAnnualSalary === salaries[1])
    if (!first || !second) throw new Error('Comparison scenario missing.')
    const grossDelta = second.projection.grossAnnualSalary - first.projection.grossAnnualSalary
    const netDelta = second.projection.annualNet - first.projection.annualNet
    const employerDelta = second.employerCost.totalCost - first.employerCost.totalCost
    fallback = it
      ? `Passando da ${currency.format(first.projection.grossAnnualSalary)} a ${currency.format(second.projection.grossAnnualSalary)} a ${first.projection.municipalityName}, il netto annuo cambia di ${currency.format(netDelta)} e il costo aziendale di ${currency.format(employerDelta)}. Del delta lordo resta netto il ${grossDelta === 0 ? '—' : percent.format(netDelta / grossDelta)}.`
      : `Moving from ${currency.format(first.projection.grossAnnualSalary)} to ${currency.format(second.projection.grossAnnualSalary)} in ${first.projection.municipalityName}, annual net changes by ${currency.format(netDelta)} and employer cost by ${currency.format(employerDelta)}. The employee retains ${grossDelta === 0 ? '—' : percent.format(netDelta / grossDelta)} of the gross difference.`
  } else if (uniqueMunicipalityCodes.length >= 2) {
    const sorted = [...scenarios].sort((a, b) => b.projection.annualNet - a.projection.annualNet)
    const best = sorted[0] ?? baseline
    const worst = sorted.at(-1) ?? baseline
    const scenarioSummary = scenarios.length <= 8
      ? scenarios.map(({ projection }) =>
          `${currency.format(projection.grossAnnualSalary)} · ${projection.municipalityName}: ${currency.format(projection.annualNet)} ${it ? 'netti annui' : 'annual net'}`,
        ).join('\n')
      : ''
    const employerSummary = salaries.length >= 2
      ? (() => {
          const firstCost = calculateEmployerCost(salaries[0] ?? snapshot.result.grossAnnualSalary, employerProfile).totalCost
          const lastCost = calculateEmployerCost(salaries.at(-1) ?? snapshot.result.grossAnnualSalary, employerProfile).totalCost
          return it
            ? `Costo azienda: ${currency.format(firstCost)} → ${currency.format(lastCost)} (${currency.format(lastCost - firstCost)}).`
            : `Employer cost: ${currency.format(firstCost)} -> ${currency.format(lastCost)} (${currency.format(lastCost - firstCost)}).`
        })()
      : ''
    fallback = it
      ? `${scenarioSummary}\nTra gli scenari richiesti, il netto più alto è ${currency.format(best.projection.annualNet)} a ${best.projection.municipalityName}; il più basso è ${currency.format(worst.projection.annualNet)} a ${worst.projection.municipalityName}. Differenza: ${currency.format(best.projection.annualNet - worst.projection.annualNet)} all’anno. ${employerSummary}`.trim()
      : `${scenarioSummary}\nAcross the requested scenarios, the highest annual net is ${currency.format(best.projection.annualNet)} in ${best.projection.municipalityName}; the lowest is ${currency.format(worst.projection.annualNet)} in ${worst.projection.municipalityName}. Difference: ${currency.format(best.projection.annualNet - worst.projection.annualNet)} per year. ${employerSummary}`.trim()
  } else {
    const item = baseline
    fallback = it
      ? `Con una RAL di ${currency.format(item.projection.grossAnnualSalary)} a ${item.projection.municipalityName}, il netto stimato è ${currency.format(item.projection.annualNet)} all’anno e il costo aziendale è ${currency.format(item.employerCost.totalCost)}.`
      : `With a ${currency.format(item.projection.grossAnnualSalary)} salary in ${item.projection.municipalityName}, estimated annual net is ${currency.format(item.projection.annualNet)} and employer cost is ${currency.format(item.employerCost.totalCost)}.`
  }

  return {
    scenarioCount: scenarios.length,
    fallback,
    context: `MULTI-SCENARIO ENGINE RESULTS — authoritative, do not recompute.\nUser intent includes employer cost: ${plan.includeEmployerCost}\n${rows.join('\n')}`,
  }
}

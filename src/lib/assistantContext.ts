import type { EmployerCostResult } from './employerCost'
import type { SalaryProjection } from './tax'

export type AssistantLanguage = 'it' | 'en'
export type GuidedQuestion = 'takeHome' | 'salaryChange' | 'municipalities' | 'employerCost'

export type AssistantSnapshot = {
  result: SalaryProjection
  comparison?: SalaryProjection
  reference?: SalaryProjection
  cityComparisons: SalaryProjection[]
  employerCost: EmployerCostResult
  language: AssistantLanguage
}

const formatters = (language: AssistantLanguage) => {
  const locale = language === 'it' ? 'it-IT' : 'en-IE'
  return {
    currency: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }),
    percent: new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
    }),
  }
}

export function buildAssistantContext(snapshot: AssistantSnapshot) {
  const { result, comparison, reference, cityComparisons, employerCost, language } = snapshot
  const { currency, percent } = formatters(language)
  const salaryDelta = comparison ? comparison.grossAnnualSalary - result.grossAnnualSalary : 0
  const netDelta = comparison ? comparison.annualNet - result.annualNet : 0
  const cityLines = cityComparisons
    .map(
      (item) =>
        `- ${item.municipalityName} (${item.municipalityProvince}): ${currency.format(item.annualNet)} annual net`,
    )
    .join('\n')

  return `AUTHORITATIVE CALCULATION — never change or recompute these numbers.
Language: ${language === 'it' ? 'Italian' : 'English'}
Tax year: 2026
Profile: permanent private employee, full year, no dependants or other income
Municipality: ${result.municipalityName} (${result.municipalityProvince})
Gross annual salary: ${currency.format(result.grossAnnualSalary)}
Pay periods: ${result.payPeriods}
Net per pay period: ${currency.format(result.netPerPayPeriod)}
Annual net: ${currency.format(result.annualNet)}
Employee INPS contributions: ${currency.format(result.employeeContributions)}
Taxable income: ${currency.format(result.taxableIncome)}
Gross income tax: ${currency.format(result.grossIrpef)}
Employment deductions: ${currency.format(result.employmentDeduction + result.additionalEmploymentDeduction)}
Net income tax: ${currency.format(result.netIrpef)}
Regional surtax: ${currency.format(result.regionalTax)}
Municipal surtax: ${currency.format(result.municipalTax)}
Tax bonuses: ${currency.format(result.totalBenefits)}
Take-home rate: ${percent.format(result.takeHomeRate)}
${comparison ? `Alternative salary: ${currency.format(comparison.grossAnnualSalary)}
Alternative annual net: ${currency.format(comparison.annualNet)}
Gross difference: ${currency.format(salaryDelta)}
Annual net difference: ${currency.format(netDelta)}
Net difference per pay period: ${currency.format(comparison.netPerPayPeriod - result.netPerPayPeriod)}
Share of gross difference retained: ${salaryDelta === 0 ? 'not applicable' : percent.format(netDelta / salaryDelta)}` : 'No alternative salary is available.'}
${reference ? `Previous conversation scenario: ${currency.format(reference.grossAnnualSalary)} in ${reference.municipalityName}, ${reference.payPeriods} pay periods, ${currency.format(reference.annualNet)} annual net.
Annual net change from previous scenario: ${currency.format(result.annualNet - reference.annualNet)}.` : 'No previous conversation scenario.'}
Municipality comparison, same salary and pay periods:
${cityLines}
Employer profile: ${employerCost.sector}, ${employerCost.size}
Total employer cost: ${currency.format(employerCost.totalCost)}
Employer INPS contributions: ${currency.format(employerCost.inpsTotal)}
INAIL: ${currency.format(employerCost.insuranceItem.amount)}
Accrued severance pay: ${currency.format(employerCost.severanceItem.amount)}
Contractual costs: ${currency.format(employerCost.contractualTotal)}
Employer cost multiplier: ${employerCost.costMultiplier.toFixed(2)}x`
}

export function answerGuidedQuestion(question: GuidedQuestion, snapshot: AssistantSnapshot) {
  const { result, comparison, cityComparisons, employerCost, language } = snapshot
  const { currency, percent } = formatters(language)
  const isItalian = language === 'it'

  if (question === 'takeHome') {
    return isItalian
      ? `Su ${currency.format(result.grossAnnualSalary)} di RAL restano ${currency.format(result.annualNet)} netti all’anno, cioè circa ${currency.format(result.netPerPayPeriod)} per ciascuna delle ${result.payPeriods} mensilità. Imposte e contributi valgono ${currency.format(result.totalDeductions)}.`
      : `From a ${currency.format(result.grossAnnualSalary)} gross salary, ${currency.format(result.annualNet)} remains net each year: about ${currency.format(result.netPerPayPeriod)} across ${result.payPeriods} pay periods. Taxes and contributions total ${currency.format(result.totalDeductions)}.`
  }

  if (question === 'salaryChange') {
    if (!comparison) {
      return isItalian ? 'Imposta una seconda RAL per vedere il confronto.' : 'Set a second salary to see the comparison.'
    }
    const grossDelta = comparison.grossAnnualSalary - result.grossAnnualSalary
    const netDelta = comparison.annualNet - result.annualNet
    const retained = grossDelta === 0 ? null : netDelta / grossDelta
    return isItalian
      ? `Passando da ${currency.format(result.grossAnnualSalary)} a ${currency.format(comparison.grossAnnualSalary)}, il netto cambia di ${currency.format(netDelta)} all’anno e ${currency.format(comparison.netPerPayPeriod - result.netPerPayPeriod)} per mensilità${retained === null ? '.' : `. Rimane netto il ${percent.format(retained)} della differenza lorda.`}`
      : `Moving from ${currency.format(result.grossAnnualSalary)} to ${currency.format(comparison.grossAnnualSalary)}, net pay changes by ${currency.format(netDelta)} per year and ${currency.format(comparison.netPerPayPeriod - result.netPerPayPeriod)} per pay period${retained === null ? '.' : `. ${percent.format(retained)} of the gross difference remains net.`}`
  }

  if (question === 'municipalities') {
    const sorted = [...cityComparisons].sort((a, b) => b.annualNet - a.annualNet)
    const best = sorted[0]
    const worst = sorted.at(-1)
    if (!best || !worst) {
      return isItalian ? 'Il confronto tra Comuni non è disponibile.' : 'The municipality comparison is unavailable.'
    }
    return isItalian
      ? `A parità di RAL, tra i Comuni confrontati il netto più alto è a ${best.municipalityName}: ${currency.format(best.annualNet)}. Il più basso è a ${worst.municipalityName}: ${currency.format(worst.annualNet)}. La differenza è ${currency.format(best.annualNet - worst.annualNet)} all’anno.`
      : `For the same salary, ${best.municipalityName} has the highest net among the compared municipalities at ${currency.format(best.annualNet)}. ${worst.municipalityName} is lowest at ${currency.format(worst.annualNet)}, a yearly difference of ${currency.format(best.annualNet - worst.annualNet)}.`
  }

  const netShare = result.annualNet / employerCost.totalCost
  return isItalian
    ? `Per questa RAL il costo aziendale stimato è ${currency.format(employerCost.totalCost)}, pari a ${employerCost.costMultiplier.toFixed(2).replace('.', ',')} volte la RAL. Al dipendente arriva netto il ${percent.format(netShare)} del costo totale.`
    : `For this salary, estimated employer cost is ${currency.format(employerCost.totalCost)}, or ${employerCost.costMultiplier.toFixed(2)} times gross salary. The employee receives ${percent.format(netShare)} of the total cost as net pay.`
}

export function answerScenarioChange(previous: AssistantSnapshot, next: AssistantSnapshot) {
  const { currency } = formatters(next.language)
  const scenarioChanged =
    previous.result.grossAnnualSalary !== next.result.grossAnnualSalary ||
    previous.result.municipalityCode !== next.result.municipalityCode ||
    previous.result.payPeriods !== next.result.payPeriods
  const employerChanged =
    previous.employerCost.sector !== next.employerCost.sector ||
    previous.employerCost.size !== next.employerCost.size

  if (!scenarioChanged && !employerChanged) return undefined

  const netDelta = next.result.annualNet - previous.result.annualNet
  if (next.language === 'it') {
    const scenario = `RAL ${currency.format(next.result.grossAnnualSalary)}, ${next.result.municipalityName}, ${next.result.payPeriods} mensilità: ${currency.format(next.result.annualNet)} netti all’anno, circa ${currency.format(next.result.netPerPayPeriod)} per mensilità.`
    const difference = scenarioChanged
      ? ` Rispetto allo scenario precedente il netto cambia di ${currency.format(netDelta)} all’anno.`
      : ''
    const employer = employerChanged
      ? ` Con il profilo aziendale indicato, il costo stimato è ${currency.format(next.employerCost.totalCost)}.`
      : ''
    return scenario + difference + employer
  }

  const scenario = `${currency.format(next.result.grossAnnualSalary)} gross in ${next.result.municipalityName}, over ${next.result.payPeriods} pay periods: ${currency.format(next.result.annualNet)} yearly net, about ${currency.format(next.result.netPerPayPeriod)} per pay period.`
  const difference = scenarioChanged
    ? ` Compared with the previous scenario, yearly net changes by ${currency.format(netDelta)}.`
    : ''
  const employer = employerChanged
    ? ` With that employer profile, estimated total cost is ${currency.format(next.employerCost.totalCost)}.`
    : ''
  return scenario + difference + employer
}

export function getAssistantSystemPrompt(language: AssistantLanguage, context: string) {
  return `You are "netto.", a concise assistant for verified Italian salary calculations.
Reply in ${language === 'it' ? 'Italian' : 'English'} using at most 90 words.
Use only the authoritative calculation below for every number. Never calculate figures yourself, invent tax rules, or alter a number.
You may explain general payroll concepts, but clearly separate them from this estimate.
If the question asks for a different personal situation, legal advice, or data not present, clearly say it is outside this estimate.
Distinguish exact inputs from estimates. Employer costs are indicative.

${context}`
}

/** Rileva l’inglese esplicito; nei casi brevi o ambigui usa l’italiano come default. */
export function detectAssistantLanguage(question: string): AssistantLanguage {
  const words = question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .match(/[a-z]+/g) ?? []
  const italian = new Set([
    'quanto', 'cosa', 'come', 'perche', 'netto', 'ral', 'stipendio', 'mensilita',
    'comune', 'azienda', 'dipendente', 'tasse', 'contributi', 'prenderei', 'invece',
    'con', 'senza', 'della', 'mio', 'mia', 'mi', 'se', 'una', 'un',
  ])
  const english = new Set([
    'what', 'how', 'why', 'salary', 'pay', 'gross', 'employer', 'employee', 'tax',
    'taxes', 'city', 'municipality', 'would', 'take', 'home', 'with', 'without',
    'the', 'my', 'if', 'can', 'explain', 'instead',
  ])
  const italianScore = words.filter((word) => italian.has(word)).length
  const englishScore = words.filter((word) => english.has(word)).length
  return englishScore > italianScore ? 'en' : 'it'
}

export function detectGuidedQuestion(question: string): GuidedQuestion | undefined {
  const normalized = question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')

  if (/(?:costo|costi|costare|azienda|datore|employer)/.test(normalized)) return 'employerCost'
  if (/(?:comun[ei]|citta|municipalit|city|cities|dove conviene)/.test(normalized)) return 'municipalities'
  if (/(?:altra ral|aumento|differenza|cosa cambia|what changes|increase|compare)/.test(normalized)) {
    return 'salaryChange'
  }
  if (/(?:netto|prendo|resta|busta|stipendio|ral|take.home|salary|pay)/.test(normalized)) {
    return 'takeHome'
  }
  return undefined
}

/** Blocca gli errori degenerativi più comuni dei modelli molto piccoli. */
export function isPlausibleAssistantReply(reply: string) {
  const text = reply.trim()
  if (text.length < 20 || text.length > 1_200) return false
  if (/undefined|nan|nessuno nuovo|total conto|\b0{2}[.,]0{3}\b/i.test(text)) return false

  const lines = text
    .split('\n')
    .map((line) => line.replace(/\W+/g, ' ').trim().toLocaleLowerCase('it-IT'))
    .filter((line) => line.length > 8)
  return new Set(lines).size === lines.length
}

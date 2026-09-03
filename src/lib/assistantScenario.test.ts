import { describe, expect, it } from 'vitest'
import { calculateEmployerCost } from './employerCost'
import { getMunicipality } from './localTaxes'
import { resolveAssistantScenario } from './assistantScenario'
import { calculateSalaryProjection } from './tax'
import type { AssistantSnapshot } from './assistantContext'

const milan = getMunicipality('F205')
const base: AssistantSnapshot = {
  result: calculateSalaryProjection(35_000, 13, milan),
  comparison: calculateSalaryProjection(40_000, 13, milan),
  cityComparisons: [
    calculateSalaryProjection(35_000, 13, milan),
    calculateSalaryProjection(35_000, 13, getMunicipality('H501')),
    calculateSalaryProjection(35_000, 13, getMunicipality('F839')),
  ],
  employerCost: calculateEmployerCost(35_000),
  language: 'it',
}

describe('assistant dynamic scenarios', () => {
  it('extracts salary, municipality and pay periods from a free-form question', () => {
    const scenario = resolveAssistantScenario('Quanto prendo con 45k a Roma su 14 mensilità?', base)

    expect(scenario.result.grossAnnualSalary).toBe(45_000)
    expect(scenario.result.municipalityName).toBe('Roma')
    expect(scenario.result.payPeriods).toBe(14)
    expect(scenario.reference).toBe(base.result)
    expect(scenario.employerCost.grossAnnualSalary).toBe(45_000)
    expect(scenario.cityComparisons.every((item) => item.grossAnnualSalary === 45_000)).toBe(true)
  })

  it('keeps prior inputs in a municipality-only follow-up', () => {
    const rome = resolveAssistantScenario('45 mila a Roma con 14 mensilità', base)
    const naples = resolveAssistantScenario('E invece a Napoli?', rome)

    expect(naples.result.grossAnnualSalary).toBe(45_000)
    expect(naples.result.payPeriods).toBe(14)
    expect(naples.result.municipalityName).toBe('Napoli')
    expect(naples.reference).toBe(rome.result)
  })

  it('updates the employer profile without altering the salary scenario', () => {
    const scenario = resolveAssistantScenario(
      'Quanto costo in una azienda industriale con oltre 15 dipendenti?',
      base,
    )

    expect(scenario.result.grossAnnualSalary).toBe(35_000)
    expect(scenario.employerCost.sector).toBe('industry')
    expect(scenario.employerCost.size).toBe('over15')
  })

  it('recognises common English city names', () => {
    const scenario = resolveAssistantScenario('What about €50k in Florence?', base)

    expect(scenario.result.grossAnnualSalary).toBe(50_000)
    expect(scenario.result.municipalityName).toBe('Firenze')
  })
})

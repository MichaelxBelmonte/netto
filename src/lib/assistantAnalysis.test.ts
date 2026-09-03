import { describe, expect, it } from 'vitest'
import {
  buildAssistantAnalysis,
  buildDeterministicAssistantPlan,
  parseAssistantPlan,
  isUsefulAssistantInterpretation,
} from './assistantAnalysis'
import type { AssistantSnapshot } from './assistantContext'
import { calculateEmployerCost } from './employerCost'
import { getMunicipality } from './localTaxes'
import { calculateSalaryProjection } from './tax'

const milan = getMunicipality('F205')
const snapshot: AssistantSnapshot = {
  result: calculateSalaryProjection(35_000, 13, milan),
  comparison: calculateSalaryProjection(40_000, 13, milan),
  cityComparisons: ['F205', 'H501', 'F839'].map((code) =>
    calculateSalaryProjection(35_000, 13, getMunicipality(code)),
  ),
  employerCost: calculateEmployerCost(35_000),
  language: 'it',
}

describe('assistant multi-scenario analysis', () => {
  it('crosses two salaries with the requested municipality and employer cost', () => {
    const analysis = buildAssistantAnalysis(
      'Confronta 35k e 50k a Milano includendo il costo azienda',
      snapshot,
    )
    expect(analysis.scenarioCount).toBe(2)
    expect(analysis.context).toContain('RAL=35.000')
    expect(analysis.context).toContain('RAL=50.000')
    expect(analysis.context).toContain('Costo azienda=')
    expect(analysis.fallback).toContain('costo aziendale')
  })

  it('crosses salaries and municipalities into all requested engine scenarios', () => {
    const analysis = buildAssistantAnalysis(
      'Confronta 35k e 50k tra Milano e Roma',
      snapshot,
    )
    expect(analysis.scenarioCount).toBe(4)
    expect(analysis.context).toContain('Comune=Milano')
    expect(analysis.context).toContain('Comune=Roma')
    expect(analysis.context.match(/^SCENARIO \d+/gm)).toHaveLength(4)
  })

  it('uses existing comparison cities when the question asks generically about municipalities', () => {
    const analysis = buildAssistantAnalysis('Quale Comune conviene con 45k?', snapshot)
    expect(analysis.scenarioCount).toBe(3)
    expect(analysis.fallback).toContain('netto più alto')
  })

  it('accepts a valid AI plan but falls back when the JSON is malformed', () => {
    const fallback = buildDeterministicAssistantPlan(
      'Confronta 35k e 50k tra Milano e Roma con costo azienda',
      snapshot,
    )
    expect(parseAssistantPlan(
      '{"salaries":[35000,50000],"municipalities":["Milano","Roma"],"payPeriods":13,"includeEmployerCost":true}',
      fallback,
    )).toEqual(fallback)
    expect(parseAssistantPlan('non-json', fallback)).toEqual(fallback)
  })

  it('rejects an AI plan that drops an explicit salary from the request', () => {
    const fallback = buildDeterministicAssistantPlan(
      'Confronta 35k e 50k tra Milano e Roma',
      snapshot,
    )
    const plan = parseAssistantPlan(
      '{"salaries":[35000],"municipalities":["Milano","Roma"],"payPeriods":13,"includeEmployerCost":false}',
      fallback,
    )
    expect(plan.salaries).toEqual([35_000, 50_000])
  })

  it('rejects an irrelevant interpretation from a small local model', () => {
    const plan = buildDeterministicAssistantPlan(
      'Confronta 35k e 50k tra Milano e Roma con costo azienda',
      snapshot,
    )
    expect(isUsefulAssistantInterpretation(
      'Riallineamento può aumentare la propensione al profitto.',
      plan,
    )).toBe(false)
    expect(isUsefulAssistantInterpretation(
      'Con una RAL più alta cresce il netto, ma aumenta anche il costo azienda; Milano e Roma differiscono per le addizionali locali.',
      plan,
    )).toBe(true)
  })
})

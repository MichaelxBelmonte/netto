import { describe, expect, it } from 'vitest'
import { calculateEmployerCost } from './employerCost'
import {
  answerGuidedQuestion,
  answerScenarioChange,
  buildAssistantContext,
  detectAssistantLanguage,
  detectGuidedQuestion,
  isPlausibleAssistantReply,
  type AssistantSnapshot,
} from './assistantContext'
import { getMunicipality } from './localTaxes'
import { calculateSalaryProjection } from './tax'

const milan = getMunicipality('F205')
const snapshot: AssistantSnapshot = {
  result: calculateSalaryProjection(35_000, 13, milan),
  comparison: calculateSalaryProjection(40_000, 13, milan),
  cityComparisons: [
    calculateSalaryProjection(35_000, 13, milan),
    calculateSalaryProjection(35_000, 13, getMunicipality('H501')),
  ],
  employerCost: calculateEmployerCost(35_000),
  language: 'it',
}

describe('assistant context', () => {
  it('serialises only authoritative computed values', () => {
    const context = buildAssistantContext(snapshot)
    expect(context).toContain('Gross annual salary: 35.000 €')
    expect(context).toContain('Alternative salary: 40.000 €')
    expect(context).toContain('Milano (MI)')
    expect(context).toContain('Total employer cost:')
  })

  it.each(['takeHome', 'salaryChange', 'municipalities', 'employerCost'] as const)(
    'answers the %s shortcut from the calculation',
    (question) => {
      const answer = answerGuidedQuestion(question, snapshot)
      expect(answer.length).toBeGreaterThan(40)
      expect(answer).not.toMatch(/undefined|NaN/)
    },
  )

  it('answers in Italian by default, including ambiguous numeric prompts', () => {
    expect(detectAssistantLanguage('Quanto prenderei netto?')).toBe('it')
    expect(detectAssistantLanguage('45000?')).toBe('it')
  })

  it('detects an explicitly English question', () => {
    expect(detectAssistantLanguage('What would my take-home pay be?')).toBe('en')
  })

  it('answers a changed scenario only with computed figures', () => {
    const changed: AssistantSnapshot = {
      ...snapshot,
      result: calculateSalaryProjection(50_000, 14, getMunicipality('H501')),
      employerCost: calculateEmployerCost(50_000),
    }
    const answer = answerScenarioChange(snapshot, changed)

    expect(answer).toContain('RAL 50.000')
    expect(answer).toContain('Roma')
    expect(answer).toContain('14 mensilità')
    expect(answer).toContain(
      new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
        .format(changed.result.annualNet),
    )
  })

  it('rejects degraded output from a very small language model', () => {
    expect(isPlausibleAssistantReply('Ecco i cambiamenti: Nessuno nuovo: 00.000 - 00.000')).toBe(false)
    expect(isPlausibleAssistantReply('Il netto annuo stimato è quello indicato dal calcolo verificato.')).toBe(true)
  })

  it.each([
    ['quanto prendo con questa RAL?', 'takeHome'],
    ['quanto costo alla mia azienda?', 'employerCost'],
    ['quale Comune conviene?', 'municipalities'],
    ['cosa cambia con un aumento?', 'salaryChange'],
  ] as const)('routes “%s” to verified %s data', (question, expected) => {
    expect(detectGuidedQuestion(question)).toBe(expected)
  })
})

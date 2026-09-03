import { describe, expect, it } from 'vitest'
import {
  CONTRIBUTION_CEILING,
  TFR_EMPLOYER_RATE,
  calculateEmployerCost,
  summariseEmploymentCost,
} from './employerCost'
import { calculateSalaryProjection } from './tax'
import { getMunicipality } from './localTaxes'

/**
 * Golden case ricostruiti voce per voce dalle aliquote dichiarate nel modulo.
 * Verificano ogni riga e non solo il totale: se una tabella cambia, il test dice quale voce.
 */
describe('employer cost, 35.000 € gross', () => {
  it('breaks down an office employee in a retail company with 6 to 15 people', () => {
    const cost = calculateEmployerCost(35_000, { sector: 'commerce', size: 'from6to15' })
    const amounts = Object.fromEntries(cost.inpsItems.map((entry) => [entry.key, entry.amount]))

    expect(amounts).toEqual({
      ivs: 8_333.5,
      naspi: 458.5,
      training: 105,
      tfrGuarantee: 70,
      cuaf: 238,
      sickness: 854,
      maternity: 84,
      fis: 186.67,
    })
    expect(cost.inpsTotal).toBe(10_329.67)
    expect(cost.inpsRate).toBe(0.2951)
    expect(cost.insuranceItem.amount).toBe(140)
    expect(cost.severanceItem.amount).toBe(2_417.59)
    expect(cost.contractualTotal).toBe(191)
    expect(cost.totalCost).toBe(48_078.26)
    expect(cost.costMultiplier).toBe(1.3737)
  })

  it('drops the sickness contribution and adds the CIGO for an industrial employee', () => {
    const cost = calculateEmployerCost(35_000, { sector: 'industry', size: 'over15' })
    const keys = cost.inpsItems.map((entry) => entry.key)

    expect(keys).not.toContain('sickness')
    expect(keys).not.toContain('fis')
    expect(keys).toContain('cigo')
    expect(keys).toContain('cigs')
    expect(cost.inpsTotal).toBe(10_171)
    expect(cost.insuranceItem.amount).toBe(175)
    expect(cost.totalCost).toBe(47_919.59)
  })

  it('adds the CIGS only above fifteen employees', () => {
    const small = calculateEmployerCost(35_000, { sector: 'commerce', size: 'from6to15' })
    const large = calculateEmployerCost(35_000, { sector: 'commerce', size: 'over15' })

    expect(large.totalCost - small.totalCost).toBeCloseTo(210, 2)
  })
})

describe('employer cost invariants', () => {
  it('always adds up: the listed items are the total', () => {
    for (const gross of [15_000, 27_500, 35_000, 60_000, 120_000]) {
      for (const sector of ['commerce', 'industry'] as const) {
        for (const size of ['upTo5', 'from6to15', 'over15'] as const) {
          const cost = calculateEmployerCost(gross, { sector, size })
          const listed =
            cost.inpsItems.reduce((total, entry) => total + entry.amount, 0) +
            cost.insuranceItem.amount +
            cost.severanceItem.amount +
            cost.contractualItems.reduce((total, entry) => total + entry.amount, 0)

          expect(cost.totalCost).toBeCloseTo(gross + listed, 2)
          expect(cost.costMultiplier).toBeGreaterThan(1.3)
          expect(cost.costMultiplier).toBeLessThan(1.45)
          for (const entry of [...cost.inpsItems, cost.insuranceItem, cost.severanceItem]) {
            expect(entry.amount).toBeGreaterThan(0)
            expect(entry.source.length).toBeGreaterThan(10)
          }
        }
      }
    }
  })

  it('does not count the 0,50% twice: the TFR rate is net of what is already in the IVS', () => {
    // 1/13,5 = 7,4074%: usare quello insieme all'aliquota INPS piena conterebbe due volte lo 0,50%.
    expect(TFR_EMPLOYER_RATE).toBeCloseTo(0.069074, 6)
    expect(TFR_EMPLOYER_RATE).toBeLessThan(1 / 13.5)
  })

  it('stops the pension contribution at the yearly ceiling', () => {
    const cost = calculateEmployerCost(CONTRIBUTION_CEILING + 20_000, { sector: 'commerce' })
    const ivs = cost.inpsItems.find((entry) => entry.key === 'ivs')

    expect(cost.ceilingApplied).toBe(true)
    expect(ivs?.amount).toBe(29_118.44)
    expect(calculateEmployerCost(120_000).ceilingApplied).toBe(false)
  })

  it('exposes the employee rate implied by each scenario, which is not always 9,19%', () => {
    expect(calculateEmployerCost(35_000, { sector: 'industry', size: 'upTo5' }).impliedEmployeeRate).toBe(
      0.0919,
    )
    expect(calculateEmployerCost(35_000, { sector: 'commerce', size: 'upTo5' }).impliedEmployeeRate).toBe(
      0.0936,
    )
    expect(
      calculateEmployerCost(35_000, { sector: 'commerce', size: 'from6to15' }).impliedEmployeeRate,
    ).toBe(0.0946)
    // 9,49% è la quota nota delle aziende in campo CIGS: 9,19 + un terzo dello 0,90.
    expect(
      calculateEmployerCost(35_000, { sector: 'industry', size: 'over15' }).impliedEmployeeRate,
    ).toBe(0.0949)
    expect(
      calculateEmployerCost(35_000, { sector: 'industry', size: 'upTo5' }).matchesEngineEmployeeRate,
    ).toBe(true)
    expect(
      calculateEmployerCost(35_000, { sector: 'commerce', size: 'upTo5' }).matchesEngineEmployeeRate,
    ).toBe(false)
  })

  it('rejects a salary that is not a positive number', () => {
    expect(() => calculateEmployerCost(0)).toThrow(RangeError)
    expect(() => calculateEmployerCost(Number.NaN)).toThrow(RangeError)
  })
})

/**
 * Il ponte tra i due motori: il moltiplicatore costo/RAL è quasi una costante, quindi
 * l'informazione utile è quanta parte del costo arriva netta al dipendente.
 */
describe('from employer cost to take-home pay', () => {
  const milan = getMunicipality('F205')

  it('shows the share falling as the salary grows, while the multiplier barely moves', () => {
    const shares = [30_000, 35_000, 60_000].map((gross) => {
      const cost = calculateEmployerCost(gross, { sector: 'commerce', size: 'from6to15' })
      const net = calculateSalaryProjection(gross, 13, milan).annualNet
      return summariseEmploymentCost(net, cost)
    })

    expect(shares.map((entry) => entry.netShareOfCost)).toEqual([0.5681, 0.5415, 0.4563])
    expect(shares[1]?.totalCost).toBe(48_078.26)
    expect(shares[1]?.costPerNetEuro).toBe(1.8469)
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index]!.netShareOfCost).toBeLessThan(shares[index - 1]!.netShareOfCost)
    }
  })
})

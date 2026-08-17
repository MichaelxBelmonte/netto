import { describe, expect, it } from 'vitest'
import {
  TAX_DATA_META,
  calculateMunicipalTax,
  calculateRegionalTax,
  getMunicipality,
  searchMunicipalities,
} from './localTaxes'
import { calculateSalaryProjection } from './tax'

describe('official local tax dataset', () => {
  it('contains the national MEF municipal register', () => {
    expect(TAX_DATA_META.municipalities).toBe(7_897)
    expect(searchMunicipalities('Milano')[0]?.c).toBe('F205')
    expect(searchMunicipalities('Roma')[0]?.c).toBe('H501')
  })

  it('keeps the source year of each municipal rule', () => {
    expect(getMunicipality('F205').y).toBe(2025)
    expect(getMunicipality('G273').y).toBe(2026)
  })

  it('applies municipal exemptions and published rates', () => {
    const milan = getMunicipality('F205')
    const palermo = getMunicipality('G273')

    expect(calculateMunicipalTax(23_000, milan).total).toBe(0)
    expect(calculateMunicipalTax(30_000, milan).total).toBe(240)
    expect(calculateMunicipalTax(30_000, palermo).total).toBe(309)
  })
})

describe('2026 regional tax rules', () => {
  it('applies Lombardy brackets progressively', () => {
    expect(calculateRegionalTax(15_000, 'lombardia').total).toBe(184.5)
    expect(calculateRegionalTax(28_000, 'lombardia').total).toBe(389.9)
  })

  it('includes the Trento deduction and Valle d’Aosta exemption', () => {
    expect(calculateRegionalTax(30_000, 'trento').total).toBe(0)
    expect(calculateRegionalTax(15_000, 'valle-aosta').total).toBe(0)
    expect(calculateRegionalTax(20_000, 'valle-aosta').total).toBe(246)
  })

  it('handles whole-income relief and regional tax credits', () => {
    expect(calculateRegionalTax(15_000, 'friuli-venezia-giulia').total).toBe(105)
    expect(calculateRegionalTax(20_000, 'friuli-venezia-giulia').total).toBe(246)
    expect(calculateRegionalTax(28_000, 'lazio').total).toBe(484.4)
    expect(calculateRegionalTax(29_000, 'lazio').total).toBe(665.7)
    expect(calculateRegionalTax(28_000, 'umbria').total).toBe(344.4)
    expect(calculateRegionalTax(30_000, 'umbria').total).toBe(564.5)
  })

  it('applies both standard Bolzano deductions in the standard case', () => {
    expect(calculateRegionalTax(60_000, 'bolzano')).toMatchObject({
      total: 307.5,
      adjustment: 480.5,
    })
  })

  it('changes the projection when residence changes', () => {
    const milan = calculateSalaryProjection(35_000, 13, getMunicipality('F205'))
    const rome = calculateSalaryProjection(35_000, 13, getMunicipality('H501'))

    expect(milan.municipalityName).toBe('Milano')
    expect(rome.municipalityName).toBe('Roma')
    expect(rome.annualNet).not.toBe(milan.annualNet)
  })
})

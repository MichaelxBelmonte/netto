import { describe, expect, it } from 'vitest'
import {
  TAX_DATA_META,
  calculateMunicipalTax,
  calculateRegionalTax,
  findMunicipality,
  getMunicipality,
  getMunicipalitySourceUrl,
  normalizeSearch,
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
    expect(getMunicipality('M439').y).toBe(0)
  })

  it('drops the previous-year rule when MEF declares that resolution inapplicable', () => {
    // Capitignano, Pisano e Varco Sabino hanno una delibera 2025 marcata "ALIQUOTE INAPPLICABILI":
    // varrebbe la regola 2024, che la pipeline non scarica, quindi il record resta senza regola.
    for (const code of ['B658', 'G703', 'L676']) {
      const municipality = getMunicipality(code)
      expect(municipality.y).toBe(0)
      expect(municipality.b).toEqual([])
    }
  })

  it('applies municipal exemptions and published rates', () => {
    const milan = getMunicipality('F205')
    const palermo = getMunicipality('G273')

    expect(calculateMunicipalTax(23_000, milan).total).toBe(0)
    expect(calculateMunicipalTax(30_000, milan).total).toBe(240)
    expect(calculateMunicipalTax(30_000, palermo).total).toBe(309)
  })

  it('applies progressive municipal brackets after the exemption threshold', () => {
    const turin = getMunicipality('L219')
    expect(calculateMunicipalTax(11_790, turin).total).toBe(0)
    expect(calculateMunicipalTax(30_000, turin).total).toBe(246)
    expect(calculateMunicipalTax(60_000, turin).total).toBe(586)
  })

  it('uses repaired standard brackets for the MEF rows with a duplicated income band', () => {
    // Airuno (A112): il registro MEF 2026 ripete la fascia 15–28k; la delibera prevede 0,5% tra 28k e 50k.
    const airuno = getMunicipality('A112')
    expect(airuno.b.map(([upper]) => upper)).toEqual([15_000, 28_000, 50_000, 0])
    expect(calculateMunicipalTax(40_000, airuno).total).toBe(155)
  })

  it('links every rule to the MEF page of the year actually used', () => {
    expect(getMunicipalitySourceUrl(getMunicipality('F205'))).toContain('cc=F205&anno=2025')
    expect(getMunicipalitySourceUrl(getMunicipality('G273'))).toContain('cc=G273&anno=2026')
    expect(getMunicipalitySourceUrl(getMunicipality('M439'))).not.toContain('anno=')
  })

  it('looks municipalities up safely by code', () => {
    expect(findMunicipality('ZZZZ')).toBeUndefined()
    expect(findMunicipality('')).toBeUndefined()
    expect(findMunicipality(' f205 ')?.n).toBe('Milano')
    expect(getMunicipality('ZZZZ').c).toBe('F205')
  })
})

describe('municipality search', () => {
  it('normalizes accents, apostrophes and spaces', () => {
    expect(normalizeSearch('Sant’Angelo')).toBe('santangelo')
    expect(normalizeSearch("Sant'Angelo")).toBe('santangelo')
    expect(normalizeSearch('Sant Angelo')).toBe('santangelo')
    expect(normalizeSearch('Forlì')).toBe('forli')
  })

  it('finds municipalities typed with a typographic apostrophe or without it', () => {
    expect(searchMunicipalities('Sant’Angelo').length).toBeGreaterThan(0)
    expect(searchMunicipalities('Sant Angelo').length).toBeGreaterThan(0)
    expect(searchMunicipalities('Forlì')[0]?.c).toBe('D704')
    expect(searchMunicipalities('Cantù')[0]?.c).toBe('B639')
  })

  it('finds municipalities by their everyday name and by the local-language one', () => {
    // Le denominazioni ufficiali ISTAT sono "Reggio nell'Emilia" e "Reggio di Calabria":
    // il nome con cui l'utente le cerca vive negli alias del dataset.
    expect(searchMunicipalities('Reggio Emilia')[0]?.c).toBe('H223')
    expect(searchMunicipalities('Reggio Calabria')[0]?.c).toBe('H224')
    expect(searchMunicipalities('Bozen')[0]?.c).toBe('A952')
    expect(searchMunicipalities('Cassano allo Ionio').length).toBeGreaterThan(0)
  })

  it('ranks major cities before province matches, and short names before longer ones', () => {
    expect(searchMunicipalities('Mi')[0]?.c).toBe('F205')
    expect(searchMunicipalities('Ro')[0]?.c).toBe('H501')
    expect(searchMunicipalities('Na')[0]?.c).toBe('F839')
    expect(searchMunicipalities('Mi', 40).some((municipality) => municipality.p === 'MI')).toBe(true)
    expect(searchMunicipalities('Bari')[0]?.c).toBe('A662')
    expect(searchMunicipalities('Como')[0]?.c).toBe('C933')
    expect(searchMunicipalities('Lecce')[0]?.c).toBe('E506')
  })

  it('returns homonyms as distinct records with different provinces', () => {
    const castro = searchMunicipalities('Castro').slice(0, 2)
    expect(castro.map((municipality) => municipality.n)).toEqual(['Castro', 'Castro'])
    expect(new Set(castro.map((municipality) => municipality.p)).size).toBe(2)
    expect(new Set(castro.map((municipality) => municipality.c)).size).toBe(2)
  })
})

describe('2026 regional tax rules', () => {
  it('applies Lombardy brackets progressively', () => {
    expect(calculateRegionalTax(15_000, 'lombardia').total).toBe(184.5)
    expect(calculateRegionalTax(28_000, 'lombardia').total).toBe(389.9)
  })

  it('includes the Trento deduction and Valle d’Aosta exemption', () => {
    expect(calculateRegionalTax(30_000, 'trento').total).toBe(0)
    expect(calculateRegionalTax(30_000.01, 'trento').total).toBe(369)
    expect(calculateRegionalTax(15_000, 'valle-aosta').total).toBe(0)
    expect(calculateRegionalTax(20_000, 'valle-aosta').total).toBe(246)
  })

  it('handles whole-income relief and regional tax credits', () => {
    expect(calculateRegionalTax(15_000, 'friuli-venezia-giulia').total).toBe(105)
    expect(calculateRegionalTax(20_000, 'friuli-venezia-giulia').total).toBe(246)
    expect(calculateRegionalTax(28_000, 'lazio').total).toBe(484.4)
    expect(calculateRegionalTax(28_000.01, 'lazio').total).toBe(632.4)
    expect(calculateRegionalTax(29_000, 'lazio').total).toBe(665.7)
    expect(calculateRegionalTax(28_000, 'umbria').total).toBe(344.4)
    expect(calculateRegionalTax(30_000, 'umbria').total).toBe(564.5)
    expect(calculateRegionalTax(50_000, 'umbria').total).toBe(1_188.5)
    expect(calculateRegionalTax(50_000.01, 'umbria').total).toBe(1_338.5)
  })

  it('applies ordinary regional brackets published by MEF for 2026', () => {
    // 15.000 × 1,62% + 13.000 × 2,68% + 7.000 × 3,31%
    expect(calculateRegionalTax(35_000, 'piemonte').total).toBe(823.1)
    expect(calculateRegionalTax(35_000, 'campania').total).toBe(868.3)
    expect(calculateRegionalTax(35_000, 'veneto').total).toBe(430.5)
    expect(calculateRegionalTax(35_000, 'abruzzo').total).toBe(668.5)
  })

  it('applies both standard Bolzano deductions in the standard case', () => {
    expect(calculateRegionalTax(60_000, 'bolzano')).toMatchObject({
      total: 307.5,
      adjustment: 480.5,
    })
    expect(calculateRegionalTax(90_000.01, 'bolzano').adjustment).toBe(125)
  })

  it('changes the projection when residence changes', () => {
    const milan = calculateSalaryProjection(35_000, 13, getMunicipality('F205'))
    const rome = calculateSalaryProjection(35_000, 13, getMunicipality('H501'))

    expect(milan.municipalityName).toBe('Milano')
    expect(rome.municipalityName).toBe('Roma')
    expect(rome.annualNet).not.toBe(milan.annualNet)
  })
})

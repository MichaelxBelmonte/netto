import { describe, expect, it } from 'vitest'
import { MUNICIPALITIES, TAX_DATA_META, searchMunicipalities } from './localTaxes'

/**
 * Comuni che per norma possono superare il tetto ordinario dello 0,8%: Roma Capitale
 * (D.L. 78/2010 art. 14 c. 14) e i capoluoghi con accordo di risanamento con lo Stato
 * (L. 234/2021 art. 1 c. 572; D.L. 50/2022 art. 43), che arrivano a 1,2%.
 */
const ALLOWED_ABOVE_ORDINARY_CAP = new Set([
  'H501',
  'F839',
  'L219',
  'G273',
  'H224',
  'D969',
  'A182',
  'B180',
  'F537',
  'H703',
  'G942',
  'A509',
  'E506',
])

/**
 * Proprietà che ogni record del registro comunale deve rispettare.
 * Il motore assume scaglioni crescenti con l'ultimo aperto: se il parser produce altro,
 * il calcolo sarebbe plausibile ma sbagliato, quindi il dato viene bloccato qui.
 */
describe('municipal dataset invariants', () => {
  it('has unique cadastral codes and consistent metadata', () => {
    expect(MUNICIPALITIES).toHaveLength(TAX_DATA_META.municipalities)
    expect(new Set(MUNICIPALITIES.map((municipality) => municipality.c)).size).toBe(
      MUNICIPALITIES.length,
    )
    expect(MUNICIPALITIES.filter((municipality) => municipality.y === 2026)).toHaveLength(
      TAX_DATA_META.currentYearRules,
    )
    expect(MUNICIPALITIES.filter((municipality) => municipality.y === 2025)).toHaveLength(
      TAX_DATA_META.fallbackRules,
    )
    expect(MUNICIPALITIES.filter((municipality) => municipality.y === 0)).toHaveLength(
      TAX_DATA_META.unresolved,
    )
    expect(
      TAX_DATA_META.currentYearRules + TAX_DATA_META.fallbackRules + TAX_DATA_META.unresolved,
    ).toBe(TAX_DATA_META.municipalities)
    expect(MUNICIPALITIES.filter((municipality) => municipality.b.length === 0)).toHaveLength(
      TAX_DATA_META.noSurcharge,
    )
    expect(MUNICIPALITIES.filter((municipality) => municipality.s === 1)).toHaveLength(
      TAX_DATA_META.specialCases,
    )
  })

  it('keeps every rule within the legal shape: increasing brackets, open last bracket, ordinary 0.8% ceiling', () => {
    for (const municipality of MUNICIPALITIES) {
      expect([2026, 2025, 0]).toContain(municipality.y)
      expect(municipality.e).toBeGreaterThanOrEqual(0)
      expect([0, 1]).toContain(municipality.s)

      const uppers = municipality.b.map(([upper]) => upper)
      const rates = municipality.b.map(([, rate]) => rate)
      const cap = ALLOWED_ABOVE_ORDINARY_CAP.has(municipality.c) ? 0.012 : 0.008

      for (const rate of rates) {
        expect(rate).toBeGreaterThan(0)
        // Sopra lo 0,8% solo i Comuni con una deroga di legge riconosciuta.
        expect(rate).toBeLessThanOrEqual(cap)
      }

      if (uppers.length > 0) {
        expect(uppers.at(-1)).toBe(0)
        for (let index = 0; index < uppers.length - 1; index += 1) {
          expect(uppers[index]).toBeGreaterThan(0)
          if (index > 0) expect(uppers[index]).toBeGreaterThan(uppers[index - 1] ?? 0)
        }
      }
    }
  })

  it('leaves records without a usable rule empty, so no surtax is invented', () => {
    for (const municipality of MUNICIPALITIES.filter((item) => item.y === 0)) {
      expect(municipality.b).toEqual([])
      expect(municipality.e).toBe(0)
      expect(municipality.s).toBe(1)
    }
  })

  it('is sorted by name, which is what the result list relies on', () => {
    const collator = new Intl.Collator('it-IT')
    for (let index = 1; index < MUNICIPALITIES.length; index += 1) {
      const previous = MUNICIPALITIES[index - 1]!
      const current = MUNICIPALITIES[index]!
      expect(collator.compare(previous.n, current.n)).toBeLessThanOrEqual(0)
    }
  })

  it('uses the official Italian ISTAT name and keeps the everyday one as a search alias', () => {
    expect(TAX_DATA_META.namesFromIstat).toBeGreaterThan(7_000)
    // L'unico nome che termina davvero con un apostrofo è Vo' (Padova); "Forli'" e simili sono accenti MEF.
    expect(
      MUNICIPALITIES.filter((municipality) => municipality.n.endsWith("'")).map((m) => m.n),
    ).toEqual(["Vo'"])
    expect(MUNICIPALITIES.find((municipality) => municipality.c === 'D704')?.n).toBe('Forlì')
    expect(MUNICIPALITIES.find((municipality) => municipality.c === 'D317')?.n).toBe('Dolcè')
    // Con la colonna bilingue il nome sarebbe "Bolzano/Bozen": questa assertion fissa la scelta.
    expect(MUNICIPALITIES.find((municipality) => municipality.c === 'A952')?.n).toBe('Bolzano')
    expect(MUNICIPALITIES.find((municipality) => municipality.c === 'A952')?.a).toContain('Bozen')
    expect(MUNICIPALITIES.filter((municipality) => municipality.a).length).toBe(
      TAX_DATA_META.searchAliases,
    )
  })

  it('keeps every municipality reachable by the name people actually type', () => {
    const queries = [
      ['Reggio Emilia', 'H223'],
      ['Reggio Calabria', 'H224'],
      ['Bozen', 'A952'],
      ['Milano', 'F205'],
      ['Roma', 'H501'],
      ['Forlì', 'D704'],
    ] as const

    for (const [query, code] of queries) {
      expect(searchMunicipalities(query)[0]?.c, query).toBe(code)
    }
  })
})

import municipalData from '../data/municipal-tax-2026.json'
import taxDataMeta from '../data/tax-data-meta.json'

export type RegionKey =
  | 'abruzzo'
  | 'basilicata'
  | 'bolzano'
  | 'calabria'
  | 'campania'
  | 'emilia-romagna'
  | 'friuli-venezia-giulia'
  | 'lazio'
  | 'liguria'
  | 'lombardia'
  | 'marche'
  | 'molise'
  | 'piemonte'
  | 'puglia'
  | 'sardegna'
  | 'sicilia'
  | 'toscana'
  | 'trento'
  | 'umbria'
  | 'valle-aosta'
  | 'veneto'

export type LocalTaxBracket = [upperBound: number, rate: number]

export type Municipality = {
  c: string
  n: string
  p: string
  g: RegionKey
  y: number
  e: number
  b: LocalTaxBracket[]
  s: 0 | 1
}

export type LocalTaxSegment = {
  from: number
  to: number
  rate: number
  taxableAmount: number
  tax: number
}

export type LocalTaxResult = {
  total: number
  segments: LocalTaxSegment[]
  adjustment: number
}

type RegionRule = {
  nameIt: string
  nameEn: string
  brackets: LocalTaxBracket[]
}

export const MUNICIPALITIES = municipalData as Municipality[]
export const TAX_DATA_META = taxDataMeta

const MUNICIPALITY_BY_CODE = new Map(
  MUNICIPALITIES.map((municipality) => [municipality.c, municipality]),
)

const REGION_RULES: Record<RegionKey, RegionRule> = {
  abruzzo: {
    nameIt: 'Abruzzo',
    nameEn: 'Abruzzo',
    brackets: [
      [28_000, 0.0167],
      [50_000, 0.0287],
      [0, 0.0333],
    ],
  },
  basilicata: {
    nameIt: 'Basilicata',
    nameEn: 'Basilicata',
    brackets: [[0, 0.0123]],
  },
  bolzano: {
    nameIt: 'Provincia autonoma di Bolzano',
    nameEn: 'Autonomous Province of Bolzano',
    brackets: [
      [28_000, 0.0123],
      [50_000, 0.0123],
      [0, 0.0173],
    ],
  },
  calabria: {
    nameIt: 'Calabria',
    nameEn: 'Calabria',
    brackets: [[0, 0.0173]],
  },
  campania: {
    nameIt: 'Campania',
    nameEn: 'Campania',
    brackets: [
      [15_000, 0.0173],
      [28_000, 0.0296],
      [50_000, 0.032],
      [0, 0.0333],
    ],
  },
  'emilia-romagna': {
    nameIt: 'Emilia-Romagna',
    nameEn: 'Emilia-Romagna',
    brackets: [
      [15_000, 0.0133],
      [28_000, 0.0193],
      [50_000, 0.0278],
      [0, 0.0333],
    ],
  },
  'friuli-venezia-giulia': {
    nameIt: 'Friuli Venezia Giulia',
    nameEn: 'Friuli Venezia Giulia',
    brackets: [
      [15_000, 0.007],
      [0, 0.0123],
    ],
  },
  lazio: {
    nameIt: 'Lazio',
    nameEn: 'Lazio',
    brackets: [
      [15_000, 0.0173],
      [28_000, 0.0333],
      [50_000, 0.0333],
      [0, 0.0333],
    ],
  },
  liguria: {
    nameIt: 'Liguria',
    nameEn: 'Liguria',
    brackets: [
      [28_000, 0.0123],
      [50_000, 0.0318],
      [0, 0.0323],
    ],
  },
  lombardia: {
    nameIt: 'Lombardia',
    nameEn: 'Lombardy',
    brackets: [
      [15_000, 0.0123],
      [28_000, 0.0158],
      [50_000, 0.0172],
      [0, 0.0173],
    ],
  },
  marche: {
    nameIt: 'Marche',
    nameEn: 'Marche',
    brackets: [
      [15_000, 0.0123],
      [28_000, 0.0153],
      [50_000, 0.017],
      [0, 0.0173],
    ],
  },
  molise: {
    nameIt: 'Molise',
    nameEn: 'Molise',
    brackets: [
      [15_000, 0.0203],
      [28_000, 0.0223],
      [50_000, 0.0363],
      [0, 0.0363],
    ],
  },
  piemonte: {
    nameIt: 'Piemonte',
    nameEn: 'Piedmont',
    brackets: [
      [15_000, 0.0162],
      [28_000, 0.0268],
      [50_000, 0.0331],
      [0, 0.0333],
    ],
  },
  puglia: {
    nameIt: 'Puglia',
    nameEn: 'Apulia',
    brackets: [
      [15_000, 0.0133],
      [28_000, 0.0213],
      [50_000, 0.0323],
      [0, 0.0333],
    ],
  },
  sardegna: {
    nameIt: 'Sardegna',
    nameEn: 'Sardinia',
    brackets: [[0, 0.0123]],
  },
  sicilia: {
    nameIt: 'Sicilia',
    nameEn: 'Sicily',
    brackets: [[0, 0.0123]],
  },
  toscana: {
    nameIt: 'Toscana',
    nameEn: 'Tuscany',
    brackets: [
      [15_000, 0.0142],
      [28_000, 0.0143],
      [50_000, 0.0332],
      [0, 0.0333],
    ],
  },
  trento: {
    nameIt: 'Provincia autonoma di Trento',
    nameEn: 'Autonomous Province of Trento',
    brackets: [
      [15_000, 0.0123],
      [28_000, 0.0123],
      [50_000, 0.0123],
      [0, 0.0173],
    ],
  },
  umbria: {
    nameIt: 'Umbria',
    nameEn: 'Umbria',
    brackets: [
      [15_000, 0.0173],
      [28_000, 0.0302],
      [50_000, 0.0312],
      [0, 0.0333],
    ],
  },
  'valle-aosta': {
    nameIt: 'Valle d’Aosta',
    nameEn: 'Aosta Valley',
    brackets: [[0, 0.0123]],
  },
  veneto: {
    nameIt: 'Veneto',
    nameEn: 'Veneto',
    brackets: [[0, 0.0123]],
  },
}

const POPULAR_MUNICIPALITY_CODES = ['F205', 'H501', 'L219', 'A944', 'F839', 'D612', 'G273']

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function calculateProgressiveLocalTax(
  taxableIncome: number,
  brackets: readonly LocalTaxBracket[],
): LocalTaxResult {
  const income = Math.max(0, taxableIncome)
  let lowerBound = 0
  let total = 0
  const segments: LocalTaxSegment[] = []

  for (const [storedUpperBound, rate] of brackets) {
    const upperBound = storedUpperBound === 0 ? Number.POSITIVE_INFINITY : storedUpperBound
    const taxableAmount = Math.max(0, Math.min(income, upperBound) - lowerBound)

    if (taxableAmount > 0) {
      const tax = money(taxableAmount * rate)
      total += tax
      segments.push({
        from: lowerBound,
        to: Number.isFinite(upperBound) ? upperBound : income,
        rate,
        taxableAmount: money(taxableAmount),
        tax,
      })
    }

    if (income <= upperBound) break
    lowerBound = upperBound
  }

  return { total: money(total), segments, adjustment: 0 }
}

function calculateWholeIncomeTax(taxableIncome: number, rate: number): LocalTaxResult {
  const income = Math.max(0, taxableIncome)
  const total = money(income * rate)
  return {
    total,
    segments:
      income > 0
        ? [{ from: 0, to: income, rate, taxableAmount: money(income), tax: total }]
        : [],
    adjustment: 0,
  }
}

function applyAdjustment(result: LocalTaxResult, adjustment: number): LocalTaxResult {
  const appliedAdjustment = money(Math.min(Math.max(0, adjustment), result.total))
  return {
    ...result,
    total: money(result.total - appliedAdjustment),
    adjustment: appliedAdjustment,
  }
}

export function calculateRegionalTax(
  taxableIncome: number,
  regionKey: RegionKey,
): LocalTaxResult {
  const income = Math.max(0, taxableIncome)
  const rule = REGION_RULES[regionKey]

  if (regionKey === 'friuli-venezia-giulia') {
    return calculateWholeIncomeTax(income, income <= 15_000 ? 0.007 : 0.0123)
  }

  if (regionKey === 'valle-aosta') {
    return income <= 15_000
      ? { total: 0, segments: [], adjustment: 0 }
      : calculateWholeIncomeTax(income, 0.0123)
  }

  if (regionKey === 'trento' && income <= 30_000) {
    return { total: 0, segments: [], adjustment: 0 }
  }

  if (regionKey === 'lazio' && income <= 28_000) {
    return calculateWholeIncomeTax(income, 0.0173)
  }

  if (regionKey === 'umbria' && income <= 28_000) {
    return calculateWholeIncomeTax(income, 0.0123)
  }

  const progressive = calculateProgressiveLocalTax(income, rule.brackets)

  if (regionKey === 'lazio' && income > 28_000 && income <= 30_000) {
    return applyAdjustment(progressive, 60)
  }

  if (regionKey === 'umbria' && income > 28_000 && income <= 50_000) {
    return applyAdjustment(progressive, 150)
  }

  if (regionKey === 'bolzano') {
    const standardDeduction = income <= 90_000 ? 430.5 : 0
    const highIncomeDeduction =
      income > 50_000 ? Math.min(125, 125 * ((income - 50_000) / 25_000)) : 0
    return applyAdjustment(progressive, standardDeduction + highIncomeDeduction)
  }

  return progressive
}

export function calculateMunicipalTax(
  taxableIncome: number,
  municipality: Municipality,
): LocalTaxResult & { exemptionApplied: boolean } {
  const income = Math.max(0, taxableIncome)

  if (municipality.e > 0 && income <= municipality.e) {
    return { total: 0, segments: [], adjustment: 0, exemptionApplied: true }
  }

  const result = calculateProgressiveLocalTax(income, municipality.b)
  return { ...result, exemptionApplied: false }
}

export function getMunicipality(code: string) {
  return MUNICIPALITY_BY_CODE.get(code) ?? MUNICIPALITY_BY_CODE.get('F205')!
}

export function getRegionName(regionKey: RegionKey, language: 'it' | 'en' = 'it') {
  const rule = REGION_RULES[regionKey]
  return language === 'it' ? rule.nameIt : rule.nameEn
}

export function getRegionRateLabel(regionKey: RegionKey, locale: string) {
  const rates = [...new Set(REGION_RULES[regionKey].brackets.map(([, rate]) => rate))]
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return rates.map((rate) => formatter.format(rate)).join(' · ')
}

export function getMunicipalRateLabel(municipality: Municipality, locale: string) {
  if (municipality.b.length === 0) return '0%'

  const rates = [...new Set(municipality.b.map(([, rate]) => rate))]
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return rates.map((rate) => formatter.format(rate)).join(' · ')
}

export function getMunicipalitySourceUrl(municipality: Municipality) {
  return (
    'https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/' +
    'fiscalitalocale/nuova_addcomirpef/risultato.htm?cc=' +
    encodeURIComponent(municipality.c)
  )
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .trim()
}

export function searchMunicipalities(query: string, limit = 8) {
  const normalized = normalizeSearch(query)

  if (!normalized) {
    return POPULAR_MUNICIPALITY_CODES.map(getMunicipality).slice(0, limit)
  }

  const provinceQuery = normalized.length === 2 ? normalized.toLocaleUpperCase('it-IT') : ''
  const startsWith = []
  const contains = []

  for (const municipality of MUNICIPALITIES) {
    const name = normalizeSearch(municipality.n)
    const provinceMatches = municipality.p === provinceQuery

    if (name.startsWith(normalized) || provinceMatches) {
      startsWith.push(municipality)
    } else if (name.includes(normalized)) {
      contains.push(municipality)
    }

    if (startsWith.length >= limit && !provinceQuery) break
  }

  return [...startsWith, ...contains].slice(0, limit)
}

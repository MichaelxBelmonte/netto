import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DATA = resolve(ROOT, 'src/data/municipal-tax-2026.json')
const OUTPUT_META = resolve(ROOT, 'src/data/tax-data-meta.json')

const MUNICIPAL_2026_URL =
  'https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2026'
const MUNICIPAL_2025_URL =
  'https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2025'
const MUNICIPAL_SOURCE_PAGE =
  'https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm'
const REGIONAL_SOURCE_PAGE =
  'https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm'

const PROVINCE_TO_REGION = {
  AG: 'sicilia',
  AL: 'piemonte',
  AN: 'marche',
  AO: 'valle-aosta',
  AP: 'marche',
  AQ: 'abruzzo',
  AR: 'toscana',
  AT: 'piemonte',
  AV: 'campania',
  BA: 'puglia',
  BG: 'lombardia',
  BI: 'piemonte',
  BL: 'veneto',
  BN: 'campania',
  BO: 'emilia-romagna',
  BR: 'puglia',
  BS: 'lombardia',
  BT: 'puglia',
  BZ: 'bolzano',
  CA: 'sardegna',
  CB: 'molise',
  CE: 'campania',
  CH: 'abruzzo',
  CL: 'sicilia',
  CN: 'piemonte',
  CO: 'lombardia',
  CR: 'lombardia',
  CS: 'calabria',
  CT: 'sicilia',
  CZ: 'calabria',
  EN: 'sicilia',
  FC: 'emilia-romagna',
  FE: 'emilia-romagna',
  FG: 'puglia',
  FI: 'toscana',
  FM: 'marche',
  FR: 'lazio',
  GE: 'liguria',
  GO: 'friuli-venezia-giulia',
  GR: 'toscana',
  IM: 'liguria',
  IS: 'molise',
  KR: 'calabria',
  LC: 'lombardia',
  LE: 'puglia',
  LI: 'toscana',
  LO: 'lombardia',
  LT: 'lazio',
  LU: 'toscana',
  MB: 'lombardia',
  MC: 'marche',
  ME: 'sicilia',
  MI: 'lombardia',
  MN: 'lombardia',
  MO: 'emilia-romagna',
  MS: 'toscana',
  MT: 'basilicata',
  NA: 'campania',
  NO: 'piemonte',
  NU: 'sardegna',
  OR: 'sardegna',
  PA: 'sicilia',
  PC: 'emilia-romagna',
  PD: 'veneto',
  PE: 'abruzzo',
  PG: 'umbria',
  PI: 'toscana',
  PN: 'friuli-venezia-giulia',
  PO: 'toscana',
  PR: 'emilia-romagna',
  PT: 'toscana',
  PU: 'marche',
  PV: 'lombardia',
  PZ: 'basilicata',
  RA: 'emilia-romagna',
  RC: 'calabria',
  RE: 'emilia-romagna',
  RG: 'sicilia',
  RI: 'lazio',
  RM: 'lazio',
  RN: 'emilia-romagna',
  RO: 'veneto',
  SA: 'campania',
  SI: 'toscana',
  SO: 'lombardia',
  SP: 'liguria',
  SR: 'sicilia',
  SS: 'sardegna',
  SU: 'sardegna',
  SV: 'liguria',
  TA: 'puglia',
  TE: 'abruzzo',
  TN: 'trento',
  TO: 'piemonte',
  TP: 'sicilia',
  TR: 'umbria',
  TS: 'friuli-venezia-giulia',
  TV: 'veneto',
  UD: 'friuli-venezia-giulia',
  VA: 'lombardia',
  VB: 'piemonte',
  VC: 'piemonte',
  VE: 'veneto',
  VI: 'veneto',
  VR: 'veneto',
  VT: 'lazio',
  VV: 'calabria',
}

const SMALL_WORDS = new Set([
  'a',
  'al',
  'alla',
  'alle',
  'con',
  'da',
  'dal',
  'dalla',
  'de',
  'dei',
  'del',
  'della',
  'delle',
  'di',
  'e',
  'in',
  'nel',
  'nella',
  'sul',
  'sulla',
])

function capitalizePart(value) {
  return value ? value[0].toLocaleUpperCase('it-IT') + value.slice(1) : value
}

function titleCaseMunicipality(value) {
  return value
    .toLocaleLowerCase('it-IT')
    .split(' ')
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word
      return word
        .split('-')
        .map((part) => part.split("'").map(capitalizePart).join("'"))
        .join('-')
    })
    .join(' ')
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/)
  const headers = lines[0].split(';').map((value) => value.trim())

  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(';')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function parseNumber(value) {
  const clean = String(value ?? '').trim()
  if (!clean || clean.includes('*')) return null

  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function extractIncomeThreshold(description) {
  const normalized = description.replace(/\./g, '').replace(/,/g, '.')
  const values = (normalized.match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((value) => value >= 3_000 && value <= 250_000)

  return values.length ? Math.max(...values) : 0
}

function exemptionAppliesToStandardEmployee(description) {
  const text = description.toLocaleLowerCase('it-IT')
  if (!text.includes('esenz')) return false
  if (/(figli|familiare|handicap|disabil|isee|nucleo familiare)/.test(text)) return false
  if (text.includes('pension') && !text.includes('lavoro dipendente')) return false
  return true
}

function parseMunicipalRule(row) {
  const ratePairs = []
  const exemptionDescriptions = []

  for (let index = 1; index <= 12; index += 1) {
    const suffix = index === 1 ? '' : '_' + String(index)
    const rate = parseNumber(row['ALIQUOTA' + suffix])
    const description = String(row['FASCIA' + suffix] ?? '').trim()

    if (rate === null) continue
    if (rate === 0 && /esenz/i.test(description)) {
      exemptionDescriptions.push(description)
      continue
    }
    if (rate <= 0) continue

    const text = description.toLocaleLowerCase('it-IT')
    const isOpenEnded = text.includes('aliquota unica') || (text.includes('oltre') && !text.includes('fino'))
    ratePairs.push({
      upper: isOpenEnded ? 0 : extractIncomeThreshold(description),
      rate: Math.round((rate / 100) * 1_000_000) / 1_000_000,
    })
  }

  if (ratePairs.length === 1) {
    ratePairs[0].upper = 0
  } else if (ratePairs.length > 1 && ratePairs.at(-1).upper !== 0) {
    ratePairs.at(-1).upper = 0
  }

  const directExemption = parseNumber(row.IMPORTO_ESENTE) ?? 0
  const parsedExemptions = exemptionDescriptions
    .filter(exemptionAppliesToStandardEmployee)
    .map(extractIncomeThreshold)
    .filter(Boolean)
  const exemption = Math.max(directExemption, ...parsedExemptions, 0)
  const flag = Number(row.FLAG_NUOVA || 0)
  const hasExcludedSpecificExemption = exemptionDescriptions.some(
    (description) => !exemptionAppliesToStandardEmployee(description),
  )

  return {
    brackets: ratePairs.map(({ upper, rate }) => [upper, rate]),
    exemption,
    flag,
    special: flag === 0 || flag === 5 || flag === 6 || hasExcludedSpecificExemption,
  }
}

function hasPublishedRule(row) {
  return Boolean(String(row.NUMERO_DELIBERA ?? '').trim())
}

async function loadText(url, localPath) {
  if (localPath) return readFile(resolve(localPath), 'utf8')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Download failed: ' + response.status + ' ' + url)
  }
  return response.text()
}

async function main() {
  const local2026 = process.argv[2]
  const local2025 = process.argv[3]
  const [text2026, text2025] = await Promise.all([
    loadText(MUNICIPAL_2026_URL, local2026),
    loadText(MUNICIPAL_2025_URL, local2025),
  ])
  const currentRows = parseCsv(text2026)
  const fallbackRows = parseCsv(text2025)
  const fallbackByCode = new Map(fallbackRows.map((row) => [row.CODICE_CATASTALE, row]))

  let currentYearRules = 0
  let fallbackRules = 0
  let noSurcharge = 0
  let specialCases = 0
  let unresolved = 0

  const municipalities = currentRows.map((currentRow) => {
    const fallbackRow = fallbackByCode.get(currentRow.CODICE_CATASTALE)
    let selectedRow = currentRow
    let sourceYear = 2026

    if (!hasPublishedRule(currentRow) && fallbackRow) {
      selectedRow = fallbackRow
      sourceYear = 2025
      fallbackRules += 1
    } else if (hasPublishedRule(currentRow)) {
      currentYearRules += 1
    } else {
      sourceYear = 0
      unresolved += 1
    }

    const parsed = parseMunicipalRule(selectedRow)
    const province = String(currentRow.PR || selectedRow.PR).trim()
    const region = PROVINCE_TO_REGION[province]

    if (!region) throw new Error('Missing region mapping for province ' + province)
    if (parsed.brackets.length === 0) noSurcharge += 1
    if (parsed.special) specialCases += 1

    return {
      c: String(currentRow.CODICE_CATASTALE).trim(),
      n: titleCaseMunicipality(String(currentRow.COMUNE).trim()),
      p: province,
      g: region,
      y: sourceYear,
      e: parsed.exemption,
      b: parsed.brackets,
      s: parsed.special ? 1 : 0,
    }
  })

  municipalities.sort((first, second) => {
    const byName = first.n.localeCompare(second.n, 'it-IT')
    return byName || first.p.localeCompare(second.p, 'it-IT')
  })

  const meta = {
    taxYear: 2026,
    generatedAt: new Date().toISOString(),
    municipalities: municipalities.length,
    currentYearRules,
    fallbackRules,
    noSurcharge,
    specialCases,
    unresolved,
    municipalSourcePage: MUNICIPAL_SOURCE_PAGE,
    municipalSource2026: MUNICIPAL_2026_URL,
    municipalFallbackSource2025: MUNICIPAL_2025_URL,
    regionalSourcePage: REGIONAL_SOURCE_PAGE,
    regionalSourceUpdatedAt: '2026-06-19',
  }

  await mkdir(dirname(OUTPUT_DATA), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_DATA, JSON.stringify(municipalities)),
    writeFile(OUTPUT_META, JSON.stringify(meta, null, 2) + '\n'),
  ])

  process.stdout.write(
    'Generated ' +
      municipalities.length +
      ' municipalities (' +
      currentYearRules +
      ' from 2026, ' +
      fallbackRules +
      ' fallback from 2025).\n',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

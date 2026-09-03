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
const ISTAT_MUNICIPALITIES_URL =
  'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv'

/**
 * Comuni che per norma possono superare il tetto ordinario dello 0,8%: Roma Capitale
 * (D.L. 78/2010 art. 14 c. 14, fino a 0,9%) e i capoluoghi con accordo di risanamento con lo
 * Stato (L. 234/2021 art. 1 c. 572; D.L. 50/2022 art. 43), che arrivano a 1,2%.
 */
const MUNICIPALITIES_ABOVE_ORDINARY_CAP = new Set([
  'H501', // Roma
  'F839', // Napoli
  'L219', // Torino
  'G273', // Palermo
  'H224', // Reggio di Calabria
  'D969', // Genova
  'A182', // Alessandria
  'B180', // Brindisi
  'F537', // Vibo Valentia
  'H703', // Salerno
  'G942', // Potenza
  'A509', // Avellino
  'E506', // Lecce
])

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

/**
 * Converte un importo scritto in formato italiano ("15.000,00", "15.000"), anglosassone
 * ("15000.00"), con spazio come separatore ("15 000") o senza separatori ("15000") in numero.
 */
function parseAmountToken(token) {
  const clean = token.replace(/\s/g, '').replace(/\.$/, '')
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(?:\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ''))
  return Number(clean)
}

/**
 * Estrae la soglia di reddito da una descrizione MEF. Restituisce anche `unreadable` quando
 * la descrizione contiene cifre ma nessun importo interpretabile: un formato nuovo del MEF
 * deve emergere come avviso, non sparire dentro una soglia zero.
 */
function extractIncomeThreshold(description) {
  const tokens = description.match(/\d[\d. ]*(?:,\d+)?/g) ?? []
  const values = tokens
    .map(parseAmountToken)
    .filter((value) => Number.isFinite(value) && value >= 3_000 && value <= 250_000)

  if (values.length) return { value: Math.max(...values), unreadable: false }
  return { value: 0, unreadable: tokens.some((token) => !Number.isFinite(parseAmountToken(token))) }
}

function incomeThreshold(description) {
  return extractIncomeThreshold(description).value
}

function bracketsAreMonotonic(pairs) {
  if (pairs.length <= 1) return true
  return pairs.every((pair, index) => {
    if (index === pairs.length - 1) return pair.upper === 0
    return pair.upper > 0 && (index === 0 || pair.upper > pairs[index - 1].upper)
  })
}

/** Confini citati nella descrizione della fascia, in ordine di apparizione. */
function boundsInDescription(description) {
  return (description.match(/\d[\d. ]*(?:,\d+)?/g) ?? [])
    .map(parseAmountToken)
    .filter((value) => Number.isFinite(value) && value >= 3_000 && value <= 250_000)
}

/**
 * Valida gli scaglioni. Il registro MEF contiene casi con la fascia duplicata per errore di
 * inserimento (es. "da 15.000,01 a 28.000,00" ripetuta due volte, quando la delibera dice
 * "da 28.000,01 a 50.000,00"): il confine mancante viene ricavato dalla descrizione della
 * fascia successiva, non forzato contro una tabella di costanti. Se non è ricostruibile il
 * record va in quarantena, invece di produrre un numero plausibile ma sbagliato.
 */
function validateBrackets(pairs, descriptions) {
  if (bracketsAreMonotonic(pairs)) return { pairs, status: 'valid' }

  const repaired = pairs.map((pair) => ({ ...pair }))

  for (let index = 0; index < repaired.length - 1; index += 1) {
    const current = repaired[index]
    const previous = index > 0 ? repaired[index - 1] : null
    if (current.upper > 0 && (!previous || current.upper > previous.upper)) continue

    // Il limite superiore di questo scaglione è il limite inferiore del successivo,
    // che la descrizione della fascia seguente cita per esteso ("oltre euro 50.000,00").
    const nextBounds = boundsInDescription(descriptions[index + 1] ?? '')
    const candidate = nextBounds.length ? Math.min(...nextBounds) : 0
    const lowerBound = previous ? previous.upper : 0
    if (candidate > lowerBound) current.upper = candidate
  }

  return bracketsAreMonotonic(repaired)
    ? { pairs: repaired, status: 'repaired' }
    : { pairs: [], status: 'invalid' }
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
  const rateDescriptions = []
  const exemptionDescriptions = []
  const unreadableAmounts = []

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
    const threshold = extractIncomeThreshold(description)
    if (!isOpenEnded && threshold.unreadable) unreadableAmounts.push(description)
    ratePairs.push({
      upper: isOpenEnded ? 0 : threshold.value,
      rate: Math.round((rate / 100) * 1_000_000) / 1_000_000,
    })
    rateDescriptions.push(description)
  }

  if (ratePairs.length === 1) {
    ratePairs[0].upper = 0
  } else if (ratePairs.length > 1 && ratePairs.at(-1).upper !== 0) {
    ratePairs.at(-1).upper = 0
  }

  const validated = validateBrackets(ratePairs, rateDescriptions)
  const directExemption = parseNumber(row.IMPORTO_ESENTE) ?? 0
  const parsedExemptions = exemptionDescriptions
    .filter(exemptionAppliesToStandardEmployee)
    .map(incomeThreshold)
    .filter(Boolean)
  const exemption = Math.max(directExemption, ...parsedExemptions, 0)
  const flag = Number(row.FLAG_NUOVA || 0)
  const hasExcludedSpecificExemption = exemptionDescriptions.some(
    (description) => !exemptionAppliesToStandardEmployee(description),
  )

  return {
    brackets: validated.pairs.map(({ upper, rate }) => [upper, rate]),
    bracketStatus: validated.status,
    unreadableAmounts,
    exemption,
    flag,
    special: flag === 0 || flag === 5 || flag === 6 || hasExcludedSpecificExemption,
  }
}

/** Il MEF ha acquisito la delibera ma la dichiara mai entrata in vigore per quell'anno. */
function isDeclaredInapplicable(row) {
  return /INAPPLICABIL/i.test(String(row.NOTE ?? ''))
}

/**
 * Una riga vale come regola dell'anno solo se ha una delibera acquisita e il MEF non la
 * dichiara inapplicabile (es. "ATTO OLTRE TERMINE - ALIQUOTE INAPPLICABILI PER IL 2026").
 */
function hasPublishedRule(row) {
  if (!String(row.NUMERO_DELIBERA ?? '').trim()) return false
  return !isDeclaredInapplicable(row)
}

async function loadText(url, localPath, encoding = 'utf8') {
  if (localPath) return readFile(resolve(localPath), encoding)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Download failed: ' + response.status + ' ' + url)
  }
  if (encoding === 'utf8') return response.text()
  return new TextDecoder(encoding).decode(await response.arrayBuffer())
}

const ISTAT_COLUMNS = 26
const ISTAT_NAME_COLUMN = 6 // "Denominazione in italiano"
const ISTAT_BILINGUAL_COLUMN = 5 // "Denominazione (Italiana e straniera)", es. "Bolzano/Bozen"
const ISTAT_CADASTRAL_COLUMN = 19

/**
 * Denominazioni ufficiali ISTAT indicizzate per codice catastale. Il registro MEF scrive i nomi
 * in maiuscolo con l'apostrofo al posto dell'accento ("FORLI'", "DOLCE'"): l'elenco ISTAT
 * restituisce "Forlì" e "Dolcè". Viene tenuta anche la forma bilingue, che serve come alias di
 * ricerca per i Comuni altoatesini e friulani. In caso di errore di rete si usano i nomi MEF.
 */
async function loadIstatNames(localPath) {
  try {
    const text = await loadText(ISTAT_MUNICIPALITIES_URL, localPath, 'latin1')
    const names = new Map()
    let skipped = 0

    for (const line of text.split(/\r?\n/)) {
      if (!/^\d{2};/.test(line)) continue
      const fields = line.split(';')
      const name = String(fields[ISTAT_NAME_COLUMN] ?? '').trim()
      const bilingual = String(fields[ISTAT_BILINGUAL_COLUMN] ?? '').trim()
      const code = String(fields[ISTAT_CADASTRAL_COLUMN] ?? '').trim().toUpperCase()

      // Lo split su ';' è sicuro solo finché le righe dati non usano le virgolette:
      // una riga con un numero di campi diverso significa formato cambiato, e va scartata.
      if (fields.length !== ISTAT_COLUMNS || !/^[A-Z]\d{3}$/.test(code) || !name) {
        skipped += 1
        continue
      }
      names.set(code, { name, bilingual })
    }

    if (skipped > 5) throw new Error('Unexpected ISTAT row format: ' + skipped + ' rows skipped')
    if (names.size < 7_000) throw new Error('Unexpected ISTAT list size: ' + names.size)
    return names
  } catch (error) {
    console.warn('ISTAT names unavailable, falling back to MEF names:', error.message)
    return new Map()
  }
}

/**
 * Nomi alternativi con cui l'utente può cercare il Comune: la denominazione MEF (più colloquiale,
 * es. "Reggio Emilia" contro l'ufficiale "Reggio nell'Emilia") e la forma in lingua locale
 * ("Bozen", "Brixen"). Restano fuori dall'etichetta mostrata, entrano solo nell'indice di ricerca.
 */
function buildSearchAliases(officialName, mefName, bilingual) {
  const aliases = new Set()
  const normalize = (value) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’'`´ʼ"“”\-\s]+/g, '')
      .toLocaleLowerCase('it-IT')

  const official = normalize(officialName)
  const candidates = [mefName, ...bilingual.split('/')]

  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (!trimmed) continue
    if (normalize(trimmed) === official) continue
    aliases.add(trimmed)
  }

  return [...aliases]
}

async function main() {
  const local2026 = process.argv[2]
  const local2025 = process.argv[3]
  const localIstat = process.argv[4]
  const [text2026, text2025, istatNames] = await Promise.all([
    loadText(MUNICIPAL_2026_URL, local2026),
    loadText(MUNICIPAL_2025_URL, local2025),
    loadIstatNames(localIstat),
  ])
  const currentRows = parseCsv(text2026)
  const fallbackRows = parseCsv(text2025)
  const fallbackByCode = new Map(fallbackRows.map((row) => [row.CODICE_CATASTALE, row]))

  let noSurcharge = 0
  let specialCases = 0
  let namesFromIstat = 0
  const repairedBrackets = []
  const quarantined = []
  const unreadableAmounts = []

  const municipalities = currentRows.map((currentRow) => {
    const code = String(currentRow.CODICE_CATASTALE).trim()
    const fallbackRow = fallbackByCode.get(currentRow.CODICE_CATASTALE)
    const currentIsUsable = hasPublishedRule(currentRow)
    // La riga dell'anno precedente serve anche quando non ha una delibera: "0*" in entrambi gli
    // anni significa che il Comune non ha istituito l'addizionale, non che il dato manchi.
    // Va scartata solo se il MEF dichiara la delibera 2025 inapplicabile: in quel caso varrebbe
    // la regola 2024, che questa pipeline non scarica.
    const fallbackIsUsable = Boolean(fallbackRow && !isDeclaredInapplicable(fallbackRow))

    let selectedRow = currentRow
    let sourceYear = 2026

    if (!currentIsUsable && fallbackIsUsable) {
      selectedRow = fallbackRow
      sourceYear = 2025
    } else if (!currentIsUsable) {
      sourceYear = 0
    }

    let parsed = parseMunicipalRule(selectedRow)

    // Scaglioni non ricostruibili: prima di rinunciare si prova la riga dell'altro anno,
    // che spesso contiene la stessa delibera scritta in modo leggibile.
    if (parsed.bracketStatus === 'invalid' && sourceYear === 2026 && fallbackIsUsable) {
      const fromFallback = parseMunicipalRule(fallbackRow)
      if (fromFallback.bracketStatus !== 'invalid') {
        selectedRow = fallbackRow
        sourceYear = 2025
        parsed = fromFallback
      }
    }

    const province = String(currentRow.PR || selectedRow.PR).trim()
    const region = PROVINCE_TO_REGION[province]

    if (!region) throw new Error('Missing region mapping for province ' + province)

    let exemption = parsed.exemption
    let special = parsed.special

    if (parsed.bracketStatus === 'repaired') {
      repairedBrackets.push(code)
      special = true
    } else if (parsed.bracketStatus === 'invalid') {
      // Scaglioni non interpretabili in nessun anno: il record resta visibile ma senza regola.
      quarantined.push(code)
      sourceYear = 0
      exemption = 0
      special = true
    }

    if (parsed.unreadableAmounts.length) {
      unreadableAmounts.push(code + ': ' + parsed.unreadableAmounts.join(' | '))
    }
    if (parsed.brackets.length === 0) noSurcharge += 1
    if (special) specialCases += 1

    const istat = istatNames.get(code)
    const mefName = titleCaseMunicipality(String(currentRow.COMUNE).trim())
    if (istat) namesFromIstat += 1

    const name = istat?.name ?? mefName
    const aliases = istat ? buildSearchAliases(name, mefName, istat.bilingual) : []

    return {
      c: code,
      n: name,
      p: province,
      g: region,
      y: sourceYear,
      e: exemption,
      b: parsed.brackets,
      s: special ? 1 : 0,
      ...(aliases.length ? { a: aliases } : {}),
    }
  })

  municipalities.sort((first, second) => {
    const byName = first.n.localeCompare(second.n, 'it-IT')
    return byName || first.p.localeCompare(second.p, 'it-IT')
  })

  // Contati sul risultato finale, così quarantena e ripiego non li lasciano disallineati.
  const currentYearRules = municipalities.filter((municipality) => municipality.y === 2026).length
  const fallbackRules = municipalities.filter((municipality) => municipality.y === 2025).length
  const unresolved = municipalities.filter((municipality) => municipality.y === 0).length

  // Il tetto ordinario dell'addizionale comunale è 0,8% (D.Lgs. 360/1998 art. 1 c. 3).
  // Sopra vanno solo Roma (0,9%) e i Comuni con accordo di risanamento con lo Stato (fino a 1,2%).
  const overOrdinaryCap = municipalities.filter((municipality) =>
    municipality.b.some(([, rate]) => rate > 0.008),
  )
  const unexpectedOverCap = overOrdinaryCap.filter(
    (municipality) => !MUNICIPALITIES_ABOVE_ORDINARY_CAP.has(municipality.c),
  )
  if (unexpectedOverCap.length) {
    console.warn(
      'Rates above the ordinary 0.8% ceiling without a known derogation: ' +
        unexpectedOverCap.map((municipality) => municipality.c + ' ' + municipality.n).join(', '),
    )
  }
  if (unreadableAmounts.length) {
    console.warn('Unreadable amounts in MEF descriptions:\n  ' + unreadableAmounts.join('\n  '))
  }

  const meta = {
    taxYear: 2026,
    generatedAt: new Date().toISOString(),
    municipalities: municipalities.length,
    currentYearRules,
    fallbackRules,
    noSurcharge,
    specialCases,
    unresolved,
    repairedBrackets,
    quarantined,
    namesFromIstat,
    searchAliases: municipalities.filter((municipality) => municipality.a).length,
    municipalSourcePage: MUNICIPAL_SOURCE_PAGE,
    municipalSource2026: MUNICIPAL_2026_URL,
    municipalFallbackSource2025: MUNICIPAL_2025_URL,
    istatMunicipalitiesSource: ISTAT_MUNICIPALITIES_URL,
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
      ' fallback from 2025, ' +
      unresolved +
      ' unresolved, ' +
      repairedBrackets.length +
      ' repaired, ' +
      quarantined.length +
      ' quarantined, ' +
      namesFromIstat +
      ' ISTAT names).\n',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

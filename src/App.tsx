import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import brandMark from './assets/netto-mark-v3-crop.png'
import {
  TAX_DATA_META,
  getMunicipality,
  getMunicipalitySourceUrl,
  getMunicipalRateLabel,
  getRegionName,
  getRegionRateLabel,
  searchMunicipalities,
  type Municipality,
} from './lib/localTaxes'
import {
  MAX_GROSS_SALARY,
  MIN_GROSS_SALARY,
  TAX_YEAR,
  calculateSalaryProjection,
  type SalaryProjection,
} from './lib/tax'

const TaxMap = lazy(() =>
  import('./components/TaxMap').then((module) => ({ default: module.TaxMap })),
)

const EXAMPLE_SALARIES = [25_000, 35_000, 50_000]
const COMPARISON_CITY_CODES = ['F205', 'H501', 'F839', 'L219', 'A944', 'G273']
const DATA_SNAPSHOT_DATE = new Date(TAX_DATA_META.generatedAt)
const REGIONAL_DATA_DATE = new Date(TAX_DATA_META.regionalSourceUpdatedAt + 'T12:00:00Z')
const DATA_DATE_IT = new Intl.DateTimeFormat('it-IT').format(DATA_SNAPSHOT_DATE)
const DATA_DATE_EN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(DATA_SNAPSHOT_DATE)
const REGIONAL_DATE_IT = new Intl.DateTimeFormat('it-IT').format(REGIONAL_DATA_DATE)
const REGIONAL_DATE_EN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(REGIONAL_DATA_DATE)

const SOURCE_LINKS = [
  {
    title: { it: 'Aliquote IRPEF 2026', en: '2026 income tax rates' },
    meta: 'Legge 199/2025 · Normattiva',
    href: 'https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED',
  },
  {
    title: { it: 'Detrazioni e cuneo fiscale', en: 'Deductions and tax wedge' },
    meta: 'Legge 207/2024 · Normattiva',
    href: 'https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/CONSOLIDATED',
  },
  {
    title: { it: 'Contributi previdenziali', en: 'Social security contributions' },
    meta: 'Circolare INPS n. 6/2026',
    href: 'https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html',
  },
  {
    title: { it: 'Confini amministrativi 2026', en: '2026 administrative boundaries' },
    meta: 'ISTAT · 110 aree provinciali',
    href: 'https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/',
  },
] as const

const COPY = {
  it: {
    navigation: 'Navigazione principale',
    toolsNav: 'Atlante',
    detailNav: 'Dettaglio',
    sourcesNav: 'Fonti',
    language: 'Cambia lingua',
    home: 'netto, torna all’inizio',
    eyebrow: 'Stima ' + TAX_YEAR + ' · Italia',
    heroLine1: 'Dalla RAL',
    heroLine2: 'al netto.',
    heroIntro:
      'Inserisci la retribuzione lorda e scopri quanto resta davvero, con tasse e contributi verificabili.',
    heroContext:
      'Dipendente privato · Tempo indeterminato · ' +
      new Intl.NumberFormat('it-IT').format(TAX_DATA_META.municipalities) +
      ' voci fiscali MEF',
    calculatorTitle: 'Calcola il tuo netto',
    calculatorMeta: TAX_YEAR + ' · Italia',
    salaryLabel: 'Retribuzione annua lorda',
    salaryAria: 'Seleziona la retribuzione annua lorda',
    salaryHelp: 'RAL ammessa da 15.000 € a 120.000 €',
    examples: 'Esempi',
    residence: 'Comune di residenza fiscale',
    municipalitySearch: 'Digita il tuo Comune',
    municipalityAction: 'Cerca',
    municipalityAria: 'Cerca e seleziona il Comune di residenza fiscale',
    noMunicipality: 'Nessun Comune trovato',
    municipalityPrompt:
      'Cerca tra ' +
      new Intl.NumberFormat('it-IT').format(TAX_DATA_META.municipalities) +
      ' voci fiscali MEF',
    municipalityRequired: 'Seleziona un Comune dai risultati.',
    sourceYear: 'regola MEF',
    payPeriods: 'Mensilità',
    calculate: 'Calcola il netto',
    standardFormNote: 'Anno intero · nessun familiare o altra detrazione personale',
    errorStart: 'Inserisci una RAL tra ',
    errorJoin: ' e ',
    monthlyNet: 'Netto medio',
    perPayPeriod: 'per mensilità',
    annualNet: 'Netto annuale',
    annualTaxes: 'Tasse annuali',
    net: 'Netto',
    taxes: 'Tasse',
    contributions: 'INPS',
    benefits: 'Benefici fiscali',
    resultNote: 'Media annuale: le singole buste paga possono variare.',
    emptyResult: 'Scegli il Comune e calcola.',
    nextThousand: 'Prossimi 1.000 € lordi',
    netPerYear: 'netti / anno',
    publishedRule: 'pubblicata',
    fallbackRule: 'fallback',
    pendingRule: 'dato in aggiornamento',
    specialRule: 'caso speciale',
    toolsTitle: 'Atlante fiscale.',
    toolsIntro: 'Esplora l’Italia e cambia Comune direttamente dalla mappa.',
    mapLoading: 'Caricamento della mappa fiscale…',
    live: 'Live',
    cityCompareTitle: 'Confronta città',
    cityCompareDescription:
      'Netto annuale della stessa RAL nelle principali città. Tocca una riga per applicarla.',
    selected: 'Selezionata',
    versusSelected: 'vs selezione',
    dataCoverage: 'voci nel registro fiscale MEF',
    dataCoverageMeta:
      new Intl.NumberFormat('it-IT').format(TAX_DATA_META.currentYearRules) +
      ' pubblicate nel 2026 · ' +
      new Intl.NumberFormat('it-IT').format(TAX_DATA_META.fallbackRules) +
      ' fallback 2025',
    marketValueTitle: 'Quanto vali?',
    marketValueDescription:
      'Una stima della RAL di mercato basata su ruolo, esperienza e città.',
    preview: 'Demo · Presto',
    role: 'Ruolo',
    experience: 'Esperienza',
    city: 'Città',
    marketSalary: 'RAL di mercato',
    previewRole: 'Product builder',
    previewExperience: '4 anni',
    previewCity: 'Milano',
    detailTitle: 'Il dettaglio.',
    detailIntro: 'Ogni trattenuta, con regola locale e fonte.',
    reconciliation: 'Riconciliazione annuale',
    grossSalary: 'Retribuzione lorda',
    employeeContributions: 'Contributi INPS',
    taxableIncome: 'Imponibile fiscale',
    netIrpef: 'IRPEF netta',
    grossTax: 'Lorda',
    deductions: 'detrazioni',
    regionalTax: 'Addizionale regionale',
    municipalTax: 'Addizionale comunale',
    regionalAdjustment: 'Agevolazione regionale',
    exemptionApplied: 'Esenzione comunale applicata',
    fiscalBenefits: 'Benefici fiscali',
    estimatedAnnualNet: 'Netto annuale stimato',
    totalWithholdings: 'Trattenute annuali',
    openBreakdown: 'Apri il dettaglio',
    closeBreakdown: 'Chiudi il dettaglio',
    includedRules: 'Regole applicate',
    baseContributions: 'Contributi base',
    incomeTax: 'IRPEF',
    baseRate: '9,19%',
    incomeTaxRates: '23 · 33 · 43%',
    standardScope:
      'Caso standard: dipendente privato a tempo indeterminato, senza familiari a carico o altri redditi. Esclusi TFR, welfare, premi e fringe benefit.',
    regionalSourceTitle: 'Addizionali regionali 2026',
    regionalSourceMeta: 'MEF · 21 giurisdizioni · aggiornato ' + REGIONAL_DATE_IT,
    municipalDatasetTitle: 'Registro addizionali comunali',
    municipalDatasetMeta:
      'MEF · ' +
      new Intl.NumberFormat('it-IT').format(TAX_DATA_META.municipalities) +
      ' voci · aggiornamento quotidiano',
    municipalSourceTitle: 'Addizionale comunale',
    methodTitle: 'Dati e fonti',
    methodIntro:
      'Dataset MEF versionati, norme nazionali e link alla regola del Comune selezionato.',
    sourceAria: 'Apri la fonte in una nuova scheda',
    disclaimer: 'Prototipo informativo, non sostituisce un cedolino o una consulenza fiscale.',
    footerMeta: 'Italia · ' + TAX_YEAR + ' · dati ' + DATA_DATE_IT,
  },
  en: {
    navigation: 'Main navigation',
    toolsNav: 'Atlas',
    detailNav: 'Breakdown',
    sourcesNav: 'Sources',
    language: 'Change language',
    home: 'netto, back to top',
    eyebrow: TAX_YEAR + ' estimate · Italy',
    heroLine1: 'From gross',
    heroLine2: 'to net.',
    heroIntro:
      'Enter your gross annual salary and see what you take home, with verifiable taxes and contributions.',
    heroContext:
      'Private employee · Permanent contract · ' +
      new Intl.NumberFormat('en-IE').format(TAX_DATA_META.municipalities) +
      ' MEF tax records',
    calculatorTitle: 'Calculate your net pay',
    calculatorMeta: TAX_YEAR + ' · Italy',
    salaryLabel: 'Gross annual salary',
    salaryAria: 'Select gross annual salary',
    salaryHelp: 'Supported gross salary from €15,000 to €120,000',
    examples: 'Examples',
    residence: 'Municipality of tax residence',
    municipalitySearch: 'Type your municipality',
    municipalityAction: 'Search',
    municipalityAria: 'Search and select the municipality of tax residence',
    noMunicipality: 'No municipality found',
    municipalityPrompt:
      'Search ' +
      new Intl.NumberFormat('en-IE').format(TAX_DATA_META.municipalities) +
      ' MEF tax records',
    municipalityRequired: 'Select a municipality from the results.',
    sourceYear: 'MEF rule',
    payPeriods: 'Pay periods',
    calculate: 'Calculate net pay',
    standardFormNote: 'Full year · no dependants or personal deductions',
    errorStart: 'Enter a gross salary between ',
    errorJoin: ' and ',
    monthlyNet: 'Average net pay',
    perPayPeriod: 'per pay period',
    annualNet: 'Annual net pay',
    annualTaxes: 'Annual taxes',
    net: 'Net',
    taxes: 'Taxes',
    contributions: 'INPS',
    benefits: 'Tax benefits',
    resultNote: 'Annual average: individual payslips may vary.',
    emptyResult: 'Choose your municipality and calculate.',
    nextThousand: 'Next €1,000 gross',
    netPerYear: 'net / year',
    publishedRule: 'published',
    fallbackRule: 'fallback',
    pendingRule: 'data being updated',
    specialRule: 'special case',
    toolsTitle: 'Tax atlas.',
    toolsIntro: 'Explore Italy and change municipality directly from the map.',
    mapLoading: 'Loading the tax map…',
    live: 'Live',
    cityCompareTitle: 'Compare cities',
    cityCompareDescription:
      'Annual net pay for the same salary in major cities. Tap a row to apply it.',
    selected: 'Selected',
    versusSelected: 'vs selected',
    dataCoverage: 'records in the MEF tax register',
    dataCoverageMeta:
      new Intl.NumberFormat('en-IE').format(TAX_DATA_META.currentYearRules) +
      ' published in 2026 · ' +
      new Intl.NumberFormat('en-IE').format(TAX_DATA_META.fallbackRules) +
      ' using 2025 fallback',
    marketValueTitle: 'What are you worth?',
    marketValueDescription:
      'A market salary estimate based on your role, experience and city.',
    preview: 'Preview · Soon',
    role: 'Role',
    experience: 'Experience',
    city: 'City',
    marketSalary: 'Market salary',
    previewRole: 'Product builder',
    previewExperience: '4 years',
    previewCity: 'Milan',
    detailTitle: 'The breakdown.',
    detailIntro: 'Every deduction, with its local rule and source.',
    reconciliation: 'Annual reconciliation',
    grossSalary: 'Gross salary',
    employeeContributions: 'INPS contributions',
    taxableIncome: 'Taxable income',
    netIrpef: 'Net income tax',
    grossTax: 'Gross',
    deductions: 'deductions',
    regionalTax: 'Regional surtax',
    municipalTax: 'Municipal surtax',
    regionalAdjustment: 'Regional relief',
    exemptionApplied: 'Municipal exemption applied',
    fiscalBenefits: 'Tax benefits',
    estimatedAnnualNet: 'Estimated annual net',
    totalWithholdings: 'Annual deductions',
    openBreakdown: 'Open breakdown',
    closeBreakdown: 'Close breakdown',
    includedRules: 'Rules applied',
    baseContributions: 'Base contributions',
    incomeTax: 'Income tax',
    baseRate: '9.19%',
    incomeTaxRates: '23 · 33 · 43%',
    standardScope:
      'Standard case: permanent private employee with no dependants or other income. Severance pay, welfare, bonuses and fringe benefits are excluded.',
    regionalSourceTitle: '2026 regional surtaxes',
    regionalSourceMeta: 'MEF · 21 jurisdictions · updated ' + REGIONAL_DATE_EN,
    municipalDatasetTitle: 'Municipal surtax register',
    municipalDatasetMeta:
      'MEF · ' +
      new Intl.NumberFormat('en-IE').format(TAX_DATA_META.municipalities) +
      ' records · updated daily',
    municipalSourceTitle: 'Municipal surtax',
    methodTitle: 'Data and sources',
    methodIntro:
      'Versioned MEF datasets, national legislation and the selected municipality’s exact record.',
    sourceAria: 'Open source in a new tab',
    disclaimer: 'Informational prototype. It does not replace a payslip or professional tax advice.',
    footerMeta: 'Italy · ' + TAX_YEAR + ' · data ' + DATA_DATE_EN,
  },
} as const

type Language = keyof typeof COPY
type Copy = (typeof COPY)[Language]

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {diagonal ? <path d="M5 15 15 5M7 5h8v8" /> : <path d="M3 10h14m-5-5 5 5-5 5" />}
    </svg>
  )
}

function MunicipalityPicker({
  value,
  language,
  copy,
  error,
  onChange,
}: {
  value: Municipality | null
  language: Language
  copy: Copy
  error?: string
  onChange: (municipality: Municipality) => void
}) {
  const listId = useId()
  const errorId = listId + '-error'
  const displayValue = value ? value.n + ' (' + value.p + ')' : ''
  const [query, setQuery] = useState(displayValue)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setQuery(displayValue)
  }, [displayValue])

  const options = useMemo(() => {
    if (!value || query !== displayValue) return searchMunicipalities(query, 8)

    const matches = searchMunicipalities('', 8)
    return [value, ...matches.filter((item) => item.c !== value.c)].slice(0, 8)
  }, [displayValue, query, value])

  function selectMunicipality(municipality: Municipality) {
    onChange(municipality)
    setQuery(municipality.n + ' (' + municipality.p + ')')
    setIsOpen(false)
    setActiveIndex(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => Math.min(current + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && isOpen && options[activeIndex]) {
      event.preventDefault()
      selectMunicipality(options[activeIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setQuery(displayValue)
    }
  }

  return (
    <div className="municipality-field">
      <label className="field-label" htmlFor="municipality">
        {copy.residence}
      </label>
      <div className="municipality-picker">
        <input
          id="municipality"
          type="search"
          value={query}
          placeholder={copy.municipalitySearch}
          autoComplete="off"
          role="combobox"
          aria-label={copy.municipalityAria}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={
            isOpen && options[activeIndex] ? listId + '-' + options[activeIndex].c : undefined
          }
          onFocus={(event) => {
            event.currentTarget.select()
            setIsOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false)
              setQuery(displayValue)
            }, 120)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="municipality-picker__marker" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <circle cx="8.5" cy="8.5" r="5.25" />
            <path d="m12.5 12.5 4 4" />
          </svg>
          {copy.municipalityAction}
        </span>

        {isOpen ? (
          <div className="municipality-options" id={listId} role="listbox">
            {options.length ? (
              options.map((municipality, index) => (
                <button
                  type="button"
                  role="option"
                  id={listId + '-' + municipality.c}
                  aria-selected={municipality.c === value?.c}
                  className={index === activeIndex ? 'is-active' : ''}
                  key={municipality.c}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectMunicipality(municipality)}
                >
                  <span>
                    <strong>{municipality.n}</strong>
                    <small>
                      {municipality.p} · {getRegionName(municipality.g, language)}
                    </small>
                  </span>
                  <small>MEF {municipality.y || TAX_YEAR}</small>
                </button>
              ))
            ) : (
              <p>{copy.noMunicipality}</p>
            )}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="municipality-error" id={errorId} role="alert">
          {error}
        </p>
      ) : value ? (
        <p className="municipality-meta">
          {getRegionName(value.g, language)} · {copy.sourceYear} {value.y || TAX_YEAR}
        </p>
      ) : (
        <p className="municipality-meta municipality-meta--prompt">{copy.municipalityPrompt}</p>
      )}
    </div>
  )
}

function BreakdownRow({
  label,
  note,
  amount,
  formatCurrency,
  tone = 'negative',
  strong = false,
}: {
  label: string
  note?: string
  amount: number
  formatCurrency: (value: number) => string
  tone?: 'negative' | 'positive' | 'neutral'
  strong?: boolean
}) {
  const prefix = tone === 'negative' ? '−' : tone === 'positive' ? '+' : ''

  return (
    <div className={'breakdown-row ' + (strong ? 'breakdown-row--strong' : '')}>
      <div>
        <span className="breakdown-label">{label}</span>
        {note ? <span className="breakdown-note">{note}</span> : null}
      </div>
      <span className={'breakdown-amount breakdown-amount--' + tone}>
        {prefix}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  )
}

function ResultPanel({
  result,
  copy,
  language,
  marginalNet,
  sourceUrl,
  formatCurrency,
  formatPercent,
}: {
  result: SalaryProjection
  copy: Copy
  language: Language
  marginalNet?: number
  sourceUrl: string
  formatCurrency: (value: number) => string
  formatPercent: (value: number) => string
}) {
  const netFromGross = Math.max(
    0,
    result.grossAnnualSalary - result.employeeContributions - result.totalTaxes,
  )
  const netShare = (netFromGross / result.grossAnnualSalary) * 100
  const contributionShare = (result.employeeContributions / result.grossAnnualSalary) * 100
  const taxShare = (result.totalTaxes / result.grossAnnualSalary) * 100
  const barStyle = {
    '--net-share': String(netShare) + '%',
    '--tax-share': String(taxShare) + '%',
    '--contribution-share': String(contributionShare) + '%',
  } as CSSProperties
  const sourceStatus =
    result.localRuleYear === TAX_YEAR
      ? copy.publishedRule + ' ' + TAX_YEAR
      : result.localRuleYear > 0
        ? copy.fallbackRule + ' ' + result.localRuleYear
        : copy.pendingRule

  return (
    <section className="result-panel" aria-live="polite" aria-atomic="true">
      <div className="result-location">
        <strong>
          {result.municipalityName} · {result.municipalityProvince}
        </strong>
        <span>{getRegionName(result.regionKey, language)}</span>
      </div>

      <div className="monthly-result">
        <span>{copy.monthlyNet}</span>
        <strong>{formatCurrency(result.netPerPayPeriod)}</strong>
        <small>{copy.perPayPeriod}</small>
      </div>

      <div className="annual-results">
        <div>
          <span>{copy.annualNet}</span>
          <strong>{formatCurrency(result.annualNet)}</strong>
        </div>
        <div>
          <span>{copy.annualTaxes}</span>
          <strong>−{formatCurrency(result.totalTaxes)}</strong>
        </div>
      </div>

      <div className="salary-composition" style={barStyle}>
        <div className="salary-composition__bar" aria-hidden="true">
          <span className="salary-composition__net" />
          <span className="salary-composition__taxes" />
          <span className="salary-composition__contributions" />
        </div>
        <div className="salary-composition__legend">
          <span>
            <i className="legend-dot legend-dot--net" />
            {copy.net} {formatPercent(netFromGross / result.grossAnnualSalary)}
          </span>
          <span>
            <i className="legend-dot legend-dot--taxes" />
            {copy.taxes} {formatPercent(result.totalTaxes / result.grossAnnualSalary)}
          </span>
          <span>
            <i className="legend-dot legend-dot--contributions" />
            {copy.contributions} {formatPercent(result.employeeContributions / result.grossAnnualSalary)}
          </span>
        </div>
      </div>

      {result.totalBenefits > 0 ? (
        <div className="benefit-note">
          <span>{copy.benefits}</span>
          <strong>+{formatCurrency(result.totalBenefits)}</strong>
        </div>
      ) : null}

      {marginalNet !== undefined ? (
        <div className="marginal-insight">
          <span>{copy.nextThousand}</span>
          <strong>
            {marginalNet >= 0 ? '+' : '−'}
            {formatCurrency(Math.abs(marginalNet))} {copy.netPerYear}
          </strong>
        </div>
      ) : null}

      <a className="result-source" href={sourceUrl} target="_blank" rel="noreferrer">
        <span>
          MEF · {sourceStatus}
          {result.localRuleSpecial ? ' · ' + copy.specialRule : ''}
        </span>
        <ArrowIcon diagonal />
      </a>

      <p className="result-note">{copy.resultNote}</p>
    </section>
  )
}

function App() {
  const [language, setLanguage] = useState<Language>('it')
  const [draftSalary, setDraftSalary] = useState('35000')
  const [draftPayPeriods, setDraftPayPeriods] = useState<12 | 13 | 14>(13)
  const [draftMunicipalityCode, setDraftMunicipalityCode] = useState<string | null>(null)
  const [calculatedSalary, setCalculatedSalary] = useState(35_000)
  const [calculatedPayPeriods, setCalculatedPayPeriods] = useState<12 | 13 | 14>(13)
  const [calculatedMunicipalityCode, setCalculatedMunicipalityCode] = useState('F205')
  const [hasError, setHasError] = useState(false)
  const [hasMunicipalityError, setHasMunicipalityError] = useState(false)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 781px)').matches,
  )

  const copy = COPY[language]
  const locale = language === 'it' ? 'it-IT' : 'en-IE'
  const draftMunicipality = draftMunicipalityCode
    ? getMunicipality(draftMunicipalityCode)
    : null
  const calculatedMunicipality = getMunicipality(calculatedMunicipalityCode)
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  )
  const preciseCurrency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )
  const percent = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }),
    [locale],
  )
  const compactNumber = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  )

  const result = useMemo(
    () =>
      calculateSalaryProjection(
        calculatedSalary,
        calculatedPayPeriods,
        calculatedMunicipality,
      ),
    [calculatedMunicipality, calculatedPayPeriods, calculatedSalary],
  )
  const marginalResult = useMemo(
    () =>
      calculatedSalary < MAX_GROSS_SALARY
        ? calculateSalaryProjection(
            Math.min(MAX_GROSS_SALARY, calculatedSalary + 1_000),
            calculatedPayPeriods,
            calculatedMunicipality,
          )
        : undefined,
    [calculatedMunicipality, calculatedPayPeriods, calculatedSalary],
  )
  const cityComparisons = useMemo(() => {
    const codes = [
      calculatedMunicipalityCode,
      ...COMPARISON_CITY_CODES.filter((code) => code !== calculatedMunicipalityCode),
    ].slice(0, 5)

    return codes
      .map((code) => {
        const municipality = getMunicipality(code)
        return {
          municipality,
          projection: calculateSalaryProjection(
            calculatedSalary,
            calculatedPayPeriods,
            municipality,
          ),
        }
      })
      .sort((first, second) => second.projection.annualNet - first.projection.annualNet)
  }, [calculatedMunicipalityCode, calculatedPayPeriods, calculatedSalary])

  const sliderValue = Math.min(
    MAX_GROSS_SALARY,
    Math.max(MIN_GROSS_SALARY, Number(draftSalary) || MIN_GROSS_SALARY),
  )
  const rangeProgress =
    ((sliderValue - MIN_GROSS_SALARY) / (MAX_GROSS_SALARY - MIN_GROSS_SALARY)) * 100

  useEffect(() => {
    document.documentElement.lang = language
    document.title =
      language === 'it' ? 'netto. — Calcolo stipendio netto' : 'netto. — Take-home pay calculator'
  }, [language])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 781px)')
    const syncDetailState = () => setDetailsOpen(mediaQuery.matches)

    mediaQuery.addEventListener('change', syncDetailState)
    return () => mediaQuery.removeEventListener('change', syncDetailState)
  }, [])

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(draftSalary)

    if (!draftMunicipality) {
      setHasMunicipalityError(true)
      return
    }

    if (!Number.isFinite(value) || value < MIN_GROSS_SALARY || value > MAX_GROSS_SALARY) {
      setHasError(true)
      return
    }

    setHasError(false)
    setHasMunicipalityError(false)
    setCalculatedSalary(value)
    setCalculatedPayPeriods(draftPayPeriods)
    setCalculatedMunicipalityCode(draftMunicipality.c)
    setHasCalculated(true)
  }

  function applyInteractiveMunicipality(municipality: Municipality) {
    const parsedSalary = Number(draftSalary)
    const salary =
      Number.isFinite(parsedSalary) &&
      parsedSalary >= MIN_GROSS_SALARY &&
      parsedSalary <= MAX_GROSS_SALARY
        ? parsedSalary
        : sliderValue

    setDraftSalary(String(salary))
    setDraftMunicipalityCode(municipality.c)
    setCalculatedSalary(salary)
    setCalculatedPayPeriods(draftPayPeriods)
    setCalculatedMunicipalityCode(municipality.c)
    setHasError(false)
    setHasMunicipalityError(false)
    setHasCalculated(true)
  }

  const errorMessage =
    copy.errorStart +
    currency.format(MIN_GROSS_SALARY) +
    copy.errorJoin +
    currency.format(MAX_GROSS_SALARY) +
    '.'
  const irpefDeductions = result.employmentDeduction + result.additionalEmploymentDeduction
  const irpefNote =
    copy.grossTax +
    ' ' +
    preciseCurrency.format(result.grossIrpef) +
    ' · ' +
    copy.deductions +
    ' −' +
    preciseCurrency.format(irpefDeductions)
  const regionalNote =
    result.regionalAdjustment > 0
      ? copy.regionalAdjustment + ' −' + preciseCurrency.format(result.regionalAdjustment)
      : undefined
  const municipalNote = result.municipalExemptionApplied
    ? copy.exemptionApplied
    : copy.sourceYear + ' ' + (result.localRuleYear || TAX_YEAR)
  const municipalitySourceUrl = getMunicipalitySourceUrl(calculatedMunicipality)
  const localSourceMeta =
    result.localRuleYear === TAX_YEAR
      ? 'MEF · ' + copy.publishedRule + ' ' + TAX_YEAR
      : result.localRuleYear > 0
        ? 'MEF · ' + copy.fallbackRule + ' ' + result.localRuleYear
        : 'MEF · ' + copy.pendingRule
  const sources = [
    ...SOURCE_LINKS.map((source) => ({
      title: source.title[language],
      meta: source.meta,
      href: source.href,
    })),
    {
      title: copy.regionalSourceTitle,
      meta: copy.regionalSourceMeta,
      href: TAX_DATA_META.regionalSourcePage,
    },
    {
      title: copy.municipalDatasetTitle,
      meta: copy.municipalDatasetMeta,
      href: TAX_DATA_META.municipalSourcePage,
    },
    ...(hasCalculated
      ? [
          {
            title: copy.municipalSourceTitle + ' · ' + result.municipalityName,
            meta: localSourceMeta,
            href: municipalitySourceUrl,
          },
        ]
      : []),
  ]

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label={copy.home}>
          <img src={brandMark} alt="" />
          <span>netto.</span>
        </a>

        <div className="header-actions">
          <nav aria-label={copy.navigation}>
            <a href="#strumenti">{copy.toolsNav}</a>
            <a href="#dettaglio">{copy.detailNav}</a>
            <a href="#fonti">{copy.sourcesNav}</a>
          </nav>
          <div className="language-switch" aria-label={copy.language}>
            {(['it', 'en'] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={language === item}
                onClick={() => setLanguage(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true" />
              {copy.eyebrow}
            </p>
            <h1 id="hero-title">
              {copy.heroLine1}
              <br />
              <span>{copy.heroLine2}</span>
            </h1>
            <p className="hero-intro">{copy.heroIntro}</p>
            <p className="hero-context">{copy.heroContext}</p>
          </div>

          <div className="calculator" id="calcolatore">
            <form className="calculator-form" onSubmit={calculate} noValidate>
              <div className="calculator-heading">
                <h2>{copy.calculatorTitle}</h2>
                <span>{copy.calculatorMeta}</span>
              </div>

              <label className="field-label" htmlFor="salary">
                {copy.salaryLabel}
              </label>
              <div className={'salary-input ' + (hasError ? 'salary-input--error' : '')}>
                <span aria-hidden="true">€</span>
                <input
                  id="salary"
                  name="salary"
                  type="number"
                  inputMode="decimal"
                  min={MIN_GROSS_SALARY}
                  max={MAX_GROSS_SALARY}
                  step="500"
                  value={draftSalary}
                  onChange={(event) => {
                    setDraftSalary(event.target.value)
                    if (hasError) setHasError(false)
                  }}
                  aria-describedby={hasError ? 'salary-error' : 'salary-help'}
                />
                <span className="salary-input__suffix">RAL</span>
              </div>

              <div className="range-wrap">
                <input
                  className="salary-range"
                  type="range"
                  min={MIN_GROSS_SALARY}
                  max={MAX_GROSS_SALARY}
                  step="500"
                  value={sliderValue}
                  aria-label={copy.salaryAria}
                  onChange={(event) => {
                    setDraftSalary(event.target.value)
                    if (hasError) setHasError(false)
                  }}
                  style={{ '--range-progress': String(rangeProgress) + '%' } as CSSProperties}
                />
                <div className="range-labels" id="salary-help" aria-label={copy.salaryHelp}>
                  <span>{compactNumber.format(MIN_GROSS_SALARY)}</span>
                  <span>{compactNumber.format(MAX_GROSS_SALARY)}</span>
                </div>
              </div>

              <div className="quick-values" aria-label={copy.examples}>
                <span>{copy.examples}</span>
                {EXAMPLE_SALARIES.map((salary) => (
                  <button
                    type="button"
                    key={salary}
                    onClick={() => {
                      setDraftSalary(String(salary))
                      setHasError(false)
                    }}
                  >
                    {compactNumber.format(salary)}
                  </button>
                ))}
              </div>

              <MunicipalityPicker
                value={draftMunicipality}
                language={language}
                copy={copy}
                error={hasMunicipalityError ? copy.municipalityRequired : undefined}
                onChange={(municipality) => {
                  setDraftMunicipalityCode(municipality.c)
                  setHasMunicipalityError(false)
                }}
              />

              <fieldset className="pay-periods">
                <legend>{copy.payPeriods}</legend>
                <div>
                  {([12, 13, 14] as const).map((periods) => (
                    <label key={periods}>
                      <input
                        type="radio"
                        name="pay-periods"
                        value={periods}
                        checked={draftPayPeriods === periods}
                        onChange={() => setDraftPayPeriods(periods)}
                      />
                      <span>{periods}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {hasError ? (
                <p className="form-error" id="salary-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button className="calculate-button" type="submit">
                <span>{copy.calculate}</span>
                <ArrowIcon />
              </button>
              <p className="form-note">{copy.standardFormNote}</p>
            </form>

            {hasCalculated ? (
              <ResultPanel
                result={result}
                copy={copy}
                language={language}
                marginalNet={
                  marginalResult ? marginalResult.annualNet - result.annualNet : undefined
                }
                sourceUrl={municipalitySourceUrl}
                formatCurrency={currency.format}
                formatPercent={percent.format}
              />
            ) : (
              <section className="result-panel result-panel--empty" aria-live="polite">
                <strong>— €</strong>
                <p>{copy.emptyResult}</p>
              </section>
            )}
          </div>
        </section>

        <section
          className="tools-section"
          id="strumenti"
          aria-labelledby="tools-title"
        >
          <div className="page-width">
            <div className="tools-heading">
              <h2 id="tools-title">{copy.toolsTitle}</h2>
              <p>{copy.toolsIntro}</p>
            </div>

            <Suspense
              fallback={
                <div className="tax-map-loading" role="status">
                  <span>{copy.mapLoading}</span>
                </div>
              }
            >
              <TaxMap
                grossSalary={sliderValue}
                selectedMunicipality={draftMunicipality}
                language={language}
                formatCurrency={currency.format}
                formatNumber={compactNumber.format}
                onSelectMunicipality={applyInteractiveMunicipality}
              />
            </Suspense>

            <div className="tools-grid" hidden={!hasCalculated}>
              <article className="tool-card tool-card--cities">
                <div className="tool-card__topline">
                  <span>{copy.cityCompareTitle}</span>
                  <strong>{copy.live}</strong>
                </div>
                <p>{copy.cityCompareDescription}</p>
                <div className="city-comparison-list">
                  {cityComparisons.map(({ municipality, projection }) => {
                    const delta = projection.annualNet - result.annualNet
                    const isSelected = municipality.c === calculatedMunicipalityCode

                    return (
                      <button
                        type="button"
                        className={isSelected ? 'is-selected' : ''}
                        key={municipality.c}
                        onClick={() => applyInteractiveMunicipality(municipality)}
                      >
                        <span>
                          <strong>{municipality.n}</strong>
                          <small>
                            {municipality.p} · MEF {municipality.y || TAX_YEAR}
                          </small>
                        </span>
                        <span>
                          <strong>{currency.format(projection.annualNet)}</strong>
                          <small>
                            {isSelected
                              ? copy.selected
                              : (delta >= 0 ? '+' : '−') +
                                currency.format(Math.abs(delta)) +
                                ' ' +
                                copy.versusSelected}
                          </small>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="coverage-note">
                  <div>
                    <strong>{compactNumber.format(TAX_DATA_META.municipalities)}</strong>
                    <span>{copy.dataCoverage}</span>
                  </div>
                  <small>{copy.dataCoverageMeta}</small>
                </div>
              </article>

              <article className="tool-card tool-card--market">
                <div className="tool-card__topline">
                  <span>{copy.marketValueTitle}</span>
                  <strong>{copy.preview}</strong>
                </div>
                <p>{copy.marketValueDescription}</p>
                <div className="market-preview" aria-label={copy.marketValueTitle}>
                  <div>
                    <span>{copy.role}</span>
                    <strong>{copy.previewRole}</strong>
                  </div>
                  <div>
                    <span>{copy.experience}</span>
                    <strong>{copy.previewExperience}</strong>
                  </div>
                  <div>
                    <span>{copy.city}</span>
                    <strong>{copy.previewCity}</strong>
                  </div>
                </div>
                <div className="masked-result">
                  <span>{copy.marketSalary}</span>
                  <strong>€ ••.•••</strong>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          className="detail-section"
          id="dettaglio"
          aria-labelledby="detail-title"
          hidden={!hasCalculated}
        >
          <div className="page-width">
            <div className="detail-heading">
              <h2 id="detail-title">{copy.detailTitle}</h2>
              <p>{copy.detailIntro}</p>
            </div>

            <div className="detail-grid">
              <details
                className="reconciliation-card"
                open={detailsOpen}
                onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
              >
                <summary className="reconciliation-summary">
                  <span>
                    <strong>{copy.totalWithholdings}</strong>
                    <small>{detailsOpen ? copy.closeBreakdown : copy.openBreakdown}</small>
                  </span>
                  <b>−{preciseCurrency.format(result.totalDeductions)}</b>
                </summary>
                <div className="card-heading">
                  <h3>{copy.reconciliation}</h3>
                  <span>{TAX_YEAR}</span>
                </div>
                <BreakdownRow
                  label={copy.grossSalary}
                  note={
                    String(result.payPeriods) +
                    ' × ' +
                    preciseCurrency.format(result.grossPerPayPeriod)
                  }
                  amount={result.grossAnnualSalary}
                  formatCurrency={preciseCurrency.format}
                  tone="neutral"
                />
                <BreakdownRow
                  label={copy.employeeContributions}
                  amount={result.employeeContributions}
                  formatCurrency={preciseCurrency.format}
                />
                <div className="taxable-row">
                  <span>{copy.taxableIncome}</span>
                  <strong>{preciseCurrency.format(result.taxableIncome)}</strong>
                </div>
                <BreakdownRow
                  label={copy.netIrpef}
                  note={irpefNote}
                  amount={result.netIrpef}
                  formatCurrency={preciseCurrency.format}
                />
                <BreakdownRow
                  label={
                    copy.regionalTax + ' · ' + getRegionName(result.regionKey, language)
                  }
                  note={regionalNote}
                  amount={result.regionalTax}
                  formatCurrency={preciseCurrency.format}
                />
                <BreakdownRow
                  label={copy.municipalTax + ' · ' + result.municipalityName}
                  note={municipalNote}
                  amount={result.municipalTax}
                  formatCurrency={preciseCurrency.format}
                />
                {result.totalBenefits > 0 ? (
                  <BreakdownRow
                    label={copy.fiscalBenefits}
                    amount={result.totalBenefits}
                    formatCurrency={preciseCurrency.format}
                    tone="positive"
                  />
                ) : null}
                <BreakdownRow
                  label={copy.estimatedAnnualNet}
                  amount={result.annualNet}
                  formatCurrency={preciseCurrency.format}
                  tone="positive"
                  strong
                />
              </details>

              <aside className="rules-card">
                <h3>{copy.includedRules}</h3>
                <dl>
                  <div>
                    <dt>{copy.baseContributions}</dt>
                    <dd>{copy.baseRate}</dd>
                  </div>
                  <div>
                    <dt>{copy.incomeTax}</dt>
                    <dd>{copy.incomeTaxRates}</dd>
                  </div>
                  <div>
                    <dt>{getRegionName(result.regionKey, language)}</dt>
                    <dd>{getRegionRateLabel(result.regionKey, locale)}</dd>
                  </div>
                  <div>
                    <dt>{result.municipalityName}</dt>
                    <dd>{getMunicipalRateLabel(calculatedMunicipality, locale)}</dd>
                  </div>
                </dl>
                <p>{copy.standardScope}</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="sources-section" id="fonti" aria-labelledby="sources-title">
          <div className="sources-inner page-width">
            <div className="sources-heading">
              <h2 id="sources-title">{copy.methodTitle}</h2>
              <p>{copy.methodIntro}</p>
            </div>
            <div className="source-list">
              {sources.map((source) => (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  key={source.href}
                  aria-label={source.title + '. ' + copy.sourceAria}
                >
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.meta}</small>
                  </span>
                  <ArrowIcon diagonal />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark" href="#top" aria-label={copy.home}>
          <img src={brandMark} alt="" />
          <span>netto.</span>
        </a>
        <p>{copy.disclaimer}</p>
        <span>{copy.footerMeta}</span>
      </footer>
    </div>
  )
}

export default App

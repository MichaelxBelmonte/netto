import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import provinceBoundaries from '../data/italy-provinces-2026.json'
import {
  MUNICIPALITIES,
  calculateMunicipalTax,
  calculateRegionalTax,
  getMunicipality,
  getRegionName,
  type Municipality,
  type RegionKey,
} from '../lib/localTaxes'
import { calculateSalaryProjection } from '../lib/tax'

type Language = 'it' | 'en'

type Position = [number, number]
type PolygonCoordinates = Position[][]
type MultiPolygonCoordinates = Position[][][]

type BoundaryFeature = {
  type: 'Feature'
  properties: {
    r: number
    p: string
    n: string
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: PolygonCoordinates | MultiPolygonCoordinates
  }
}

type BoundaryCollection = {
  type: 'FeatureCollection'
  features: BoundaryFeature[]
}

type TaxEntry = {
  municipality: Municipality
  localTax: number
}

type AreaStat = {
  median: number
}

const COPY = {
  it: {
    eyebrow: 'Mappa interattiva',
    live: 'Segue la RAL',
    title: 'Scegli dalla mappa.',
    description:
      'Il colore mostra la mediana delle addizionali regionali e comunali per la RAL impostata.',
    grossSalary: 'RAL',
    mapAria: 'Mappa interattiva della fiscalità locale italiana',
    mapHint: 'Tocca una provincia o un capoluogo',
    low: 'Meno addizionali',
    high: 'Più addizionali',
    italy: 'Italia',
    nationalMedian: 'Mediana Italia',
    areaMedian: 'Mediana area',
    perYear: 'all’anno',
    records: 'voci fiscali',
    allItaly: 'Tutta Italia',
    activeMunicipality: 'Comune attivo',
    choosePrompt: 'Scegli un’area sulla mappa o cerca direttamente un Comune.',
    searchAll: 'Cerca un Comune in tutta Italia',
    searchArea: 'Cerca in quest’area',
    quickCities: 'Città rapide',
    noResults: 'Nessun Comune trovato in quest’area.',
    localTaxes: 'addizionali',
    selectCity: 'Usa questo Comune',
    source: 'Confini ISTAT 2026 · dati fiscali MEF 2026',
  },
  en: {
    eyebrow: 'Interactive map',
    live: 'Follows the salary',
    title: 'Choose from the map.',
    description:
      'Colour shows the median regional and municipal surtax for the selected gross salary.',
    grossSalary: 'Gross',
    mapAria: 'Interactive map of local taxation in Italy',
    mapHint: 'Tap a province or a major city',
    low: 'Lower surtax',
    high: 'Higher surtax',
    italy: 'Italy',
    nationalMedian: 'Italy median',
    areaMedian: 'Area median',
    perYear: 'per year',
    records: 'tax records',
    allItaly: 'All Italy',
    activeMunicipality: 'Active municipality',
    choosePrompt: 'Choose an area on the map or search for a municipality directly.',
    searchAll: 'Search any Italian municipality',
    searchArea: 'Search within this area',
    quickCities: 'Quick cities',
    noResults: 'No municipality found in this area.',
    localTaxes: 'local surtax',
    selectCity: 'Use this municipality',
    source: 'ISTAT 2026 boundaries · MEF 2026 tax data',
  },
} as const

const ISTAT_BOUNDARIES_URL =
  'https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/'
const MAP_WIDTH = 420
const MAP_HEIGHT = 560
const MAP_PADDING = 14
const MIN_LONGITUDE = 6.6273
const MAX_LONGITUDE = 18.5204
const MIN_LATITUDE = 35.4936
const MAX_LATITUDE = 47.0916
const QUICK_CITY_CODES = ['F205', 'H501', 'F839', 'L219', 'A944', 'D612', 'G273']

const REGION_BY_ISTAT_CODE: Record<number, RegionKey> = {
  1: 'piemonte',
  2: 'valle-aosta',
  3: 'lombardia',
  5: 'veneto',
  6: 'friuli-venezia-giulia',
  7: 'liguria',
  8: 'emilia-romagna',
  9: 'toscana',
  10: 'umbria',
  11: 'marche',
  12: 'lazio',
  13: 'abruzzo',
  14: 'molise',
  15: 'campania',
  16: 'puglia',
  17: 'basilicata',
  18: 'calabria',
  19: 'sicilia',
  20: 'sardegna',
}

const DIRECT_CITY_COORDINATES: Record<string, Position> = {
  F205: [9.19, 45.4642],
  H501: [12.4964, 41.9028],
  F839: [14.2681, 40.8518],
  L219: [7.6869, 45.0703],
  A944: [11.3426, 44.4949],
  D612: [11.2558, 43.7696],
  G273: [13.3614, 38.1157],
}

const boundaries = provinceBoundaries as BoundaryCollection
const collator = new Intl.Collator('it', { sensitivity: 'base' })

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getFeatureRegion(feature: BoundaryFeature): RegionKey {
  if (feature.properties.r === 4) {
    return feature.properties.p === 'BZ' ? 'bolzano' : 'trento'
  }

  const region = REGION_BY_ISTAT_CODE[feature.properties.r]
  if (!region) throw new Error(`Unsupported ISTAT region code: ${feature.properties.r}`)
  return region
}

function getProvinceKey(region: RegionKey, province: string) {
  return region + ':' + province
}

function project([longitude, latitude]: Position): Position {
  const x =
    MAP_PADDING +
    ((longitude - MIN_LONGITUDE) / (MAX_LONGITUDE - MIN_LONGITUDE)) *
      (MAP_WIDTH - MAP_PADDING * 2)
  const y =
    MAP_PADDING +
    ((MAX_LATITUDE - latitude) / (MAX_LATITUDE - MIN_LATITUDE)) *
      (MAP_HEIGHT - MAP_PADDING * 2)

  return [x, y]
}

function ringToPath(ring: Position[]) {
  return ring
    .map((point, index) => {
      const [x, y] = project(point)
      return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
    })
    .join(' ') + ' Z'
}

function geometryToPath(feature: BoundaryFeature) {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as PolygonCoordinates]
      : (feature.geometry.coordinates as MultiPolygonCoordinates)

  return polygons.flatMap((polygon) => polygon.map(ringToPath)).join(' ')
}

const MAP_FEATURES = boundaries.features.map((feature, index) => ({
  id: feature.properties.p + '-' + index,
  province: feature.properties.p,
  provinceName: feature.properties.n,
  region: getFeatureRegion(feature),
  path: geometryToPath(feature),
}))

const QUICK_CITIES = QUICK_CITY_CODES.map((code) => getMunicipality(code))

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function getTaxColor(value: number, minimum: number, maximum: number) {
  const ratio = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5
  const eased = 0.12 + Math.min(1, Math.max(0, ratio)) * 0.88
  const start = [255, 253, 248]
  const end = [255, 91, 31]
  const channels = start.map((channel, index) =>
    Math.round(channel + ((end[index] ?? channel) - channel) * eased),
  )

  return `rgb(${channels.join(', ')})`
}

export function TaxMap({
  grossSalary,
  selectedMunicipality,
  language,
  formatCurrency,
  formatNumber,
  onSelectMunicipality,
}: {
  grossSalary: number
  selectedMunicipality: Municipality | null
  language: Language
  formatCurrency: (value: number) => string
  formatNumber: (value: number) => string
  onSelectMunicipality: (municipality: Municipality) => void
}) {
  const copy = COPY[language]
  const [activeRegion, setActiveRegion] = useState<RegionKey | null>(null)
  const [activeProvince, setActiveProvince] = useState<string | null>(null)
  const [activeProvinceName, setActiveProvinceName] = useState<string | null>(null)
  const [hoveredArea, setHoveredArea] = useState<{
    region: RegionKey
    province: string
    provinceName: string
  } | null>(null)
  const [query, setQuery] = useState('')

  const analysis = useMemo(() => {
    const reference = calculateSalaryProjection(grossSalary, 13, getMunicipality('F205'))
    const regionalTaxByKey = new Map<RegionKey, number>()
    const groupedRegionValues = new Map<RegionKey, number[]>()
    const groupedProvinceValues = new Map<string, number[]>()
    const entries: TaxEntry[] = MUNICIPALITIES.map((municipality) => {
      let regionalTax = regionalTaxByKey.get(municipality.g)

      if (regionalTax === undefined) {
        regionalTax =
          reference.netIrpef > 0
            ? calculateRegionalTax(reference.taxableIncome, municipality.g).total
            : 0
        regionalTaxByKey.set(municipality.g, regionalTax)
      }

      const municipalTax =
        reference.netIrpef > 0
          ? calculateMunicipalTax(reference.taxableIncome, municipality).total
          : 0
      const localTax = Math.round((regionalTax + municipalTax) * 100) / 100
      const regionValues = groupedRegionValues.get(municipality.g) ?? []
      const provinceKey = getProvinceKey(municipality.g, municipality.p)
      const provinceValues = groupedProvinceValues.get(provinceKey) ?? []
      regionValues.push(localTax)
      provinceValues.push(localTax)
      groupedRegionValues.set(municipality.g, regionValues)
      groupedProvinceValues.set(provinceKey, provinceValues)

      return {
        municipality,
        localTax,
      }
    })
    const regionStats = new Map<RegionKey, AreaStat>()
    const provinceStats = new Map<string, AreaStat>()

    for (const [region, values] of groupedRegionValues) {
      regionStats.set(region, { median: median(values) })
    }

    for (const [province, values] of groupedProvinceValues) {
      provinceStats.set(province, { median: median(values) })
    }

    const mapMedians = MAP_FEATURES.map(
      (feature) =>
        provinceStats.get(getProvinceKey(feature.region, feature.province))?.median ??
        regionStats.get(feature.region)?.median,
    ).filter((value): value is number => value !== undefined)
    const allValues = entries.map((entry) => entry.localTax)

    return {
      entries,
      regionStats,
      provinceStats,
      nationalMedian: median(allValues),
      minimumMapMedian: Math.min(...mapMedians),
      maximumMapMedian: Math.max(...mapMedians),
    }
  }, [grossSalary])

  useEffect(() => {
    if (!selectedMunicipality) return
    setActiveRegion(selectedMunicipality.g)
    setActiveProvince(selectedMunicipality.p)
    setActiveProvinceName(
      MAP_FEATURES.find((feature) => feature.province === selectedMunicipality.p)
        ?.provinceName ?? null,
    )
  }, [selectedMunicipality])

  const selectedEntry = useMemo(
    () =>
      selectedMunicipality
        ? analysis.entries.find(
            (entry) => entry.municipality.c === selectedMunicipality.c,
          ) ?? null
        : null,
    [analysis.entries, selectedMunicipality],
  )

  const scopeEntries = useMemo(() => {
    if (!activeRegion) return analysis.entries

    const regionEntries = analysis.entries.filter(
      (entry) => entry.municipality.g === activeRegion,
    )
    if (!activeProvince) return regionEntries

    const provinceEntries = regionEntries.filter(
      (entry) => entry.municipality.p === activeProvince,
    )
    return provinceEntries.length ? provinceEntries : regionEntries
  }, [activeProvince, activeRegion, analysis.entries])

  const visibleEntries = useMemo(() => {
    const normalizedQuery = normalize(query)

    if (!normalizedQuery && !activeRegion) {
      return QUICK_CITIES.map((municipality) =>
        analysis.entries.find((entry) => entry.municipality.c === municipality.c),
      ).filter((entry): entry is TaxEntry => Boolean(entry))
    }

    const filtered = normalizedQuery
      ? scopeEntries.filter((entry) => {
          const searchable = normalize(
            entry.municipality.n + ' ' + entry.municipality.p,
          )
          return searchable.includes(normalizedQuery)
        })
      : scopeEntries

    return [...filtered]
      .sort((first, second) => {
        if (first.municipality.c === selectedMunicipality?.c) return -1
        if (second.municipality.c === selectedMunicipality?.c) return 1
        if (activeProvinceName) {
          const firstIsCapital = normalize(first.municipality.n) === normalize(activeProvinceName)
          const secondIsCapital = normalize(second.municipality.n) === normalize(activeProvinceName)
          if (firstIsCapital !== secondIsCapital) return firstIsCapital ? -1 : 1
        }
        return collator.compare(first.municipality.n, second.municipality.n)
      })
      .slice(0, 7)
  }, [activeProvinceName, activeRegion, analysis.entries, query, scopeEntries, selectedMunicipality])

  const activeStat = activeRegion
    ? (activeProvince
        ? analysis.provinceStats.get(getProvinceKey(activeRegion, activeProvince))
        : undefined) ?? analysis.regionStats.get(activeRegion)
    : undefined
  const previewStat = hoveredArea
    ? analysis.provinceStats.get(getProvinceKey(hoveredArea.region, hoveredArea.province)) ??
      analysis.regionStats.get(hoveredArea.region)
    : activeStat
  const previewName = hoveredArea
    ? hoveredArea.provinceName + ' · ' + getRegionName(hoveredArea.region, language)
    : activeProvinceName
      ? activeProvinceName + ' · ' + getRegionName(activeRegion ?? 'lombardia', language)
      : activeRegion
        ? getRegionName(activeRegion, language)
        : copy.italy
  const listTitle = activeRegion
    ? activeProvinceName || getRegionName(activeRegion, language)
    : copy.quickCities

  function activateArea(region: RegionKey, province: string, provinceName: string) {
    const hasMatchingProvince = MUNICIPALITIES.some(
      (municipality) => municipality.g === region && municipality.p === province,
    )
    setActiveRegion(region)
    setActiveProvince(hasMatchingProvince ? province : null)
    setActiveProvinceName(hasMatchingProvince ? provinceName : null)
    setQuery('')
  }

  function resetArea() {
    setActiveRegion(null)
    setActiveProvince(null)
    setActiveProvinceName(null)
    setHoveredArea(null)
    setQuery('')
  }

  function selectMunicipality(municipality: Municipality) {
    setActiveRegion(municipality.g)
    setActiveProvince(municipality.p)
    setActiveProvinceName(
      MAP_FEATURES.find((feature) => feature.province === municipality.p)?.provinceName ?? null,
    )
    setQuery('')
    onSelectMunicipality(municipality)
  }

  return (
    <article className="tax-map-card">
      <header className="tax-map-header">
        <div>
          <div className="tax-map-eyebrow">
            <span>{copy.eyebrow}</span>
            <strong>{copy.live}</strong>
          </div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <span className="tax-map-gross">
          {copy.grossSalary} <strong>{formatCurrency(grossSalary)}</strong>
        </span>
      </header>

      <div className="tax-map-workspace">
        <div className="tax-map-visual">
          <div className="tax-map-status">
            <span>{previewName}</span>
            <strong>
              {formatCurrency(previewStat?.median ?? analysis.nationalMedian)}
              <small> {copy.perYear}</small>
            </strong>
          </div>

          <svg
            className="italy-tax-map"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="group"
            aria-label={copy.mapAria}
          >
            {/* Le 110 aree sono un arricchimento per mouse e touch: il percorso accessibile da tastiera e screen reader è la ricerca nel pannello. */}
            <g aria-hidden="true">
              {MAP_FEATURES.map((feature) => {
                const stat =
                  analysis.provinceStats.get(
                    getProvinceKey(feature.region, feature.province),
                  ) ?? analysis.regionStats.get(feature.region)
                const isActive =
                  activeRegion === feature.region &&
                  (!activeProvince || activeProvince === feature.province)
                const label =
                  feature.provinceName +
                  ', ' +
                  getRegionName(feature.region, language) +
                  ': ' +
                  formatCurrency(stat?.median ?? 0) +
                  ' ' +
                  copy.perYear

                return (
                  <path
                    d={feature.path}
                    key={feature.id}
                    className={isActive ? 'tax-map-shape is-active' : 'tax-map-shape'}
                    style={
                      {
                        '--map-fill': getTaxColor(
                          stat?.median ?? 0,
                          analysis.minimumMapMedian,
                          analysis.maximumMapMedian,
                        ),
                      } as CSSProperties
                    }
                    onMouseEnter={() =>
                      setHoveredArea({
                        region: feature.region,
                        province: feature.province,
                        provinceName: feature.provinceName,
                      })
                    }
                    onMouseLeave={() => setHoveredArea(null)}
                    onClick={() =>
                      activateArea(feature.region, feature.province, feature.provinceName)
                    }
                  >
                    <title>{label}</title>
                  </path>
                )
              })}
            </g>

            {QUICK_CITIES.map((municipality) => {
              const coordinates = DIRECT_CITY_COORDINATES[municipality.c]
              if (!coordinates) return null
              const [x, y] = project(coordinates)
              const isSelected = municipality.c === selectedMunicipality?.c

              return (
                <g
                  className={isSelected ? 'tax-map-city is-selected' : 'tax-map-city'}
                  key={municipality.c}
                  role="button"
                  tabIndex={0}
                  aria-label={copy.selectCity + ': ' + municipality.n}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                  onClick={() => selectMunicipality(municipality)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectMunicipality(municipality)
                    }
                  }}
                >
                  <circle className="tax-map-city__hit" r="16" />
                  <circle className="tax-map-city__dot" r="6" />
                  <text x="9" y="4">{municipality.p}</text>
                </g>
              )
            })}
          </svg>

          <p className="tax-map-hint">{copy.mapHint}</p>
          <div className="tax-map-legend" aria-hidden="true">
            <span>{copy.low}</span>
            <i />
            <span>{copy.high}</span>
          </div>
        </div>

        <div className="tax-map-panel">
          <div className="tax-map-panel__topline">
            <button type="button" className={!activeRegion ? 'is-active' : ''} onClick={resetArea}>
              {copy.allItaly}
            </button>
            <span>{formatNumber(scopeEntries.length)} {copy.records}</span>
          </div>

          <dl className="tax-map-metrics">
            <div>
              <dt>{copy.nationalMedian}</dt>
              <dd>{formatCurrency(analysis.nationalMedian)}</dd>
              <small>{copy.perYear}</small>
            </div>
            <div>
              <dt>{selectedEntry ? copy.activeMunicipality : copy.areaMedian}</dt>
              <dd>
                {formatCurrency(
                  selectedEntry?.localTax ?? activeStat?.median ?? analysis.nationalMedian,
                )}
              </dd>
              <small>
                {selectedEntry?.municipality.n ??
                  (activeRegion ? getRegionName(activeRegion, language) : copy.italy)}
              </small>
            </div>
          </dl>

          {!selectedEntry && !activeRegion ? (
            <p className="tax-map-prompt">{copy.choosePrompt}</p>
          ) : null}

          <label className="tax-map-search">
            <span className="sr-only">{activeRegion ? copy.searchArea : copy.searchAll}</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.25" />
              <path d="m12.5 12.5 4 4" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder={activeRegion ? copy.searchArea : copy.searchAll}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="tax-map-list-heading">
            <strong>{listTitle}</strong>
            {activeRegion ? <span>{formatNumber(scopeEntries.length)} {copy.records}</span> : null}
          </div>

          <div className="tax-map-city-list">
            {visibleEntries.length ? (
              visibleEntries.map((entry) => {
                const isSelected = entry.municipality.c === selectedMunicipality?.c

                return (
                  <button
                    type="button"
                    className={isSelected ? 'is-selected' : ''}
                    key={entry.municipality.c}
                    aria-label={copy.selectCity + ': ' + entry.municipality.n}
                    onClick={() => selectMunicipality(entry.municipality)}
                  >
                    <span>
                      <strong>{entry.municipality.n}</strong>
                      <small>
                        {entry.municipality.p} · {getRegionName(entry.municipality.g, language)}
                      </small>
                    </span>
                    <span>
                      <strong>{formatCurrency(entry.localTax)}</strong>
                      <small>{copy.localTaxes} · {copy.perYear}</small>
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="tax-map-no-results">{copy.noResults}</p>
            )}
          </div>

          <a className="tax-map-source" href={ISTAT_BOUNDARIES_URL} target="_blank" rel="noreferrer">
            {copy.source}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  )
}

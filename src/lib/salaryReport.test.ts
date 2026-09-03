import { describe, expect, it } from 'vitest'
import { calculateEmployerCost } from './employerCost'
import { getMunicipality, getMunicipalitySourceUrl, getRegionName } from './localTaxes'
import { buildSalaryReport, renderSalaryReport } from './salaryReport'
import { calculateSalaryProjection } from './tax'

describe('salary PDF model', () => {
  const milan = getMunicipality('F205')
  const sourceUrl = getMunicipalitySourceUrl(milan)
  const result = calculateSalaryProjection(35_000, 13, milan)

  it('builds the complete reconciliation with a safe filename', () => {
    const report = buildSalaryReport({
      result,
      language: 'it',
      regionName: getRegionName(result.regionKey, 'it'),
      sourceUrl,
      generatedAt: new Date('2026-09-03T12:00:00Z'),
    })

    expect(report.filename).toBe('netto-35000-milano.pdf')
    expect(report.subtitle).toContain('Milano (MI)')
    expect(report.generatedLabel).toContain('03/09/2026')
    expect(report.primary).toHaveLength(2)
    expect(report.composition.segments).toHaveLength(3)
    expect(report.breakdown.rows.map((row) => row.label)).toEqual([
      'Retribuzione lorda',
      'Contributi INPS dipendente',
      'Imponibile fiscale',
      'IRPEF lorda',
      'Detrazioni IRPEF',
      'IRPEF netta',
      'Addizionale regionale',
      'Addizionale comunale',
      'Netto annuale',
    ])
    expect(report.sourceUrl).toBe(sourceUrl)
    expect(report.comparison).toBeUndefined()
  })

  it('adds salary, municipality and employer comparisons', () => {
    const comparison = calculateSalaryProjection(40_000, 13, milan)
    const rome = calculateSalaryProjection(35_000, 13, getMunicipality('H501'))
    const report = buildSalaryReport({
      result,
      comparison,
      cityComparisons: [result, rome],
      employerCost: calculateEmployerCost(35_000),
      language: 'en',
      regionName: getRegionName(result.regionKey, 'en'),
      sourceUrl,
    })

    expect(report.comparison?.rows).toHaveLength(3)
    expect(report.comparison?.deltaLabel).toBe('Annual net difference')
    expect(report.comparison?.deltaValue).toMatch(/^\+/)
    expect(report.municipalities?.rows).toHaveLength(2)
    expect(report.municipalities?.rows[0]?.selected).toBe(true)
    expect(report.municipalities?.rows[1]?.delta).toContain('vs selected')
    expect(report.employer?.rows).toHaveLength(5)
    expect(report.employer?.chart).toHaveLength(3)
    expect(
      report.employer?.chart.reduce((total, segment) => total + segment.share, 0),
    ).toBeCloseTo(1, 8)
  })

  it('renders a valid PDF document', async () => {
    const report = buildSalaryReport({
      result,
      language: 'it',
      regionName: getRegionName(result.regionKey, 'it'),
      sourceUrl,
      generatedAt: new Date('2026-09-03T12:00:00Z'),
    })
    const pdf = await renderSalaryReport(report)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(3_000)
  })

  it('renders the complete report on two pages', async () => {
    const report = buildSalaryReport({
      result,
      comparison: calculateSalaryProjection(40_000, 13, milan),
      cityComparisons: [
        result,
        calculateSalaryProjection(35_000, 13, getMunicipality('H501')),
      ],
      employerCost: calculateEmployerCost(35_000),
      language: 'it',
      regionName: getRegionName(result.regionKey, 'it'),
      sourceUrl,
    })
    const pdf = await renderSalaryReport(report)

    expect(pdf.getNumberOfPages()).toBe(2)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(8_000)
  })
})

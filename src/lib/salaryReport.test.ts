import { describe, expect, it } from 'vitest'
import { getMunicipality, getMunicipalitySourceUrl, getRegionName } from './localTaxes'
import { buildSalaryReport, renderSalaryReport } from './salaryReport'
import { calculateSalaryProjection } from './tax'

describe('salary PDF model', () => {
  const milan = getMunicipality('F205')
  const sourceUrl = getMunicipalitySourceUrl(milan)
  const result = calculateSalaryProjection(35_000, 13, milan)

  it('builds a compact one-page summary with a safe filename', () => {
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
    expect(report.rows.length).toBeLessThanOrEqual(4)
    expect(report.sourceUrl).toBe(sourceUrl)
    expect(report.comparison).toBeUndefined()
  })

  it('adds only the essential comparison figures', () => {
    const comparison = calculateSalaryProjection(40_000, 13, milan)
    const report = buildSalaryReport({
      result,
      comparison,
      language: 'en',
      regionName: getRegionName(result.regionKey, 'en'),
      sourceUrl,
    })

    expect(report.comparison?.rows).toHaveLength(2)
    expect(report.comparison?.deltaLabel).toBe('Annual net difference')
    expect(report.comparison?.deltaValue).toMatch(/^\+/)
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
})

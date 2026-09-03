import type { EmployerCostResult } from './employerCost'
import type { SalaryProjection } from './tax'

export type ReportLanguage = 'it' | 'en'

type ReportRow = { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }
type ChartSegment = { label: string; value: string; share: number; color: 'orange' | 'ink' | 'grey' }

export type SalaryReportModel = {
  filename: string
  title: string
  subtitle: string
  generatedLabel: string
  primary: Array<{ label: string; value: string }>
  composition: { title: string; segments: ChartSegment[] }
  breakdown: { title: string; rows: ReportRow[] }
  comparison?: {
    title: string
    currentLabel: string
    alternativeLabel: string
    rows: Array<{ label: string; current: string; alternative: string }>
    deltaLabel: string
    deltaValue: string
    retainedLabel?: string
    retainedValue?: string
  }
  municipalities?: {
    title: string
    subtitle: string
    rows: Array<{ label: string; value: string; delta: string; selected: boolean }>
  }
  employer?: {
    title: string
    profile: string
    totalLabel: string
    totalValue: string
    rows: ReportRow[]
    chart: ChartSegment[]
    note: string
  }
  note: string
  sourceLabel: string
  sourceUrl: string
  pageTwoTitle: string
  pageLabel: string
}

type BuildSalaryReportOptions = {
  result: SalaryProjection
  comparison?: SalaryProjection
  cityComparisons?: SalaryProjection[]
  employerCost?: EmployerCostResult
  language: ReportLanguage
  regionName: string
  sourceUrl: string
  generatedAt?: Date
}

const REPORT_COPY = {
  it: {
    estimate: 'Stima', generated: 'Generato il', monthlyNet: 'Netto per mensilità',
    annualNet: 'Netto annuale', gross: 'Retribuzione lorda',
    contributions: 'Contributi INPS dipendente', taxable: 'Imponibile fiscale',
    grossIrpef: 'IRPEF lorda', taxDeductions: 'Detrazioni IRPEF', netIrpef: 'IRPEF netta',
    regionalTax: 'Addizionale regionale', municipalTax: 'Addizionale comunale',
    benefits: 'Bonus fiscali in busta', composition: 'Composizione della RAL', taxes: 'Imposte',
    netBeforeBenefits: 'Netto dalla RAL', breakdown: 'Riconciliazione annuale',
    comparison: 'Confronto RAL', payPeriods: 'mensilità', perPayPeriod: 'Per mensilità',
    current: 'Attuale', alternative: 'Alternativa', netDifference: 'Differenza netta annuale',
    retained: 'della differenza lorda resta netta', municipalities: 'Confronto Comuni',
    municipalitiesSubtitle: 'Stessa RAL e stesse mensilità', selected: 'selezionato',
    versusSelected: 'vs selezionato', employer: 'Dal costo azienda al netto',
    employerCost: 'Costo azienda totale', employerContributions: 'Contributi INPS azienda',
    insurance: 'Assicurazione INAIL', severance: 'TFR accantonato',
    contractual: 'Oneri contrattuali', employeeWedge: 'Trattenute dipendente',
    employerCharges: 'Oneri azienda', commerce: 'Commercio e terziario', industry: 'Industria',
    upTo5: 'fino a 5 dipendenti', from6to15: 'da 6 a 15 dipendenti',
    over15: 'oltre 15 dipendenti',
    employerNote: 'Costo aziendale indicativo: alcune aliquote sono ricostruite e possono variare per CCNL, mansione e tariffa INAIL.',
    note: 'Stima per dipendente privato a tempo indeterminato, senza familiari a carico o altri redditi.',
    source: 'Fonte comunale MEF', pageTwo: 'Confronti e costo aziendale', page: 'Pagina',
  },
  en: {
    estimate: 'Estimate', generated: 'Generated on', monthlyNet: 'Net per pay period',
    annualNet: 'Annual net', gross: 'Gross annual salary',
    contributions: 'Employee INPS contributions', taxable: 'Taxable income',
    grossIrpef: 'Gross income tax', taxDeductions: 'Income tax deductions',
    netIrpef: 'Net income tax', regionalTax: 'Regional surtax', municipalTax: 'Municipal surtax',
    benefits: 'Payslip tax bonuses', composition: 'Gross salary composition', taxes: 'Taxes',
    netBeforeBenefits: 'Net from gross salary', breakdown: 'Annual reconciliation',
    comparison: 'Salary comparison', payPeriods: 'pay periods', perPayPeriod: 'Per pay period',
    current: 'Current', alternative: 'Alternative', netDifference: 'Annual net difference',
    retained: 'of the gross difference stays net', municipalities: 'Municipality comparison',
    municipalitiesSubtitle: 'Same salary and pay periods', selected: 'selected',
    versusSelected: 'vs selected', employer: 'From employer cost to take-home pay',
    employerCost: 'Total employer cost', employerContributions: 'Employer INPS contributions',
    insurance: 'INAIL insurance', severance: 'Accrued severance pay',
    contractual: 'Contractual costs', employeeWedge: 'Employee deductions',
    employerCharges: 'Employer charges', commerce: 'Retail and services', industry: 'Manufacturing',
    upTo5: 'up to 5 employees', from6to15: '6 to 15 employees', over15: 'over 15 employees',
    employerNote: 'Indicative employer cost: some rates are reconstructed and may vary by contract, role and INAIL tariff.',
    note: 'Estimate for a permanent private employee with no dependants or other income.',
    source: 'MEF municipal source', pageTwo: 'Comparisons and employer cost', page: 'Page',
  },
} as const

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function buildSalaryReport({
  result, comparison, cityComparisons, employerCost, language, regionName, sourceUrl,
  generatedAt = new Date(),
}: BuildSalaryReportOptions): SalaryReportModel {
  const copy = REPORT_COPY[language]
  const locale = language === 'it' ? 'it-IT' : 'en-IE'
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  // I font PDF standard non includono il segno meno Unicode: usiamo il trattino ASCII.
  const signedCurrency = (value: number) => (value >= 0 ? '+' : '-') + currency.format(Math.abs(value))
  const taxDeductions = result.employmentDeduction + result.additionalEmploymentDeduction
  const netBeforeBenefits = Math.max(0, result.grossAnnualSalary - result.employeeContributions - result.totalTaxes)
  const grossDelta = comparison ? comparison.grossAnnualSalary - result.grossAnnualSalary : 0
  const netDelta = comparison ? comparison.annualNet - result.annualNet : 0
  const retainedShare = grossDelta === 0 ? null : netDelta / grossDelta
  const employerCharges = employerCost ? employerCost.totalCost - employerCost.grossAnnualSalary : 0
  const employeeWedge = Math.max(0, result.grossAnnualSalary - result.annualNet)
  const employerChartTotal = employerCost?.totalCost ?? 1

  return {
    filename: `netto-${Math.round(result.grossAnnualSalary)}-${slugify(result.municipalityName)}.pdf`,
    title: `netto. · ${copy.estimate} ${generatedAt.getFullYear()}`,
    subtitle: `${result.municipalityName} (${result.municipalityProvince}) · ${regionName} · ${result.payPeriods} ${copy.payPeriods}`,
    generatedLabel: `${copy.generated} ${new Intl.DateTimeFormat(locale).format(generatedAt)}`,
    primary: [
      { label: copy.monthlyNet, value: currency.format(result.netPerPayPeriod) },
      { label: copy.annualNet, value: currency.format(result.annualNet) },
    ],
    composition: {
      title: copy.composition,
      segments: [
        { label: copy.netBeforeBenefits, value: currency.format(netBeforeBenefits), share: netBeforeBenefits / result.grossAnnualSalary, color: 'orange' },
        { label: copy.taxes, value: currency.format(result.totalTaxes), share: result.totalTaxes / result.grossAnnualSalary, color: 'ink' },
        { label: copy.contributions, value: currency.format(result.employeeContributions), share: result.employeeContributions / result.grossAnnualSalary, color: 'grey' },
      ],
    },
    breakdown: {
      title: copy.breakdown,
      rows: [
        { label: copy.gross, value: currency.format(result.grossAnnualSalary), tone: 'neutral' },
        { label: copy.contributions, value: `-${currency.format(result.employeeContributions)}`, tone: 'negative' },
        { label: copy.taxable, value: currency.format(result.taxableIncome), tone: 'neutral' },
        { label: copy.grossIrpef, value: `-${currency.format(result.grossIrpef)}`, tone: 'negative' },
        { label: copy.taxDeductions, value: `+${currency.format(taxDeductions)}`, tone: 'positive' },
        { label: copy.netIrpef, value: `-${currency.format(result.netIrpef)}`, tone: 'negative' },
        { label: copy.regionalTax, value: `-${currency.format(result.regionalTax)}`, tone: 'negative' },
        { label: copy.municipalTax, value: `-${currency.format(result.municipalTax)}`, tone: 'negative' },
        ...(result.totalBenefits > 0 ? [{ label: copy.benefits, value: `+${currency.format(result.totalBenefits)}`, tone: 'positive' as const }] : []),
        { label: copy.annualNet, value: currency.format(result.annualNet), tone: 'neutral' },
      ],
    },
    comparison: comparison ? {
      title: copy.comparison, currentLabel: copy.current, alternativeLabel: copy.alternative,
      rows: [
        { label: copy.gross, current: currency.format(result.grossAnnualSalary), alternative: currency.format(comparison.grossAnnualSalary) },
        { label: copy.annualNet, current: currency.format(result.annualNet), alternative: currency.format(comparison.annualNet) },
        { label: copy.perPayPeriod, current: currency.format(result.netPerPayPeriod), alternative: currency.format(comparison.netPerPayPeriod) },
      ],
      deltaLabel: copy.netDifference, deltaValue: signedCurrency(netDelta),
      retainedLabel: retainedShare === null ? undefined : copy.retained,
      retainedValue: retainedShare === null ? undefined : percent.format(retainedShare),
    } : undefined,
    municipalities: cityComparisons?.length ? {
      title: copy.municipalities, subtitle: copy.municipalitiesSubtitle,
      rows: cityComparisons.map((projection) => {
        const selected = projection.municipalityCode === result.municipalityCode
        return {
          label: `${projection.municipalityName} (${projection.municipalityProvince})`,
          value: currency.format(projection.annualNet),
          delta: selected ? copy.selected : `${signedCurrency(projection.annualNet - result.annualNet)} ${copy.versusSelected}`,
          selected,
        }
      }),
    } : undefined,
    employer: employerCost ? {
      title: copy.employer, profile: `${copy[employerCost.sector]} · ${copy[employerCost.size]}`,
      totalLabel: copy.employerCost, totalValue: currency.format(employerCost.totalCost),
      rows: [
        { label: copy.gross, value: currency.format(employerCost.grossAnnualSalary) },
        { label: copy.employerContributions, value: `+${currency.format(employerCost.inpsTotal)}` },
        { label: copy.insurance, value: `+${currency.format(employerCost.insuranceItem.amount)}` },
        { label: copy.severance, value: `+${currency.format(employerCost.severanceItem.amount)}` },
        ...(employerCost.contractualTotal > 0 ? [{ label: copy.contractual, value: `+${currency.format(employerCost.contractualTotal)}` }] : []),
      ],
      chart: [
        { label: copy.annualNet, value: currency.format(result.annualNet), share: result.annualNet / employerChartTotal, color: 'orange' },
        { label: copy.employeeWedge, value: currency.format(employeeWedge), share: employeeWedge / employerChartTotal, color: 'ink' },
        { label: copy.employerCharges, value: currency.format(employerCharges), share: employerCharges / employerChartTotal, color: 'grey' },
      ],
      note: copy.employerNote,
    } : undefined,
    note: copy.note, sourceLabel: copy.source, sourceUrl,
    pageTwoTitle: copy.pageTwo, pageLabel: copy.page,
  }
}

const COLORS = {
  orange: [255, 79, 24] as const, ink: [18, 18, 18] as const,
  grey: [151, 149, 143] as const, paper: [245, 243, 235] as const,
  line: [210, 207, 199] as const, muted: [100, 100, 96] as const,
}

/** Compone il documento solo su richiesta, mantenendo jsPDF fuori dal bundle iniziale. */
export async function renderSalaryReport(model: SalaryReportModel) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  const setFill = (color: readonly [number, number, number]) => pdf.setFillColor(...color)
  const setText = (color: readonly [number, number, number]) => pdf.setTextColor(...color)
  const sectionTitle = (title: string, y: number) => {
    setText(COLORS.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(title, margin, y)
  }
  const drawTopRule = () => { setFill(COLORS.orange); pdf.rect(0, 0, pageWidth, 9, 'F') }
  const drawChart = (segments: ChartSegment[], y: number) => {
    let x = margin
    segments.forEach((segment, index) => {
      const width = index === segments.length - 1 ? pageWidth - margin - x : contentWidth * Math.max(0, segment.share)
      setFill(COLORS[segment.color]); pdf.rect(x, y, Math.max(0, width), 11, 'F'); x += width
    })
    let legendX = margin
    segments.forEach((segment) => {
      setFill(COLORS[segment.color]); pdf.rect(legendX, y + 16, 3, 3, 'F')
      setText(COLORS.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
      const legend = `${segment.label} · ${segment.value}`
      pdf.text(legend, legendX + 5, y + 18.7)
      legendX += Math.min(62, pdf.getTextWidth(legend) + 12)
    })
  }

  drawTopRule()
  setText(COLORS.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(23); pdf.text(model.title, margin, 25)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.text(model.subtitle, margin, 33)
  setText(COLORS.muted); pdf.setFontSize(8); pdf.text(model.generatedLabel, pageWidth - margin, 33, { align: 'right' })
  model.primary.forEach((item, index) => {
    const boxWidth = contentWidth / 2 - 2
    const x = margin + index * (contentWidth / 2 + 2)
    setFill(index === 0 ? COLORS.ink : COLORS.paper); pdf.rect(x, 43, boxWidth, 27, 'F')
    setText(index === 0 ? [255, 255, 255] : COLORS.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(item.label, x + 5, 52)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.text(item.value, x + 5, 64)
  })
  sectionTitle(model.composition.title, 84); drawChart(model.composition.segments, 91)
  sectionTitle(model.breakdown.title, 126)
  let y = 137
  model.breakdown.rows.forEach((row, index) => {
    const isLast = index === model.breakdown.rows.length - 1
    if (isLast) { setFill(COLORS.ink); pdf.rect(margin, y - 5.5, contentWidth, 11, 'F'); setText([255, 255, 255]) }
    else setText(COLORS.ink)
    pdf.setFont('helvetica', isLast ? 'bold' : 'normal'); pdf.setFontSize(8.5)
    pdf.text(row.label, margin + (isLast ? 4 : 0), y + (isLast ? 0.5 : 0))
    if (!isLast) setText(row.tone === 'positive' ? COLORS.orange : COLORS.ink)
    pdf.setFont('helvetica', 'bold'); pdf.text(row.value, pageWidth - margin - (isLast ? 4 : 0), y + (isLast ? 0.5 : 0), { align: 'right' })
    if (!isLast) { pdf.setDrawColor(...COLORS.line); pdf.line(margin, y + 3.5, pageWidth - margin, y + 3.5) }
    y += 10.5
  })
  setText(COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text(pdf.splitTextToSize(model.note, contentWidth), margin, 258)
  setText(COLORS.ink); pdf.textWithLink(model.sourceLabel, margin, 272, { url: model.sourceUrl })

  if (model.comparison || model.municipalities || model.employer) {
    pdf.addPage(); drawTopRule(); setText(COLORS.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.text(model.pageTwoTitle, margin, 25)
    if (model.comparison) {
      sectionTitle(model.comparison.title, 43)
      setText(COLORS.muted); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5)
      pdf.text(model.comparison.currentLabel.toUpperCase(), 129, 43, { align: 'right' })
      pdf.text(model.comparison.alternativeLabel.toUpperCase(), pageWidth - margin, 43, { align: 'right' })
      let comparisonY = 53
      model.comparison.rows.forEach((row) => {
        setText(COLORS.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.text(row.label, margin, comparisonY)
        pdf.text(row.current, 129, comparisonY, { align: 'right' }); pdf.setFont('helvetica', 'bold'); pdf.text(row.alternative, pageWidth - margin, comparisonY, { align: 'right' }); comparisonY += 9
      })
      setFill(COLORS.orange); pdf.rect(margin, 78, contentWidth, 16, 'F'); setText(COLORS.ink)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(model.comparison.deltaLabel, margin + 5, 88); pdf.text(model.comparison.deltaValue, 130, 88, { align: 'right' })
      if (model.comparison.retainedValue && model.comparison.retainedLabel) {
        pdf.text(model.comparison.retainedValue, 146, 88); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(model.comparison.retainedLabel, 159, 88)
      }
    }
    if (model.municipalities) {
      sectionTitle(model.municipalities.title, 111); setText(COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
      pdf.text(model.municipalities.subtitle, pageWidth - margin, 111, { align: 'right' })
      let cityY = 122
      model.municipalities.rows.forEach((row) => {
        if (row.selected) { setFill(COLORS.paper); pdf.rect(margin, cityY - 5.5, contentWidth, 10, 'F') }
        setText(COLORS.ink); pdf.setFont('helvetica', row.selected ? 'bold' : 'normal'); pdf.setFontSize(8.5); pdf.text(row.label, margin + 3, cityY)
        pdf.setFont('helvetica', 'bold'); pdf.text(row.value, 141, cityY, { align: 'right' })
        setText(row.selected ? COLORS.orange : COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(row.delta, pageWidth - margin - 3, cityY, { align: 'right' }); cityY += 10
      })
    }
    if (model.employer) {
      sectionTitle(model.employer.title, 183); setText(COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(model.employer.profile, margin, 191)
      setText(COLORS.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(model.employer.totalLabel, pageWidth - margin, 185, { align: 'right' })
      pdf.setFontSize(17); pdf.text(model.employer.totalValue, pageWidth - margin, 194, { align: 'right' }); drawChart(model.employer.chart, 202)
      let employerY = 233
      model.employer.rows.forEach((row) => {
        setText(COLORS.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(row.label, margin, employerY)
        pdf.setFont('helvetica', 'bold'); pdf.text(row.value, pageWidth - margin, employerY, { align: 'right' }); employerY += 8
      })
      setText(COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
      pdf.text(pdf.splitTextToSize(model.employer.note, contentWidth), margin, 278)
    }
  }
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page); setText(COLORS.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
    pdf.text(`${model.pageLabel} ${page} / ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }
  return pdf
}

export async function downloadSalaryReport(model: SalaryReportModel) {
  const pdf = await renderSalaryReport(model)
  pdf.save(model.filename)
}

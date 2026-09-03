import type { SalaryProjection } from './tax'

export type ReportLanguage = 'it' | 'en'

export type SalaryReportModel = {
  filename: string
  title: string
  subtitle: string
  generatedLabel: string
  primary: Array<{ label: string; value: string }>
  rows: Array<{ label: string; value: string }>
  comparison?: {
    title: string
    rows: Array<{ label: string; current: string; alternative: string }>
    deltaLabel: string
    deltaValue: string
  }
  note: string
  sourceLabel: string
  sourceUrl: string
}

type BuildSalaryReportOptions = {
  result: SalaryProjection
  comparison?: SalaryProjection
  language: ReportLanguage
  regionName: string
  sourceUrl: string
  generatedAt?: Date
}

const REPORT_COPY = {
  it: {
    estimate: 'Stima',
    generated: 'Generato il',
    monthlyNet: 'Netto per mensilità',
    annualNet: 'Netto annuale',
    gross: 'RAL',
    contributions: 'Contributi INPS',
    taxes: 'IRPEF e addizionali',
    benefits: 'Bonus fiscali',
    comparison: 'Confronto RAL',
    payPeriods: 'mensilità',
    current: 'Attuale',
    alternative: 'Alternativa',
    netDifference: 'Differenza netta annuale',
    note: 'Stima per dipendente privato a tempo indeterminato, senza familiari a carico o altri redditi.',
    source: 'Fonte comunale MEF',
  },
  en: {
    estimate: 'Estimate',
    generated: 'Generated on',
    monthlyNet: 'Net per pay period',
    annualNet: 'Annual net',
    gross: 'Gross annual salary',
    contributions: 'INPS contributions',
    taxes: 'Income tax and surtaxes',
    benefits: 'Tax bonuses',
    comparison: 'Salary comparison',
    payPeriods: 'pay periods',
    current: 'Current',
    alternative: 'Alternative',
    netDifference: 'Annual net difference',
    note: 'Estimate for a permanent private employee with no dependants or other income.',
    source: 'MEF municipal source',
  },
} as const

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function buildSalaryReport({
  result,
  comparison,
  language,
  regionName,
  sourceUrl,
  generatedAt = new Date(),
}: BuildSalaryReportOptions): SalaryReportModel {
  const copy = REPORT_COPY[language]
  const locale = language === 'it' ? 'it-IT' : 'en-IE'
  const currency = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
  const signedCurrency = (value: number) =>
    (value >= 0 ? '+' : '−') + currency.format(Math.abs(value))

  return {
    filename: `netto-${Math.round(result.grossAnnualSalary)}-${slugify(result.municipalityName)}.pdf`,
    title: `netto. · ${copy.estimate} ${generatedAt.getFullYear()}`,
    subtitle: `${result.municipalityName} (${result.municipalityProvince}) · ${regionName} · ${result.payPeriods} ${copy.payPeriods}`,
    generatedLabel: `${copy.generated} ${new Intl.DateTimeFormat(locale).format(generatedAt)}`,
    primary: [
      { label: copy.monthlyNet, value: currency.format(result.netPerPayPeriod) },
      { label: copy.annualNet, value: currency.format(result.annualNet) },
    ],
    rows: [
      { label: copy.gross, value: currency.format(result.grossAnnualSalary) },
      { label: copy.contributions, value: `−${currency.format(result.employeeContributions)}` },
      { label: copy.taxes, value: `−${currency.format(result.totalTaxes)}` },
      ...(result.totalBenefits > 0
        ? [{ label: copy.benefits, value: `+${currency.format(result.totalBenefits)}` }]
        : []),
    ],
    comparison: comparison
      ? {
          title: copy.comparison,
          rows: [
            {
              label: copy.gross,
              current: currency.format(result.grossAnnualSalary),
              alternative: currency.format(comparison.grossAnnualSalary),
            },
            {
              label: copy.annualNet,
              current: currency.format(result.annualNet),
              alternative: currency.format(comparison.annualNet),
            },
          ],
          deltaLabel: copy.netDifference,
          deltaValue: signedCurrency(comparison.annualNet - result.annualNet),
        }
      : undefined,
    note: copy.note,
    sourceLabel: copy.source,
    sourceUrl,
  }
}

/** Compone il documento solo su richiesta, mantenendo jsPDF fuori dal bundle iniziale. */
export async function renderSalaryReport(model: SalaryReportModel) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  pdf.setFillColor(255, 92, 40)
  pdf.rect(0, 0, pageWidth, 12, 'F')
  pdf.setTextColor(18, 18, 18)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.text(model.title, margin, 29)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(model.subtitle, margin, 37)
  pdf.setTextColor(100, 100, 100)
  pdf.text(model.generatedLabel, margin, 43)

  model.primary.forEach((item, index) => {
    const x = margin + index * (contentWidth / 2)
    pdf.setFillColor(index === 0 ? 18 : 244, index === 0 ? 18 : 241, index === 0 ? 18 : 234)
    pdf.rect(x, 51, contentWidth / 2 - 2, 31, 'F')
    pdf.setTextColor(index === 0 ? 255 : 18, index === 0 ? 255 : 18, index === 0 ? 255 : 18)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(item.label, x + 6, 61)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(item.value, x + 6, 74)
  })

  let y = 94
  pdf.setTextColor(18, 18, 18)
  model.rows.forEach((row) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(row.label, margin, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row.value, pageWidth - margin, y, { align: 'right' })
    pdf.setDrawColor(215, 211, 204)
    pdf.line(margin, y + 4, pageWidth - margin, y + 4)
    y += 13
  })

  if (model.comparison) {
    y += 7
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text(model.comparison.title, margin, y)
    y += 11
    model.comparison.rows.forEach((row) => {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(row.label, margin, y)
      pdf.text(row.current, pageWidth - margin - 48, y, { align: 'right' })
      pdf.setFont('helvetica', 'bold')
      pdf.text(row.alternative, pageWidth - margin, y, { align: 'right' })
      y += 10
    })
    pdf.setFillColor(255, 92, 40)
    pdf.rect(margin, y, contentWidth, 17, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(model.comparison.deltaLabel, margin + 5, y + 10.5)
    pdf.text(model.comparison.deltaValue, pageWidth - margin - 5, y + 10.5, { align: 'right' })
    y += 27
  }

  pdf.setTextColor(90, 90, 90)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  const noteLines = pdf.splitTextToSize(model.note, contentWidth)
  pdf.text(noteLines, margin, y)
  y += noteLines.length * 4 + 7
  pdf.setTextColor(18, 18, 18)
  pdf.textWithLink(model.sourceLabel, margin, y, { url: model.sourceUrl })

  return pdf
}

export async function downloadSalaryReport(model: SalaryReportModel) {
  const pdf = await renderSalaryReport(model)
  pdf.save(model.filename)
}

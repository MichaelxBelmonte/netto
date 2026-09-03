import type { AssistantSnapshot } from './assistantContext'
import type { ChatTurn } from './assistantWorkerProtocol'

export async function downloadAssistantReport(
  snapshot: AssistantSnapshot,
  messages: ChatTurn[],
) {
  const { jsPDF } = await import('jspdf')
  const language = snapshot.language
  const it = language === 'it'
  const locale = it ? 'it-IT' : 'en-IE'
  const currency = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 18
  const width = pageWidth - margin * 2
  const ink: [number, number, number] = [18, 18, 18]
  const orange: [number, number, number] = [255, 79, 24]
  const muted: [number, number, number] = [100, 100, 96]
  let y = 24

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return
    pdf.addPage()
    y = 22
    pdf.setFillColor(...orange)
    pdf.rect(0, 0, pageWidth, 8, 'F')
  }
  const heading = (text: string) => {
    ensureSpace(18)
    pdf.setTextColor(...ink)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text(text, margin, y)
    y += 10
  }
  const paragraph = (text: string, size = 9.5) => {
    const lines = pdf.splitTextToSize(text, width)
    pdf.setTextColor(...ink)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(size)
    for (const line of lines) {
      ensureSpace(7)
      pdf.text(line, margin, y)
      y += 5
    }
    y += 4
  }

  pdf.setFillColor(...orange)
  pdf.rect(0, 0, pageWidth, 9, 'F')
  pdf.setTextColor(...ink)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.text(it ? 'netto. · Report assistente' : 'netto. · Assistant report', margin, y)
  y += 9
  pdf.setTextColor(...muted)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(new Intl.DateTimeFormat(locale).format(new Date()), margin, y)
  y += 14

  heading(it ? 'Scenario fiscale' : 'Tax scenario')
  paragraph(
    `${snapshot.result.municipalityName} (${snapshot.result.municipalityProvince}) · ${snapshot.result.payPeriods} ${it ? 'mensilità' : 'pay periods'}`,
  )
  const rows = [
    [it ? 'RAL' : 'Gross salary', currency.format(snapshot.result.grossAnnualSalary)],
    [it ? 'Netto annuale' : 'Annual net', currency.format(snapshot.result.annualNet)],
    [it ? 'Netto per mensilità' : 'Net per pay period', currency.format(snapshot.result.netPerPayPeriod)],
    [it ? 'Contributi INPS' : 'Employee INPS', currency.format(snapshot.result.employeeContributions)],
    [it ? 'Imposte totali' : 'Total taxes', currency.format(snapshot.result.totalTaxes)],
    [it ? 'Costo azienda stimato' : 'Estimated employer cost', currency.format(snapshot.employerCost.totalCost)],
  ]
  ensureSpace(rows.length * 9 + 4)
  rows.forEach(([label, value]) => {
    pdf.setDrawColor(210, 207, 199)
    pdf.line(margin, y + 3, pageWidth - margin, y + 3)
    pdf.setTextColor(...ink)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(label ?? '', margin, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(value ?? '', pageWidth - margin, y, { align: 'right' })
    y += 9
  })
  y += 7

  if (snapshot.comparison) {
    heading(it ? 'Confronto RAL' : 'Salary comparison')
    paragraph(
      `${currency.format(snapshot.result.grossAnnualSalary)} -> ${currency.format(snapshot.comparison.grossAnnualSalary)} · ${currency.format(snapshot.result.annualNet)} -> ${currency.format(snapshot.comparison.annualNet)} ${it ? 'netti annui' : 'annual net'}`,
    )
  }

  heading(it ? 'Conversazione' : 'Conversation')
  if (!messages.length) paragraph(it ? 'Nessuna domanda nella conversazione.' : 'No questions in this conversation.')
  messages.forEach((message) => {
    const speaker = message.role === 'user' ? (it ? 'Tu' : 'You') : 'netto.'
    paragraph(`${speaker}: ${message.content || (it ? 'Generazione in corso…' : 'Generating…')}`, 8.5)
  })

  ensureSpace(18)
  pdf.setTextColor(...muted)
  pdf.setFontSize(7.5)
  paragraph(
    it
      ? 'Report informativo generato dai dati verificati del motore fiscale. Non sostituisce un cedolino o una consulenza professionale.'
      : 'Informational report generated from the verified tax engine. It does not replace a payslip or professional advice.',
    7.5,
  )
  pdf.save(`netto-assistente-${snapshot.result.grossAnnualSalary}-${snapshot.result.municipalityCode}.pdf`)
}

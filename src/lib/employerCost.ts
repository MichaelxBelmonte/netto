/**
 * Costo del lavoro a carico dell'azienda: la stessa RAL vista dall'altro lato.
 *
 * Questo modulo non importa `tax.ts` di proposito: i due calcoli condividono la RAL,
 * non la logica. Il netto dipende da norme fiscali pubblicate e verificabili; il costo
 * azienda dipende da tabelle contributive che l'INPS non pubblica più in forma
 * analitica aggiornata. Ogni voce porta quindi il proprio livello di confidenza:
 *
 * - `verified`: l'aliquota è fissata da una norma citabile e ancora in vigore
 * - `reconstructed`: l'aliquota viene dall'ultima tabella INPS analitica reperibile
 *   (gennaio 2012), aggiornata a mano con le riforme successive. È una ricostruzione,
 *   non una trascrizione, e va dichiarata come tale.
 */

export const EMPLOYER_COST_YEAR = 2026

/** Massimale annuo della contribuzione IVS per i nuovi iscritti (circolare INPS 6/2026, par. 6). */
export const CONTRIBUTION_CEILING = 122_295

/** Quota del lavoratore usata dal motore del netto, per il confronto di coerenza. */
const ENGINE_EMPLOYEE_RATE = 0.0919

export type EmployerSector = 'commerce' | 'industry'
export type EmployerSize = 'upTo5' | 'from6to15' | 'over15'
export type CostConfidence = 'verified' | 'reconstructed'

export type EmployerCostItemKey =
  | 'ivs'
  | 'naspi'
  | 'training'
  | 'tfrGuarantee'
  | 'cuaf'
  | 'sickness'
  | 'maternity'
  | 'cigo'
  | 'fis'
  | 'cigs'
  | 'inail'
  | 'tfr'
  | 'healthFund'
  | 'bilateralBody'

export type EmployerCostItem = {
  key: EmployerCostItemKey
  /** Aliquota sulla RAL, oppure null se la voce è un importo fisso da contratto. */
  rate: number | null
  amount: number
  confidence: CostConfidence
  source: string
}

export type EmployerCostResult = {
  grossAnnualSalary: number
  sector: EmployerSector
  size: EmployerSize
  inpsItems: EmployerCostItem[]
  inpsTotal: number
  inpsRate: number
  insuranceItem: EmployerCostItem
  severanceItem: EmployerCostItem
  contractualItems: EmployerCostItem[]
  contractualTotal: number
  totalCost: number
  costMultiplier: number
  /**
   * Quota a carico del lavoratore implicita in questo scenario: 9,19% più un terzo
   * del FIS e un terzo della CIGS. Quando supera il 9,19% il netto calcolato
   * dall'altro motore è leggermente ottimista, e l'interfaccia deve dirlo.
   */
  impliedEmployeeRate: number
  matchesEngineEmployeeRate: boolean
  ceilingApplied: boolean
}

type RateSpec = {
  rate: number
  confidence: CostConfidence
  source: string
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const ratio = (value: number) => Math.round(value * 10_000) / 10_000

const INPS_TABLE = 'Ultima tabella INPS analitica reperibile (aliquote in vigore dal 1° gennaio 2012)'

/** Voci dovute in entrambi i settori. */
const SHARED_RATES: Record<'ivs' | 'naspi' | 'training' | 'tfrGuarantee' | 'cuaf', RateSpec> = {
  ivs: { rate: 0.2381, confidence: 'reconstructed', source: INPS_TABLE },
  naspi: { rate: 0.0131, confidence: 'verified', source: 'L. 92/2012 art. 2 c. 25' },
  training: { rate: 0.003, confidence: 'verified', source: 'L. 845/1978 art. 25' },
  tfrGuarantee: { rate: 0.002, confidence: 'verified', source: 'L. 297/1982 art. 2' },
  cuaf: { rate: 0.0068, confidence: 'reconstructed', source: INPS_TABLE },
}

/**
 * Differenze di settore. Nel commercio l'indennità di malattia è contributiva; nell'industria
 * l'impiegato non la versa perché per contratto la malattia la paga direttamente l'azienda,
 * ed è quindi un costo reale che non compare tra i contributi. L'industria paga invece la CIGO,
 * che nel terziario è sostituita dal FIS.
 */
const SECTOR_RATES: Record<
  EmployerSector,
  { sickness?: RateSpec; maternity: RateSpec; cigo?: RateSpec; inail: RateSpec }
> = {
  commerce: {
    sickness: { rate: 0.0244, confidence: 'reconstructed', source: INPS_TABLE },
    maternity: { rate: 0.0024, confidence: 'reconstructed', source: INPS_TABLE },
    inail: {
      rate: 0.004,
      confidence: 'reconstructed',
      source: 'Tariffa INAIL, voce 0722 lavoro d’ufficio, gestione Terziario: tasso medio prima dell’oscillazione',
    },
  },
  industry: {
    maternity: { rate: 0.0046, confidence: 'reconstructed', source: INPS_TABLE },
    cigo: {
      rate: 0.017,
      confidence: 'verified',
      source: 'D.Lgs. 148/2015 art. 13: 1,70% fino a 50 dipendenti',
    },
    inail: {
      rate: 0.005,
      confidence: 'reconstructed',
      source: 'Tariffa INAIL, voce 0722 lavoro d’ufficio, gestione Industria: tasso medio prima dell’oscillazione',
    },
  },
}

/**
 * FIS: contributo ordinario 0,50% fino a 5 dipendenti e 0,80% oltre, ripartito per due terzi
 * sul datore e un terzo sul lavoratore. Dovuto dai datori non coperti da CIGO, quindi dal
 * terziario: la L. 234/2021 ha esteso l'obbligo anche sotto i 5 dipendenti.
 */
const FIS_TOTAL_RATE: Record<EmployerSize, number> = {
  upTo5: 0.005,
  from6to15: 0.008,
  over15: 0.008,
}

/** CIGS: 0,90% complessivo, due terzi al datore. Dal 2022 anche fuori dall'industria sopra i 15 dipendenti. */
const CIGS_TOTAL_RATE = 0.009

const EMPLOYER_SHARE = 2 / 3
const EMPLOYEE_SHARE = 1 / 3

/** Un tredicesimo e mezzo della retribuzione, meno lo 0,50% già compreso nell'aliquota IVS del datore. */
export const TFR_EMPLOYER_RATE = 1 / 13.5 - 0.005

const FIXED_HEALTH_FUND = 156

export function calculateEmployerCost(
  grossAnnualSalary: number,
  options: { sector?: EmployerSector; size?: EmployerSize } = {},
): EmployerCostResult {
  if (!Number.isFinite(grossAnnualSalary) || grossAnnualSalary <= 0) {
    throw new RangeError('La RAL deve essere un numero positivo.')
  }

  const sector = options.sector ?? 'commerce'
  const size = options.size ?? 'upTo5'
  const sectorRates = SECTOR_RATES[sector]

  // Il massimale vale sulla sola contribuzione pensionistica, non sull'intero costo.
  const ivsBase = Math.min(grossAnnualSalary, CONTRIBUTION_CEILING)
  const item = (
    key: EmployerCostItemKey,
    spec: RateSpec,
    base = grossAnnualSalary,
  ): EmployerCostItem => ({
    key,
    rate: spec.rate,
    amount: money(base * spec.rate),
    confidence: spec.confidence,
    source: spec.source,
  })

  const inpsItems: EmployerCostItem[] = [
    item('ivs', SHARED_RATES.ivs, ivsBase),
    item('naspi', SHARED_RATES.naspi),
    item('training', SHARED_RATES.training),
    item('tfrGuarantee', SHARED_RATES.tfrGuarantee),
    item('cuaf', SHARED_RATES.cuaf),
  ]

  if (sectorRates.sickness) inpsItems.push(item('sickness', sectorRates.sickness))
  inpsItems.push(item('maternity', sectorRates.maternity))
  if (sectorRates.cigo) inpsItems.push(item('cigo', sectorRates.cigo))

  const fisEmployerRate = sector === 'commerce' ? FIS_TOTAL_RATE[size] * EMPLOYER_SHARE : 0
  if (fisEmployerRate > 0) {
    inpsItems.push(
      item('fis', {
        rate: fisEmployerRate,
        confidence: 'verified',
        source: 'D.Lgs. 148/2015 art. 29 c. 8, come modificato dalla L. 234/2021: due terzi al datore',
      }),
    )
  }

  const cigsEmployerRate = size === 'over15' ? CIGS_TOTAL_RATE * EMPLOYER_SHARE : 0
  if (cigsEmployerRate > 0) {
    inpsItems.push(
      item('cigs', {
        rate: cigsEmployerRate,
        confidence: 'verified',
        source: 'D.Lgs. 148/2015 art. 23: 0,90% complessivo, due terzi al datore',
      }),
    )
  }

  // Somma degli importi già arrotondati, così le voci mostrate corrispondono al totale.
  const inpsTotal = money(inpsItems.reduce((total, entry) => total + entry.amount, 0))
  const insuranceItem = item('inail', sectorRates.inail)
  const severanceItem: EmployerCostItem = {
    key: 'tfr',
    rate: TFR_EMPLOYER_RATE,
    amount: money(grossAnnualSalary * TFR_EMPLOYER_RATE),
    confidence: 'verified',
    source: 'Art. 2120 c.c. (un tredicesimo e mezzo) e L. 297/1982 art. 3, che scomputa lo 0,50%',
  }

  const contractualItems: EmployerCostItem[] = [
    {
      key: 'healthFund',
      rate: null,
      amount: FIXED_HEALTH_FUND,
      confidence: 'reconstructed',
      source:
        sector === 'commerce'
          ? 'Fondo Est, quota annua a carico azienda prevista dal CCNL Terziario'
          : 'Assistenza sanitaria integrativa contrattuale, importo tipico',
    },
  ]
  if (sector === 'commerce') {
    contractualItems.push({
      key: 'bilateralBody',
      rate: 0.001,
      amount: money(grossAnnualSalary * 0.001),
      confidence: 'reconstructed',
      source: 'Ente bilaterale, quota a carico azienda prevista dal CCNL Terziario',
    })
  }

  const contractualTotal = money(
    contractualItems.reduce((total, entry) => total + entry.amount, 0),
  )
  const totalCost = money(
    grossAnnualSalary + inpsTotal + insuranceItem.amount + severanceItem.amount + contractualTotal,
  )

  const impliedEmployeeRate = ratio(
    ENGINE_EMPLOYEE_RATE +
      (sector === 'commerce' ? FIS_TOTAL_RATE[size] * EMPLOYEE_SHARE : 0) +
      (size === 'over15' ? CIGS_TOTAL_RATE * EMPLOYEE_SHARE : 0),
  )

  return {
    grossAnnualSalary: money(grossAnnualSalary),
    sector,
    size,
    inpsItems,
    inpsTotal,
    inpsRate: ratio(inpsTotal / grossAnnualSalary),
    insuranceItem,
    severanceItem,
    contractualItems,
    contractualTotal,
    totalCost,
    costMultiplier: ratio(totalCost / grossAnnualSalary),
    impliedEmployeeRate,
    matchesEngineEmployeeRate: impliedEmployeeRate === ratio(ENGINE_EMPLOYEE_RATE),
    ceilingApplied: grossAnnualSalary > CONTRIBUTION_CEILING,
  }
}

/**
 * Unisce i due motori senza accoppiarli: prende il netto già calcolato e dice quanta parte
 * del costo aziendale arriva davvero al dipendente. È la metrica che cambia con la RAL,
 * mentre il moltiplicatore costo/RAL resta quasi costante.
 */
export function summariseEmploymentCost(annualNet: number, cost: EmployerCostResult) {
  return {
    totalCost: cost.totalCost,
    annualNet: money(annualNet),
    netShareOfCost: ratio(annualNet / cost.totalCost),
    costPerNetEuro: ratio(cost.totalCost / annualNet),
  }
}

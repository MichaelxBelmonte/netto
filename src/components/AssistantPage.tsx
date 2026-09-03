import { type FormEvent, useEffect, useRef, useState } from 'react'
import brandMark from '../assets/netto-mark-v3-crop.png'
import {
  buildAssistantContext,
  detectAssistantLanguage,
  getAssistantSystemPrompt,
  isPlausibleAssistantReply,
  type AssistantSnapshot,
} from '../lib/assistantContext'
import { resolveAssistantScenario, updateAssistantScenario } from '../lib/assistantScenario'
import {
  buildAssistantAnalysis,
  buildDeterministicAssistantPlan,
  getAssistantPlannerPrompt,
  parseAssistantPlan,
  type AssistantPlan,
} from '../lib/assistantAnalysis'
import type {
  AssistantModelId,
  AssistantWorkerRequest,
  AssistantWorkerResponse,
  ChatTurn,
} from '../lib/assistantWorkerProtocol'
import { createAssistantRequestId } from '../lib/assistantWorkerProtocol'
import { searchMunicipalities } from '../lib/localTaxes'
import { MAX_GROSS_SALARY, MIN_GROSS_SALARY } from '../lib/tax'
import { downloadAssistantReport } from '../lib/assistantReport'

type AiState = 'idle' | 'loading' | 'ready' | 'thinking' | 'error' | 'unsupported'

const ASSISTANT_MODELS: Array<{
  id: AssistantModelId
  label: string
  size: string
  description: { it: string; en: string }
}> = [
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B',
    size: '~483 MB',
    description: { it: 'Equilibrio tra velocità e qualità', en: 'Balanced speed and quality' },
  },
  {
    id: 'qwen3.5-0.8b',
    label: 'Qwen 3.5 0.8B',
    size: '~583 MB',
    description: { it: 'Risposte più complete', en: 'More detailed answers' },
  },
]

const UI = {
  it: {
    back: 'Torna al calcolo', language: 'Cambia lingua', eyebrow: 'AI locale · sperimentale',
    title: 'Chiedi a netto.', intro: 'Capisci il tuo calcolo, senza cedere i dati a un server.',
    current: 'Scenario attuale', gross: 'RAL', net: 'Netto annuo',
    municipality: 'Comune', localTitle: 'AI sul tuo dispositivo.',
    localDescription: 'Il modello selezionato interpreta i risultati del motore fiscale verificato, senza ricalcolarli.',
    download: 'salvato nella cache del browser', activate: 'Attiva AI locale',
    loading: 'Download del modello', ready: 'AI locale pronta', thinking: 'Sto leggendo il calcolo…',
    unsupported: 'WebGPU non è disponibile in questo browser. Le domande rapide continuano a funzionare.',
    failed: 'Non riesco ad avviare il modello locale. Puoi usare le domande rapide.',
    modelToggle: 'AI locale', modelOff: 'AI spenta', modelChoice: 'Scegli il modello locale',
    selectedModel: 'Selezionato', modelReady: 'Pronto', modelInactive: 'Da attivare',
    modelFallback: 'Il modello non ha prodotto una risposta affidabile. Ti mostro i dati verificati:',
    enableForOpen: 'Per questa domanda serve il modello locale: puoi attivarlo con il toggle.',
    quick: 'Domande rapide', input: 'Fai una domanda sui dati del calcolo', send: 'Invia',
    exportPdf: 'Crea PDF personalizzato', pdfReady: 'PDF creato', pdfError: 'PDF non disponibile',
    authoritative: 'I numeri vengono dal motore fiscale; il modello selezionato li interpreta senza sostituirli.',
    emptyChat: 'Pronto quando vuoi.', salaryControl: 'RAL', cityControl: 'Comune', periodsControl: 'Mensilità',
    prompts: {
      takeHome: 'Quanto mi resta davvero?', salaryChange: 'Cosa cambia con l’altra RAL?',
      municipalities: 'Quale Comune conviene?', employerCost: 'Quanto costo all’azienda?',
    },
  },
  en: {
    back: 'Back to calculator', language: 'Change language', eyebrow: 'Local AI · experimental',
    title: 'Ask netto.', intro: 'Understand your calculation without sending data to a server.',
    current: 'Current scenario', gross: 'Gross salary', net: 'Annual net',
    municipality: 'Municipality', localTitle: 'AI on your device.',
    localDescription: 'The selected model interprets verified tax-engine results without recalculating them.',
    download: 'stored in the browser cache', activate: 'Enable local AI',
    loading: 'Downloading model', ready: 'Local AI ready', thinking: 'Reading the calculation…',
    unsupported: 'WebGPU is unavailable in this browser. Quick questions still work.',
    failed: 'The local model could not start. You can still use quick questions.',
    modelToggle: 'Local AI', modelOff: 'AI off', modelChoice: 'Choose a local model',
    selectedModel: 'Selected', modelReady: 'Ready', modelInactive: 'Not active',
    modelFallback: 'The model did not produce a reliable answer. Here are the verified figures:',
    enableForOpen: 'This question needs the local model. Turn it on with the toggle.',
    quick: 'Quick questions', input: 'Ask about this calculation', send: 'Send',
    exportPdf: 'Create custom PDF', pdfReady: 'PDF created', pdfError: 'PDF unavailable',
    authoritative: 'Figures come from the tax engine; the selected model interprets them without replacing them.',
    emptyChat: 'Ready when you are.', salaryControl: 'Salary', cityControl: 'Municipality', periodsControl: 'Pay periods',
    prompts: {
      takeHome: 'What do I actually take home?', salaryChange: 'What changes with the other salary?',
      municipalities: 'Which municipality is best?', employerCost: 'What do I cost my employer?',
    },
  },
} as const

export function AssistantPage({
  snapshot,
  onLanguageChange,
}: {
  snapshot: AssistantSnapshot
  onLanguageChange: (language: 'it' | 'en') => void
}) {
  const { language } = snapshot
  const copy = UI[language]
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [activeSnapshot, setActiveSnapshot] = useState(snapshot)
  const { result } = activeSnapshot
  const [draft, setDraft] = useState('')
  const [salaryDraft, setSalaryDraft] = useState(String(result.grossAnnualSalary))
  const [municipalityDraft, setMunicipalityDraft] = useState(result.municipalityName)
  const [aiState, setAiState] = useState<AiState>(() =>
    typeof navigator !== 'undefined' && 'gpu' in navigator ? 'idle' : 'unsupported',
  )
  const [progress, setProgress] = useState(0)
  const [selectedModel, setSelectedModel] = useState<AssistantModelId>('qwen2.5-0.5b')
  const [pdfFeedback, setPdfFeedback] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const pendingFallbackRef = useRef('')
  const pendingContextRef = useRef('')
  const activeRequestRef = useRef<string | null>(null)
  const pendingQuestionRef = useRef('')
  const pendingSnapshotRef = useRef<AssistantSnapshot | null>(null)
  const pendingPlanRef = useRef<AssistantPlan | null>(null)
  const pendingMessagesRef = useRef<ChatTurn[]>([])
  const selectedModelRef = useRef<AssistantModelId>(selectedModel)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    setActiveSnapshot(snapshot)
  }, [
    snapshot.language,
    snapshot.result.grossAnnualSalary,
    snapshot.result.municipalityCode,
    snapshot.result.payPeriods,
    snapshot.comparison?.grossAnnualSalary,
    snapshot.employerCost.sector,
    snapshot.employerCost.size,
  ])

  useEffect(() => {
    setSalaryDraft(String(result.grossAnnualSalary))
    setMunicipalityDraft(result.municipalityName)
  }, [result.grossAnnualSalary, result.municipalityName])

  useEffect(() => {
    transcriptRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

  useEffect(() => () => workerRef.current?.terminate(), [])

  function ensureWorker() {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('../workers/nettoAssistant.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<AssistantWorkerResponse>) => {
      const message = event.data
      if (
        message.requestId !== activeRequestRef.current ||
        (message.model && message.model !== selectedModelRef.current)
      ) return
      if (message.type === 'loading') {
        setAiState('loading')
        if (message.progress !== undefined) setProgress(message.progress)
      } else if (message.type === 'ready') {
        setProgress(1)
        setAiState('ready')
      } else if (message.type === 'token') {
        setMessages((current) => {
          const next = [...current]
          const last = next.at(-1)
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + message.token }
          return next
        })
      } else if (message.type === 'done') {
        if (message.purpose === 'plan') {
          const snapshotForPlan = pendingSnapshotRef.current
          const questionForPlan = pendingQuestionRef.current
          if (!snapshotForPlan || !questionForPlan) return
          const fallbackPlan = pendingPlanRef.current ?? buildDeterministicAssistantPlan(questionForPlan, snapshotForPlan)
          const plan = parseAssistantPlan(message.text, fallbackPlan)
          const analysis = buildAssistantAnalysis(questionForPlan, snapshotForPlan, plan)
          const answerRequestId = createAssistantRequestId()
          activeRequestRef.current = answerRequestId
          pendingFallbackRef.current = `${UI[snapshotForPlan.language].modelFallback} ${analysis.fallback}`
          pendingContextRef.current = `${buildAssistantContext(snapshotForPlan)}\n${analysis.context}\nVERIFIED ENGINE DRAFT — answer the user's exact request intelligently, compare all requested scenarios, and preserve every figure:\n${analysis.fallback}`
          postWorkerMessage({
            type: 'ask',
            requestId: answerRequestId,
            model: selectedModelRef.current,
            purpose: 'answer',
            systemPrompt: getAssistantSystemPrompt(snapshotForPlan.language, pendingContextRef.current),
            messages: pendingMessagesRef.current,
          })
          return
        }
        setMessages((current) => {
          const next = [...current]
          const generated = message.text.trim()
          next[next.length - 1] = {
            role: 'assistant',
            content: isPlausibleAssistantReply(generated, pendingContextRef.current)
              ? generated
              : pendingFallbackRef.current,
          }
          return next
        })
        setAiState('ready')
      } else {
        setAiState('error')
        setMessages((current) => {
          const next = [...current]
          if (next.at(-1)?.role === 'assistant' && next.at(-1)?.content === '') {
            next[next.length - 1] = { role: 'assistant', content: pendingFallbackRef.current }
          }
          return next
        })
      }
    })
    workerRef.current = worker
    return worker
  }

  function postWorkerMessage(message: AssistantWorkerRequest) {
    ensureWorker().postMessage(message)
  }

  function activateAi() {
    if (aiState === 'unsupported') return
    const requestId = createAssistantRequestId()
    activeRequestRef.current = requestId
    setAiState('loading')
    postWorkerMessage({ type: 'load', requestId, model: selectedModel })
  }

  function toggleAi() {
    if (aiState === 'unsupported') return
    if (aiState === 'idle' || aiState === 'error') {
      activateAi()
      return
    }
    workerRef.current?.terminate()
    workerRef.current = null
    activeRequestRef.current = null
    setMessages((current) => current.filter((message) => message.content !== ''))
    setProgress(0)
    setAiState('idle')
  }

  function changeModel(model: AssistantModelId) {
    if (model === selectedModel || aiState === 'loading' || aiState === 'thinking') return
    workerRef.current?.terminate()
    workerRef.current = null
    activeRequestRef.current = null
    setSelectedModel(model)
    setProgress(0)
    setMessages((current) => current.filter((message) => message.content !== ''))
    setAiState(typeof navigator !== 'undefined' && 'gpu' in navigator ? 'idle' : 'unsupported')
  }

  function commitSalary() {
    const salary = Number(salaryDraft)
    if (Number.isFinite(salary) && salary >= MIN_GROSS_SALARY && salary <= MAX_GROSS_SALARY) {
      setActiveSnapshot((current) => updateAssistantScenario(current, { salary }))
    } else {
      setSalaryDraft(String(result.grossAnnualSalary))
    }
  }

  function commitMunicipality() {
    const match = searchMunicipalities(municipalityDraft, 1)[0]
    if (match) {
      setActiveSnapshot((current) => updateAssistantScenario(current, { municipalityCode: match.c }))
      setMunicipalityDraft(match.n)
    } else {
      setMunicipalityDraft(result.municipalityName)
    }
  }

  async function createCustomPdf() {
    if (isDownloadingPdf || aiState === 'loading' || aiState === 'thinking') return
    setIsDownloadingPdf(true)
    setPdfFeedback('')
    try {
      await downloadAssistantReport(activeSnapshot, messages)
      setPdfFeedback(copy.pdfReady)
    } catch {
      setPdfFeedback(copy.pdfError)
    } finally {
      setIsDownloadingPdf(false)
      window.setTimeout(() => setPdfFeedback(''), 3_500)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const question = draft.trim()
    if (!question) return
    const responseLanguage = detectAssistantLanguage(question)
    const nextSnapshot = resolveAssistantScenario(question, {
      ...activeSnapshot,
      language: responseLanguage,
    })
    const nextMessages: ChatTurn[] = [
      ...messages,
      { role: 'user', content: question },
    ]
    setActiveSnapshot(nextSnapshot)
    const fallbackPlan = buildDeterministicAssistantPlan(question, nextSnapshot)
    const fallbackAnalysis = buildAssistantAnalysis(question, nextSnapshot, fallbackPlan)
    if (aiState !== 'ready') {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: fallbackAnalysis.fallback,
        },
      ])
      setDraft('')
      return
    }

    const planRequestId = createAssistantRequestId()
    activeRequestRef.current = planRequestId
    pendingQuestionRef.current = question
    pendingSnapshotRef.current = nextSnapshot
    pendingPlanRef.current = fallbackPlan
    pendingMessagesRef.current = nextMessages
    pendingFallbackRef.current = `${UI[responseLanguage].modelFallback} ${fallbackAnalysis.fallback}`
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setDraft('')
    setAiState('thinking')
    postWorkerMessage({
      type: 'ask',
      requestId: planRequestId,
      model: selectedModel,
      purpose: 'plan',
      systemPrompt: getAssistantPlannerPrompt(nextSnapshot),
      messages: [{ role: 'user', content: question }],
    })
  }

  return (
    <div className="assistant-page">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="netto.">
          <img src={brandMark} alt="" />
          <span>netto.</span>
        </a>
        <div className="header-actions">
          <div className="language-switch" aria-label={copy.language}>
            {(['it', 'en'] as const).map((item) => (
              <button type="button" key={item} aria-pressed={language === item} onClick={() => onLanguageChange(item)}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="assistant-pdf-button" type="button" onClick={() => void createCustomPdf()} disabled={isDownloadingPdf || aiState === 'loading' || aiState === 'thinking'} aria-busy={isDownloadingPdf}>
            {copy.exportPdf}
          </button>
          {pdfFeedback ? <span className="assistant-pdf-feedback" role="status">{pdfFeedback}</span> : null}
        </div>
      </header>

      <main className="assistant-main">
        <section className={`assistant-shell page-width${messages.length === 0 ? ' assistant-shell--empty' : ''}`} aria-label={copy.title}>
          <div className="assistant-transcript" ref={transcriptRef} aria-live="polite">
            {messages.length === 0 ? (
              <p className="assistant-chat-empty">{copy.emptyChat}</p>
            ) : (
              messages.map((message, index) => (
                <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}>
                  <span>{message.role === 'assistant' ? 'netto.' : language === 'it' ? 'Tu' : 'You'}</span>
                  <p>{message.content || copy.thinking}</p>
                </div>
              ))
            )}
          </div>

          <form className="assistant-input" onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.input} />
            <button
              className="assistant-ai-toggle"
              type="button"
              role="switch"
              aria-checked={aiState === 'loading' || aiState === 'ready' || aiState === 'thinking'}
              disabled={aiState === 'unsupported'}
              onClick={toggleAi}
            >
              <span className="assistant-toggle-track" aria-hidden="true"><i /></span>
              <span>{copy.modelToggle}</span>
            </button>
            <button type="submit" disabled={!draft.trim()} aria-label={copy.send}>↑</button>
          </form>
          <fieldset className="assistant-model-select" disabled={aiState === 'loading' || aiState === 'thinking'}>
            <legend>{copy.modelChoice}</legend>
            <div className="assistant-model-options">
              {ASSISTANT_MODELS.map((model) => {
                const isSelected = model.id === selectedModel
                const isReady = isSelected && (aiState === 'ready' || aiState === 'thinking')
                return (
                  <label className="assistant-model-option" key={model.id}>
                    <input
                      type="radio"
                      name="assistant-model"
                      value={model.id}
                      checked={isSelected}
                      onChange={() => changeModel(model.id)}
                    />
                    <span className="assistant-model-option__copy">
                      <strong>{model.label}</strong>
                      <small>{model.description[language]}</small>
                    </span>
                    <span className="assistant-model-option__meta">
                      <b>{model.size}</b>
                      <small>{isReady ? copy.modelReady : isSelected ? copy.selectedModel : copy.modelInactive}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="assistant-model-status" aria-live="polite">
            {aiState === 'loading' ? (
              <><span>{copy.loading} · {Math.round(progress * 100)}%</span><i role="progressbar" aria-label={copy.loading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><b style={{ width: `${Math.round(progress * 100)}%` }} /></i></>
            ) : null}
            {aiState === 'unsupported' ? <span className="model-warning">{copy.unsupported}</span> : null}
            {aiState === 'error' ? <span className="model-warning">{copy.failed}</span> : null}
          </div>
          <div className="assistant-scenario-controls">
            <label>
              <span>{copy.salaryControl}</span>
              <input
                type="number"
                min={MIN_GROSS_SALARY}
                max={MAX_GROSS_SALARY}
                step="1000"
                value={salaryDraft}
                onChange={(event) => setSalaryDraft(event.target.value)}
                onBlur={commitSalary}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              />
              <small>€</small>
            </label>
            <label>
              <span>{copy.cityControl}</span>
              <input
                type="search"
                value={municipalityDraft}
                onChange={(event) => setMunicipalityDraft(event.target.value)}
                onBlur={commitMunicipality}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              />
            </label>
            <label>
              <span>{copy.periodsControl}</span>
              <select
                value={result.payPeriods}
                onChange={(event) => setActiveSnapshot((current) => updateAssistantScenario(current, {
                  payPeriods: Number(event.target.value) as 12 | 13 | 14,
                }))}
              >
                <option value="12">12</option>
                <option value="13">13</option>
                <option value="14">14</option>
              </select>
            </label>
          </div>
        </section>
      </main>
    </div>
  )
}

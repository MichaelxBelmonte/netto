import { type FormEvent, useEffect, useRef, useState } from 'react'
import brandMark from '../assets/netto-mark-v3-crop.png'
import {
  answerGuidedQuestion,
  answerScenarioChange,
  buildAssistantContext,
  detectAssistantLanguage,
  detectGuidedQuestion,
  getAssistantSystemPrompt,
  isPlausibleAssistantReply,
  type AssistantSnapshot,
} from '../lib/assistantContext'
import { resolveAssistantScenario, updateAssistantScenario } from '../lib/assistantScenario'
import type { AssistantWorkerResponse, ChatTurn } from '../lib/assistantWorkerProtocol'
import { searchMunicipalities } from '../lib/localTaxes'
import { MAX_GROSS_SALARY, MIN_GROSS_SALARY } from '../lib/tax'

type AiState = 'idle' | 'loading' | 'ready' | 'thinking' | 'error' | 'unsupported'

const UI = {
  it: {
    back: 'Torna al calcolo', language: 'Cambia lingua', eyebrow: 'AI locale · sperimentale',
    title: 'Chiedi a netto.', intro: 'Capisci il tuo calcolo, senza cedere i dati a un server.',
    current: 'Scenario attuale', gross: 'RAL', net: 'Netto annuo',
    municipality: 'Comune', localTitle: 'Gemma, sul tuo dispositivo.',
    localDescription: 'Il modello viene scaricato una volta e gira nel browser. Il calcolo resta quello verificato di netto.',
    download: 'circa 300 MB · salvati nella cache del browser', activate: 'Attiva AI locale',
    loading: 'Download del modello', ready: 'AI locale pronta', thinking: 'Sto leggendo il calcolo…',
    unsupported: 'WebGPU non è disponibile in questo browser. Le domande rapide continuano a funzionare.',
    failed: 'Non riesco ad avviare il modello locale. Puoi usare le domande rapide.',
    modelToggle: 'Gemma locale', modelOff: 'Gemma spenta',
    modelFallback: 'Gemma non ha prodotto una risposta affidabile. Ti mostro i dati verificati:',
    enableForOpen: 'Per questa domanda serve Gemma: puoi accenderla con il toggle in alto.',
    quick: 'Domande rapide', input: 'Fai una domanda sui dati del calcolo', send: 'Invia',
    authoritative: 'I numeri vengono dal motore fiscale; Gemma li spiega e può sbagliare il testo.',
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
    municipality: 'Municipality', localTitle: 'Gemma, on your device.',
    localDescription: 'The model downloads once and runs in your browser. The calculation remains netto’s verified result.',
    download: 'about 300 MB · stored in the browser cache', activate: 'Enable local AI',
    loading: 'Downloading model', ready: 'Local AI ready', thinking: 'Reading the calculation…',
    unsupported: 'WebGPU is unavailable in this browser. Quick questions still work.',
    failed: 'The local model could not start. You can still use quick questions.',
    modelToggle: 'Local Gemma', modelOff: 'Gemma off',
    modelFallback: 'Gemma did not produce a reliable answer. Here are the verified figures:',
    enableForOpen: 'This question needs Gemma. You can turn it on with the toggle above.',
    quick: 'Quick questions', input: 'Ask about this calculation', send: 'Send',
    authoritative: 'Figures come from the tax engine; Gemma explains them and may get the wording wrong.',
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
  const workerRef = useRef<Worker | null>(null)
  const pendingFallbackRef = useRef('')
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

  useEffect(() => () => workerRef.current?.terminate(), [])

  function ensureWorker() {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('../workers/nettoAssistant.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<AssistantWorkerResponse>) => {
      const message = event.data
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
        setMessages((current) => {
          const next = [...current]
          const generated = message.fallbackText?.trim() ?? ''
          next[next.length - 1] = {
            role: 'assistant',
            content: isPlausibleAssistantReply(generated) ? generated : pendingFallbackRef.current,
          }
          return next
        })
        setAiState('ready')
      } else {
        setAiState('error')
        setMessages((current) => current.filter((item) => item.content !== ''))
      }
    })
    workerRef.current = worker
    return worker
  }

  function activateAi() {
    if (aiState === 'unsupported') return
    setAiState('loading')
    ensureWorker().postMessage({ type: 'load' })
  }

  function toggleAi() {
    if (aiState === 'unsupported') return
    if (aiState === 'idle' || aiState === 'error') {
      activateAi()
      return
    }
    workerRef.current?.terminate()
    workerRef.current = null
    setMessages((current) => current.filter((message) => message.content !== ''))
    setProgress(0)
    setAiState('idle')
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

  function submit(event: FormEvent) {
    event.preventDefault()
    const question = draft.trim()
    if (!question) return
    const responseLanguage = detectAssistantLanguage(question)
    const previousSnapshot = { ...activeSnapshot, language: responseLanguage }
    const nextSnapshot = resolveAssistantScenario(question, {
      ...activeSnapshot,
      language: responseLanguage,
    })
    const nextMessages: ChatTurn[] = [
      ...messages,
      { role: 'user', content: question },
    ]
    setActiveSnapshot(nextSnapshot)
    const verifiedAnswer = answerScenarioChange(previousSnapshot, nextSnapshot)
    if (verifiedAnswer) {
      setMessages([...nextMessages, { role: 'assistant', content: verifiedAnswer }])
      setDraft('')
      return
    }
    const guidedQuestion = detectGuidedQuestion(question)
    if (guidedQuestion) {
      setMessages([...nextMessages, {
        role: 'assistant',
        content: answerGuidedQuestion(guidedQuestion, nextSnapshot),
      }])
      setDraft('')
      return
    }
    if (aiState !== 'ready') {
      setMessages([...nextMessages, { role: 'assistant', content: UI[responseLanguage].enableForOpen }])
      setDraft('')
      return
    }
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setDraft('')
    setAiState('thinking')
    pendingFallbackRef.current = `${UI[responseLanguage].modelFallback} ${answerGuidedQuestion('takeHome', nextSnapshot)}`
    ensureWorker().postMessage({
      type: 'ask',
      systemPrompt: getAssistantSystemPrompt(
        responseLanguage,
        buildAssistantContext(nextSnapshot),
      ),
      messages: nextMessages,
    })
  }

  return (
    <div className="assistant-page">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label={copy.back}>
          <img src={brandMark} alt="" />
          <span>netto.</span>
        </a>
        <div className="header-actions">
          <a className="assistant-back" href="#top">← {copy.back}</a>
          <div className="language-switch" aria-label={copy.language}>
            {(['it', 'en'] as const).map((item) => (
              <button type="button" key={item} aria-pressed={language === item} onClick={() => onLanguageChange(item)}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
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
          <div className="assistant-model-status" aria-live="polite">
            {aiState === 'loading' ? (
              <><span>{copy.loading} · {Math.round(progress * 100)}%</span><i><b style={{ width: `${Math.round(progress * 100)}%` }} /></i></>
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

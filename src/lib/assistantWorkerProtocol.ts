export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type AssistantModelId = 'gemma-270m' | 'qwen2.5-0.5b' | 'qwen3.5-0.8b'

export type AssistantRequestId = string

export type AssistantWorkerRequest =
  | { type: 'load'; requestId: AssistantRequestId; model: AssistantModelId }
  | {
      type: 'ask'
      requestId: AssistantRequestId
      model: AssistantModelId
      systemPrompt: string
      messages: ChatTurn[]
    }

export type AssistantWorkerResponse =
  | {
      type: 'loading'
      requestId: AssistantRequestId
      model: AssistantModelId
      progress?: number
    }
  | { type: 'ready'; requestId: AssistantRequestId; model: AssistantModelId }
  | {
      type: 'token'
      requestId: AssistantRequestId
      model: AssistantModelId
      token: string
    }
  | {
      type: 'done'
      requestId: AssistantRequestId
      model: AssistantModelId
      text: string
      /** Kept during the UI migration; new consumers should use `text`. */
      fallbackText?: string
    }
  | {
      type: 'error'
      requestId: AssistantRequestId
      model?: AssistantModelId
      phase: 'protocol' | 'load' | 'generate'
      message: string
      recoverable: boolean
    }

const MODEL_IDS: ReadonlySet<string> = new Set<AssistantModelId>([
  'gemma-270m',
  'qwen2.5-0.5b',
  'qwen3.5-0.8b',
])

export function isAssistantModelId(value: unknown): value is AssistantModelId {
  return typeof value === 'string' && MODEL_IDS.has(value)
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== 'object') return false
  const turn = value as Partial<ChatTurn>
  return (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string'
}

export function isAssistantWorkerRequest(value: unknown): value is AssistantWorkerRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<AssistantWorkerRequest>
  if (
    typeof request.requestId !== 'string' ||
    request.requestId.length === 0 ||
    !isAssistantModelId(request.model)
  ) return false

  if (request.type === 'load') return true
  return request.type === 'ask' &&
    typeof request.systemPrompt === 'string' &&
    Array.isArray(request.messages) &&
    request.messages.every(isChatTurn)
}

export function createAssistantRequestId(): AssistantRequestId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

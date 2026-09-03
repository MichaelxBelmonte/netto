export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type AssistantModelId = 'gemma-270m' | 'qwen2.5-0.5b' | 'qwen3.5-0.8b'

export type AssistantWorkerRequest =
  | { type: 'load'; model: AssistantModelId }
  | { type: 'ask'; model: AssistantModelId; systemPrompt: string; messages: ChatTurn[] }

export type AssistantWorkerResponse =
  | { type: 'loading'; model: AssistantModelId; progress?: number }
  | { type: 'ready'; model: AssistantModelId }
  | { type: 'token'; token: string }
  | { type: 'done'; fallbackText?: string }
  | { type: 'error'; model?: AssistantModelId; message: string }

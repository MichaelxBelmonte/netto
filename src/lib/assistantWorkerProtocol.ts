export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type AssistantWorkerRequest =
  | { type: 'load' }
  | { type: 'ask'; systemPrompt: string; messages: ChatTurn[] }

export type AssistantWorkerResponse =
  | { type: 'loading'; progress?: number }
  | { type: 'ready' }
  | { type: 'token'; token: string }
  | { type: 'done'; fallbackText?: string }
  | { type: 'error'; message: string }

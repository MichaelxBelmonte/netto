/// <reference lib="webworker" />

import {
  isAssistantWorkerRequest,
  type AssistantModelId,
  type AssistantRequestId,
  type AssistantWorkerRequest,
  type AssistantWorkerResponse,
  type ChatTurn,
} from '../lib/assistantWorkerProtocol'

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
const MODELS: Record<AssistantModelId, string> = {
  'gemma-270m': 'onnx-community/gemma-3-270m-it-ONNX',
  'qwen2.5-0.5b': 'onnx-community/Qwen2.5-0.5B-Instruct',
  'qwen3.5-0.8b': 'onnx-community/Qwen3.5-0.8B-ONNX-OPT',
}

type Generator = ((
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text?: string | Array<{ role: string; content: string }> }>>) & {
  tokenizer: unknown
  dispose?: () => void | Promise<void>
}

type TransformersModule = {
  env: { allowLocalModels: boolean }
  pipeline: (
    task: string,
    model: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>
}

let generator: Generator | null = null
let activeModel: AssistantModelId | null = null
let requestQueue: Promise<void> = Promise.resolve()

const send = (message: AssistantWorkerResponse) => self.postMessage(message)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function replaceGenerator(nextGenerator: Generator, model: AssistantModelId) {
  const previousGenerator = generator
  generator = nextGenerator
  activeModel = model
  if (previousGenerator && previousGenerator !== nextGenerator) {
    try {
      await previousGenerator.dispose?.()
    } catch {
      // Releasing the superseded model is best-effort and must not invalidate the new model.
    }
  }
}

async function loadModel(
  model: AssistantModelId,
  requestId: AssistantRequestId,
  announceReady = true,
) {
  if (generator && activeModel === model) {
    if (announceReady) send({ type: 'ready', requestId, model })
    return
  }

  send({ type: 'loading', requestId, model, progress: 0 })
  const transformers = await import(/* @vite-ignore */ TRANSFORMERS_URL) as TransformersModule
  transformers.env.allowLocalModels = false
  const nextGenerator = (await transformers.pipeline('text-generation', MODELS[model], {
    device: 'webgpu',
    dtype: 'q4f16',
    progress_callback: (event: { status?: string; loaded?: number; total?: number }) => {
      if (
        event.status === 'progress' &&
        typeof event.loaded === 'number' &&
        typeof event.total === 'number' &&
        event.total > 0
      ) {
        send({
          type: 'loading',
          requestId,
          model,
          progress: Math.max(0, Math.min(1, event.loaded / event.total)),
        })
      }
    },
  })) as Generator
  await replaceGenerator(nextGenerator, model)
  if (announceReady) send({ type: 'ready', requestId, model })
}

export function finalAssistantText(
  output: Array<{ generated_text?: string | Array<{ role: string; content: string }> }>,
) {
  const generated = output[0]?.generated_text
  if (Array.isArray(generated)) return generated.at(-1)?.content?.trim() ?? ''
  return typeof generated === 'string' ? generated.trim() : ''
}

async function answer(request: Extract<AssistantWorkerRequest, { type: 'ask' }>) {
  await loadModel(request.model, request.requestId, false)
  const currentGenerator = generator
  if (!currentGenerator || activeModel !== request.model) throw new Error('Model unavailable.')

  const output = await currentGenerator(
    [{ role: 'system', content: request.systemPrompt }, ...request.messages.slice(-6)],
    {
      max_new_tokens: request.model === 'gemma-270m' ? 220 : 300,
      do_sample: false,
      repetition_penalty: 1.12,
    },
  )
  const text = finalAssistantText(output)
  send({
    type: 'done',
    requestId: request.requestId,
    model: request.model,
    text,
    fallbackText: text,
  })
}

async function handleRequest(request: AssistantWorkerRequest) {
  try {
    if (request.type === 'load') {
      await loadModel(request.model, request.requestId)
    } else {
      await answer(request)
    }
  } catch (error) {
    const phase = request.type === 'load' || activeModel !== request.model ? 'load' : 'generate'
    if (phase === 'load') {
      generator = null
      activeModel = null
    }
    send({
      type: 'error',
      requestId: request.requestId,
      model: request.model,
      phase,
      message: errorMessage(error, phase === 'load' ? 'Model loading failed.' : 'Generation failed.'),
      recoverable: true,
    })
  }
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isAssistantWorkerRequest(event.data)) {
    const candidate = event.data && typeof event.data === 'object'
      ? event.data as { requestId?: unknown; model?: unknown }
      : null
    send({
      type: 'error',
      requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : '__invalid__',
      phase: 'protocol',
      message: 'Invalid assistant worker request.',
      recoverable: false,
    })
    return
  }

  const request = event.data
  // Transformers pipelines and model replacement are not concurrency-safe. Serializing requests
  // also makes a model switch deterministic while request IDs let the UI ignore stale replies.
  requestQueue = requestQueue.then(() => handleRequest(request)).catch(() => {
    // handleRequest contains its own error boundary; keep the queue usable if that ever regresses.
  })
})

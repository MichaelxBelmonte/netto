/// <reference lib="webworker" />

import type {
  AssistantModelId,
  AssistantWorkerRequest,
  AssistantWorkerResponse,
  ChatTurn,
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
}

let generator: Generator | null = null
let activeModel: AssistantModelId | null = null
let loading: Promise<void> | null = null
let loadingModel: AssistantModelId | null = null

const send = (message: AssistantWorkerResponse) => self.postMessage(message)

async function loadModel(model: AssistantModelId) {
  if (generator && activeModel === model) {
    send({ type: 'ready', model })
    return
  }
  if (loading && loadingModel === model) return loading

  generator = null
  activeModel = null
  loadingModel = model
  loading = (async () => {
    try {
      send({ type: 'loading', model, progress: 0 })
      const transformers = await import(/* @vite-ignore */ TRANSFORMERS_URL)
      transformers.env.allowLocalModels = false
      generator = (await transformers.pipeline('text-generation', MODELS[model], {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: (event: { status?: string; loaded?: number; total?: number }) => {
          if (event.status === 'progress' && event.loaded && event.total) {
            send({ type: 'loading', model, progress: Math.min(1, event.loaded / event.total) })
          }
        },
      })) as Generator
      activeModel = model
      send({ type: 'ready', model })
    } catch (error) {
      generator = null
      activeModel = null
      send({
        type: 'error',
        model,
        message: error instanceof Error ? error.message : 'Model loading failed.',
      })
      throw error
    } finally {
      loading = null
      loadingModel = null
    }
  })()

  return loading
}

function finalText(output: Array<{ generated_text?: string | Array<{ role: string; content: string }> }>) {
  const generated = output[0]?.generated_text
  if (Array.isArray(generated)) return generated.at(-1)?.content ?? ''
  return typeof generated === 'string' ? generated : ''
}

async function answer(model: AssistantModelId, systemPrompt: string, messages: ChatTurn[]) {
  await loadModel(model)
  if (!generator || activeModel !== model) throw new Error('Model unavailable.')

  const output = await generator(
    [{ role: 'system', content: systemPrompt }, ...messages.slice(-6)],
    {
      max_new_tokens: model === 'gemma-270m' ? 220 : 300,
      do_sample: false,
      repetition_penalty: 1.12,
    },
  )
  send({ type: 'done', fallbackText: finalText(output).trim() })
}

self.addEventListener('message', (event: MessageEvent<AssistantWorkerRequest>) => {
  if (event.data.type === 'load') {
    void loadModel(event.data.model)
    return
  }

  void answer(event.data.model, event.data.systemPrompt, event.data.messages).catch((error) => {
    send({
      type: 'error',
      model: event.data.model,
      message: error instanceof Error ? error.message : 'Generation failed.',
    })
  })
})

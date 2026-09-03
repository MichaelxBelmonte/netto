/// <reference lib="webworker" />

import type {
  AssistantWorkerRequest,
  AssistantWorkerResponse,
  ChatTurn,
} from '../lib/assistantWorkerProtocol'

const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
const MODEL_ID = 'onnx-community/gemma-3-270m-it-ONNX'

type Generator = ((
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text?: string | Array<{ role: string; content: string }> }>>) & {
  tokenizer: unknown
}

let generator: Generator | null = null
let loading: Promise<void> | null = null

const send = (message: AssistantWorkerResponse) => self.postMessage(message)

async function loadModel() {
  if (generator) {
    send({ type: 'ready' })
    return
  }
  if (loading) return loading

  loading = (async () => {
    try {
      send({ type: 'loading', progress: 0 })
      // Import remoto fissato: evita di includere i binding Node opzionali nel progetto browser.
      const transformers = await import(/* @vite-ignore */ TRANSFORMERS_URL)
      transformers.env.allowLocalModels = false
      generator = (await transformers.pipeline('text-generation', MODEL_ID, {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: (event: { status?: string; loaded?: number; total?: number }) => {
          if (event.status === 'progress' && event.loaded && event.total) {
            send({
              type: 'loading',
              progress: Math.min(1, event.loaded / event.total),
            })
          }
        },
      })) as Generator
      send({ type: 'ready' })
    } catch (error) {
      generator = null
      loading = null
      send({
        type: 'error',
        message: error instanceof Error ? error.message : 'Model loading failed.',
      })
      throw error
    }
  })()

  return loading
}

function finalText(
  output: Array<{ generated_text?: string | Array<{ role: string; content: string }> }>,
) {
  const generated = output[0]?.generated_text
  if (Array.isArray(generated)) return generated.at(-1)?.content ?? ''
  return typeof generated === 'string' ? generated : ''
}

async function answer(systemPrompt: string, messages: ChatTurn[]) {
  await loadModel()
  if (!generator) throw new Error('Model unavailable.')

  const output = await generator(
    [{ role: 'system', content: systemPrompt }, ...messages.slice(-6)],
    {
      max_new_tokens: 220,
      do_sample: false,
      repetition_penalty: 1.12,

    },
  )
  send({ type: 'done', fallbackText: finalText(output).trim() })
}

self.addEventListener('message', (event: MessageEvent<AssistantWorkerRequest>) => {
  if (event.data.type === 'load') {
    void loadModel()
    return
  }

  void answer(event.data.systemPrompt, event.data.messages).catch((error) => {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : 'Generation failed.',
    })
  })
})

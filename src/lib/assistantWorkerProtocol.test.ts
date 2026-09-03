import { describe, expect, it, vi } from 'vitest'
import {
  createAssistantRequestId,
  isAssistantModelId,
  isAssistantWorkerRequest,
} from './assistantWorkerProtocol'

describe('assistant worker protocol', () => {
  it('accepts complete load and ask requests', () => {
    expect(isAssistantWorkerRequest({
      type: 'load',
      requestId: 'load-1',
      model: 'gemma-270m',
    })).toBe(true)
    expect(isAssistantWorkerRequest({
      type: 'ask',
      requestId: 'ask-1',
      model: 'qwen3.5-0.8b',
      purpose: 'answer',
      systemPrompt: 'Be concise.',
      messages: [{ role: 'user', content: 'Hello' }],
    })).toBe(true)
  })

  it('rejects malformed and unknown requests at the worker boundary', () => {
    expect(isAssistantWorkerRequest(null)).toBe(false)
    expect(isAssistantWorkerRequest({ type: 'load', model: 'gemma-270m' })).toBe(false)
    expect(isAssistantWorkerRequest({
      type: 'ask',
      requestId: 'ask-1',
      model: 'unknown',
      purpose: 'answer',
      systemPrompt: '',
      messages: [],
    })).toBe(false)
    expect(isAssistantWorkerRequest({
      type: 'ask',
      requestId: 'ask-1',
      model: 'qwen2.5-0.5b',
      purpose: 'answer',
      systemPrompt: '',
      messages: [{ role: 'system', content: 'not allowed' }],
    })).toBe(false)
  })

  it('recognizes only supported model identifiers', () => {
    expect(isAssistantModelId('gemma-270m')).toBe(true)
    expect(isAssistantModelId('qwen2.5-0.5b')).toBe(true)
    expect(isAssistantModelId('qwen3.5-0.8b')).toBe(true)
    expect(isAssistantModelId('qwen3.5-0.8B')).toBe(false)
  })

  it('uses random UUIDs for request correlation when available', () => {
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    expect(createAssistantRequestId()).toBe('00000000-0000-4000-8000-000000000001')
    randomUUID.mockRestore()
  })
})

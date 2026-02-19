import { describe, it, expect } from 'bun:test'
import { formatOutput, formatStreamingContent } from '../../../src/streaming/output.formatter.ts'

describe('formatOutput', () => {
  it('returns content in a code block', () => {
    const result = formatOutput('hello world')
    expect(result.content).toContain('hello world')
    expect(result.content).toContain('```')
    expect(result.hasOverflow).toBe(false)
    expect(result.overflow).toBe('')
  })

  it('marks overflow when output exceeds limit', () => {
    const longText = 'x'.repeat(2000)
    const result = formatOutput(longText)
    expect(result.hasOverflow).toBe(true)
    expect(result.overflow.length).toBeGreaterThan(0)
  })

  it('strips ANSI codes from output', () => {
    const result = formatOutput('\u001b[31mred\u001b[0m')
    expect(result.content).not.toContain('\u001b')
    expect(result.content).toContain('red')
  })

  it('accepts a language hint for code fence', () => {
    const result = formatOutput('print("hello")', 'python')
    expect(result.content).toContain('```python')
  })
})

describe('formatStreamingContent', () => {
  it('returns running icon for in-progress', () => {
    const result = formatStreamingContent('output', 'running')
    expect(result).toContain('⏳')
  })

  it('returns done icon for completed', () => {
    const result = formatStreamingContent('output', 'done')
    expect(result).toContain('✅')
  })

  it('returns error icon for errors', () => {
    const result = formatStreamingContent('output', 'error')
    expect(result).toContain('❌')
  })

  it('shows status message for empty output', () => {
    const result = formatStreamingContent('', 'running')
    expect(result).toContain('Running')
    expect(result).not.toContain('```')
  })
})

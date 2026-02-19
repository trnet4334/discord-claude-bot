import { describe, it, expect } from 'bun:test'
import { stripAnsi, cleanOutput } from '../../../src/utils/ansi.ts'

describe('stripAnsi', () => {
  it('removes basic color codes', () => {
    expect(stripAnsi('\u001b[31mred text\u001b[0m')).toBe('red text')
  })

  it('removes bold codes', () => {
    expect(stripAnsi('\u001b[1mbold\u001b[0m')).toBe('bold')
  })

  it('removes cursor movement sequences', () => {
    expect(stripAnsi('\u001b[2J\u001b[H')).toBe('')
  })

  it('preserves newlines', () => {
    expect(stripAnsi('line1\nline2')).toBe('line1\nline2')
  })

  it('preserves tabs', () => {
    expect(stripAnsi('\tindented')).toBe('\tindented')
  })

  it('returns plain text unchanged', () => {
    const plain = 'hello world 123'
    expect(stripAnsi(plain)).toBe(plain)
  })

  it('handles complex nested escape sequences', () => {
    const input = '\u001b[38;5;196mcolored\u001b[0m normal'
    expect(stripAnsi(input)).toBe('colored normal')
  })
})

describe('cleanOutput', () => {
  it('strips ANSI and trims whitespace', () => {
    expect(cleanOutput('  \u001b[31mtext\u001b[0m  ')).toBe('text')
  })

  it('collapses multiple blank lines to one', () => {
    expect(cleanOutput('line1\n\n\n\nline2')).toBe('line1\n\nline2')
  })

  it('handles empty string', () => {
    expect(cleanOutput('')).toBe('')
  })
})

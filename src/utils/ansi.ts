// Matches ANSI escape sequences.
// Second alternative excludes \t (0x09), \n (0x0a), \r (0x0d) from being stripped.
const ANSI_REGEX =
  /[\u001b\u009b](?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

/**
 * Strips ANSI escape codes from a string, preserving newlines (\n) and tabs (\t).
 */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

/**
 * Strips ANSI and normalises whitespace: collapses multiple blank lines to one.
 */
export function cleanOutput(input: string): string {
  return stripAnsi(input).replace(/\n{3,}/g, '\n\n').trim()
}

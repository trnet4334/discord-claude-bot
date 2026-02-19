import { DANGEROUS_PATTERNS } from '../../config/constants.ts'

export interface DangerousCheckResult {
  readonly isDangerous: boolean
  readonly matchedPattern: string | null
}

/**
 * Checks whether a shell command matches any dangerous command patterns.
 */
export function checkDangerous(command: string): DangerousCheckResult {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { isDangerous: true, matchedPattern: pattern.source }
    }
  }
  return { isDangerous: false, matchedPattern: null }
}

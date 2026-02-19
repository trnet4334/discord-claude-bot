import { exec as nodeExec } from 'node:child_process'
import { promisify } from 'node:util'
import { getLogger } from './logger.ts'

const execAsync = promisify(nodeExec)

interface ExecResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

/**
 * Safely executes a shell command with a timeout.
 * Returns stdout, stderr, and exit code without throwing.
 */
export async function safeExec(command: string, timeoutMs = 10_000): Promise<ExecResult> {
  const logger = getLogger()

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (error: unknown) {
    // node's exec throws on non-zero exit with code attached
    if (
      error !== null &&
      typeof error === 'object' &&
      'stdout' in error &&
      'stderr' in error
    ) {
      const e = error as { stdout: string; stderr: string; code?: number }
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
      }
    }

    logger.error('safeExec failed', {
      command,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    }
  }
}

/**
 * Executes a command and throws if it fails.
 */
export async function exec(command: string, timeoutMs = 10_000): Promise<string> {
  const result = await safeExec(command, timeoutMs)
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

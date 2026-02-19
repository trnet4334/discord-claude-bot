/**
 * Maps natural language patterns to module names for chat routing.
 * Patterns are tested against lowercased message content.
 */
export const INTENT_PATTERNS: ReadonlyArray<{ pattern: RegExp; module: string }> = [
  // Claude intents
  { pattern: /\b(ask|tell|send|message)\s+(claude|ai)\b/, module: 'claude' },
  { pattern: /^claude[,:]?\s+/, module: 'claude' },

  // Shell intents
  { pattern: /\b(run|execute|shell)\s+(command|cmd)?\s*:/, module: 'shell' },
  { pattern: /^(run|exec)\s+`/, module: 'shell' },

  // File intents
  { pattern: /\b(read|show|display)\s+(file|the file)\b/, module: 'files' },
  { pattern: /\b(write|create|save)\s+(file|to file)\b/, module: 'files' },
  { pattern: /\b(list|ls)\s+(files|directory|dir)\b/, module: 'files' },

  // System intents
  { pattern: /\b(system|machine|server)\s+(status|info|stats)\b/, module: 'system' },
  { pattern: /\b(show|what is)\s+(cpu|memory|disk|ram)\b/, module: 'system' },
] as const

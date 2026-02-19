/**
 * Formats help text and error messages for natural-language chat responses.
 */
export function formatHelp(): string {
  return [
    '**Discord Claude Bot** — available commands:',
    '',
    '**Slash Commands:**',
    '• `/claude start|send|stop|status|attach`',
    '• `/shell run|history|sessions`',
    '• `/file read|write|list|delete`',
    '• `/system status|ps|df|top`',
    '',
    '**Natural Language:**',
    '• `claude, <message>` — send to active Claude session',
    '• `run: <command>` — execute shell command',
    '• `show file <path>` — read a file',
    '• `system status` — show machine status',
  ].join('\n')
}

export function formatUnknown(): string {
  return "❓ I didn't understand that. Try `/claude`, `/shell`, `/file`, or `/system` — or type `help` for more info."
}

import { describe, it, expect } from 'bun:test'

// Set env vars before importing the guard
process.env['DISCORD_TOKEN'] = 'test-token'
process.env['DISCORD_APPLICATION_ID'] = 'test-app-id'
process.env['DISCORD_GUILD_ID'] = 'test-guild-id'
process.env['ALLOWED_USER_ID'] = 'allowed-user-123'

// Dynamic import to ensure env is set first
const { authGuard } = await import('../../../src/guards/auth.guard.ts')

describe('AuthGuard', () => {
  it('allows the configured user ID', () => {
    expect(authGuard.isAllowed('allowed-user-123')).toBe(true)
  })

  it('denies any other user ID', () => {
    expect(authGuard.isAllowed('random-user-456')).toBe(false)
  })

  it('denies empty string', () => {
    expect(authGuard.isAllowed('')).toBe(false)
  })

  it('assertAllowed does not throw for allowed user', () => {
    expect(() => authGuard.assertAllowed('allowed-user-123')).not.toThrow()
  })

  it('assertAllowed throws for denied user', () => {
    expect(() => authGuard.assertAllowed('attacker-999')).toThrow('Access denied')
  })
})

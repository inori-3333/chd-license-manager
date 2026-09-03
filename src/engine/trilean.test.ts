import { describe, expect, it } from 'vitest'
import { and, or } from './trilean'

describe('三值逻辑', () => {
  it('AND 真值表', () => {
    expect(and('true', 'true')).toBe('true')
    expect(and('false', 'unknown')).toBe('false')
    expect(and('true', 'unknown')).toBe('unknown')
    expect(and('unknown', 'unknown')).toBe('unknown')
  })
  it('OR 真值表', () => {
    expect(or('true', 'unknown')).toBe('true')
    expect(or('false', 'unknown')).toBe('unknown')
    expect(or('false', 'false')).toBe('false')
  })
})

import { describe, it, expect } from 'vitest'
import { extractFromText } from '../../src/main/claude-usage'

describe('extractFromText', () => {
  it('returns all nulls when page has no usage data', () => {
    const result = extractFromText('Sign in to Claude\nGet started with AI')
    expect(result.session).toBeNull()
    expect(result.weeklyLimits).toBeNull()
    expect(result.extra).toBeNull()
  })

  it('parses a single percent-used value as session data', () => {
    const text = 'Current session\n42% used\nResets in 2 hours'
    const result = extractFromText(text)
    expect(result.session).toEqual({ percentUsed: 42, resetLabel: '2 hours' })
    expect(result.weeklyLimits).toBeNull()
  })

  it('parses session + weekly all-models limit', () => {
    const text = [
      'Current session',
      '30% used',
      'Resets in 1 hour',
      'All models (weekly)',
      '65% used',
      'Resets in 3 days',
    ].join('\n')
    const result = extractFromText(text)
    expect(result.session).toEqual({ percentUsed: 30, resetLabel: '1 hour' })
    expect(result.weeklyLimits?.allModels).toEqual({ percentUsed: 65, resetLabel: '3 days' })
    expect(result.weeklyLimits?.sonnetOnly).toEqual({ percentUsed: 0, resetLabel: '' })
  })

  it('parses all three percent values including sonnet-only limit', () => {
    const text = [
      'Current session',
      '20% used',
      'Resets in 30 minutes',
      'All models',
      '50% used',
      'Resets in 5 days',
      'Sonnet only',
      '80% used',
      'Resets in 2 days',
    ].join('\n')
    const result = extractFromText(text)
    expect(result.session?.percentUsed).toBe(20)
    expect(result.weeklyLimits?.allModels.percentUsed).toBe(50)
    expect(result.weeklyLimits?.sonnetOnly.percentUsed).toBe(80)
    expect(result.weeklyLimits?.sonnetOnly.resetLabel).toBe('2 days')
  })

  it('parses extra dollar amounts when present', () => {
    const text = [
      '10% used',
      '$12.50 spent',
      '$50.00 Monthly limit',
      '$37.50 remaining',
    ].join('\n')
    const result = extractFromText(text)
    expect(result.extra).toEqual({ dollarsSpent: 12.5, monthlyLimit: 50, balance: 37.5 })
  })

  it('calculates balance from spent/monthly when remaining is absent', () => {
    const text = [
      '10% used',
      '$5.00 spent',
      '$20.00 monthly',
    ].join('\n')
    const result = extractFromText(text)
    expect(result.extra?.balance).toBe(15)
  })

  it('handles "of limit used" phrasing', () => {
    const text = '55% of limit used\nResets in 1 day'
    const result = extractFromText(text)
    expect(result.session?.percentUsed).toBe(55)
  })

  it('handles 0% without treating as empty', () => {
    const text = '0% used\nResets in 5 days'
    const result = extractFromText(text)
    expect(result.session?.percentUsed).toBe(0)
  })

  it('handles 100% usage', () => {
    const text = '100% used\nResets in 1 hour'
    const result = extractFromText(text)
    expect(result.session?.percentUsed).toBe(100)
  })

  it('returns empty resetLabel when no reset text is found', () => {
    const text = '75% used'
    const result = extractFromText(text)
    expect(result.session).toEqual({ percentUsed: 75, resetLabel: '' })
  })

  it('handles "Reset in" (singular) as well as "Resets in"', () => {
    const text = '40% used\nReset in 4 hours'
    const result = extractFromText(text)
    expect(result.session?.resetLabel).toBe('4 hours')
  })

  it('parses only spent amount with no monthly limit', () => {
    const text = [
      '25% used',
      '$8.00 spent',
    ].join('\n')
    const result = extractFromText(text)
    expect(result.extra?.dollarsSpent).toBe(8)
    expect(result.extra?.monthlyLimit).toBe(0)
    expect(result.extra?.balance).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { parseUltrasonicPayload } from '../wsPayload'

const toChartValues = (raw: string): number[] | null => {
  const parsed = parseUltrasonicPayload(raw)
  return parsed ? [parsed.cm, parsed.inch] : null
}

describe('parseUltrasonicPayload', () => {
  it('maps valid ultrasonic payload to expected chart values [cm, inch]', () => {
    expect(toChartValues('{"type":"ultrasonic","cm":10.5,"inch":4.13}')).toEqual([10.5, 4.13])
  })

  it('handles invalid payload safely without crash', () => {
    expect(() => toChartValues('not-json')).not.toThrow()
    expect(toChartValues('not-json')).toBeNull()
  })

  it('returns null for non-ultrasonic payload', () => {
    expect(parseUltrasonicPayload('{"type":"led","state":"on"}')).toBeNull()
  })

  it('returns null when required numeric fields are missing', () => {
    expect(parseUltrasonicPayload('{"type":"ultrasonic","cm":"10"}')).toBeNull()
  })
})

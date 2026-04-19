import { describe, expect, it } from 'vitest'
import { parseUltrasonicPayload } from '../wsPayload'

describe('parseUltrasonicPayload', () => {
  it('parses valid ultrasonic payload', () => {
    expect(parseUltrasonicPayload('{"type":"ultrasonic","cm":10.5,"inch":4.13}')).toEqual({
      type: 'ultrasonic',
      cm: 10.5,
      inch: 4.13,
    })
  })

  it('returns null for non-ultrasonic payload', () => {
    expect(parseUltrasonicPayload('{"type":"led","state":"on"}')).toBeNull()
  })

  it('returns null when required numeric fields are missing', () => {
    expect(parseUltrasonicPayload('{"type":"ultrasonic","cm":"10"}')).toBeNull()
  })

  it('returns null for invalid json', () => {
    expect(parseUltrasonicPayload('not-json')).toBeNull()
  })
})

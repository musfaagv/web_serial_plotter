export interface UltrasonicPayload {
  type: 'ultrasonic'
  cm: number
  inch: number
}

export function parseUltrasonicPayload(raw: string): UltrasonicPayload | null {
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    const type = (parsed as { type?: unknown }).type
    const cm = (parsed as { cm?: unknown }).cm
    const inch = (parsed as { inch?: unknown }).inch

    if (type !== 'ultrasonic') return null
    if (!Number.isFinite(cm) || !Number.isFinite(inch)) return null

    return {
      type: 'ultrasonic',
      cm: Number(cm),
      inch: Number(inch),
    }
  } catch {
    return null
  }
}

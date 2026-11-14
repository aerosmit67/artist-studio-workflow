import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_PRESETS } from '@/studio/lib/db'

describe('juried-show presets', () => {
  it('ZAPP is 1920×1920 square fill, JPEG under 5MB', () => {
    const z = DEFAULT_EXPORT_PRESETS.find((p) => p.id === 'preset-zapp')!
    expect([z.width, z.height, z.fit, z.format, z.maxBytes]).toEqual([1920, 1920, 'pad', 'jpeg', 5 * 1024 * 1024])
  })
  it('CaFÉ is 1920px longest side, high-quality JPEG', () => {
    const c = DEFAULT_EXPORT_PRESETS.find((p) => p.id === 'preset-cafe')!
    expect([c.width, c.height, c.fit, c.format]).toEqual([1920, 1920, 'contain', 'jpeg'])
    expect(c.quality).toBeGreaterThanOrEqual(0.9)
  })
})

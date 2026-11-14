import { describe, expect, it } from 'vitest'
import { centerCrop, sizeFor, SIZE_SET, RATIO_SET } from '@/studio/lib/sizes'

describe('final size set', () => {
  it('has thumbnail, small, medium, large in square, portrait, landscape', () => {
    expect(SIZE_SET.map((s) => s.id)).toEqual(['thumb', 'small', 'medium', 'large'])
    expect(RATIO_SET.map((r) => r.id)).toEqual(['square', 'portrait', 'landscape'])
  })
  it('portrait 4:5 large is 1920x2400', () => expect(sizeFor(2400, 4, 5)).toEqual({ width: 1920, height: 2400 }))
  it('landscape 3:2 small is 800x533', () => expect(sizeFor(800, 3, 2)).toEqual({ width: 800, height: 533 }))
  it('square crop of a 3000x2000 photo is centered', () =>
    expect(centerCrop(3000, 2000, 1, 1)).toEqual({ x: 500, y: 0, w: 2000, h: 2000 }))
})

// Final-piece size set: every size in every ratio, center-cropped.
export const SIZE_SET = [
  { id: 'thumb', label: 'Thumbnail', longEdge: 300 },
  { id: 'small', label: 'Small', longEdge: 800 },
  { id: 'medium', label: 'Medium', longEdge: 1600 },
  { id: 'large', label: 'Large', longEdge: 2400 },
] as const

export const RATIO_SET = [
  { id: 'square', label: 'Square 1:1', w: 1, h: 1 },
  { id: 'portrait', label: 'Portrait 4:5', w: 4, h: 5 },
  { id: 'landscape', label: 'Landscape 3:2', w: 3, h: 2 },
] as const

/** Output pixel size for a long edge and ratio. */
export function sizeFor(longEdge: number, rw: number, rh: number): { width: number; height: number } {
  if (rw >= rh) return { width: longEdge, height: Math.round((longEdge * rh) / rw) }
  return { width: Math.round((longEdge * rw) / rh), height: longEdge }
}

/** Centered crop rectangle (in source pixels) matching the target ratio. */
export function centerCrop(sw: number, sh: number, rw: number, rh: number) {
  const target = rw / rh
  if (sw / sh > target) {
    const w = Math.round(sh * target)
    return { x: Math.round((sw - w) / 2), y: 0, w, h: sh }
  }
  const h = Math.round(sw / target)
  return { x: 0, y: Math.round((sh - h) / 2), w: sw, h }
}

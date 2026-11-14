// Pure helpers: money/payout math, CSV + downloads, HEIC decoding,
// canvas image processing, and the local AI drafting engine (grounded only
// in record fields — no provider is wired; see conceptImageHook).
import type {
  Adjustments,
  ExportPreset,
  Piece,
  Profile,
  Series,
} from './types'
import { PHOTO_PRESETS } from './types'

// --- Money & payouts (PRD §17 decision 9) ---

export function money(n: number | null | undefined, currency = 'USD'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
}

/** Expected artist payout = retail × (1 − commission%). */
export function expectedPayout(retail: number, commissionPct: number): number {
  return Math.max(0, retail * (1 - commissionPct / 100))
}

/** Sale payout after discount, commission, and fees. */
export function saleExpectedPayout(
  salePrice: number,
  discount: number,
  commissionPct: number,
  fees: number,
): number {
  return Math.max(0, (salePrice - discount) * (1 - commissionPct / 100) - fees)
}

// --- Downloads & CSV ---

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// --- HEIC handling (PRD §17 decision 6) ---

export function isHeicFile(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase()
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

export function isImageFile(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name)
}

/** Decode a HEIC/HEIF blob on-device to JPEG. Returns null when the browser
 *  cannot decode it — the caller keeps the master and shows a notice. */
export async function decodeHeic(blob: Blob): Promise<Blob | null> {
  try {
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })
    const first = Array.isArray(out) ? out[0] : out
    return first instanceof Blob ? first : null
  } catch {
    return null
  }
}

// --- Canvas image processing (Photo Lab) ---

/** CSS filter string for a set of adjustments. This is a starting point for
 *  color, not a calibration guarantee (PRD §6). */
export function filterString(a: Adjustments): string {
  const parts: string[] = []
  parts.push(`brightness(${(1 + a.exposure).toFixed(3)})`)
  parts.push(`contrast(${(1 + a.contrast).toFixed(3)})`)
  parts.push(`saturate(${(1 + a.saturation).toFixed(3)})`)
  if (a.warmth !== 0) {
    if (a.warmth > 0) parts.push(`sepia(${(a.warmth * 0.45).toFixed(3)})`)
    parts.push(`hue-rotate(${(a.warmth * 14).toFixed(1)}deg)`)
  }
  return parts.join(' ')
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

/** Render an image with adjustments to a canvas (used by the Photo Lab
 *  preview). The source image is never modified. */
export function renderAdjustedCanvas(
  img: HTMLImageElement,
  a: Adjustments,
  maxDim: number,
): HTMLCanvasElement {
  return drawAdjusted(img, a, maxDim)
}

function drawAdjusted(
  img: HTMLImageElement,
  a: Adjustments,
  maxDim: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const rot = ((a.rotation % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.filter = filterString(a)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  if (rot) ctx.rotate((rot * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return canvas
}

/** Render a working copy (display/edit size, max 2000px) from a source blob. */
export async function makeWorkingCopy(source: Blob, maxDim = 2000): Promise<Blob> {
  const img = await loadImage(source)
  const canvas = drawAdjusted(img, { exposure: 0, warmth: 0, contrast: 0, saturation: 0, rotation: 0, preset: 'none' }, maxDim)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Could not create working copy')
  return blob
}

/** Export one photo with adjustments applied, fitted inside a preset box. */
export async function exportPhoto(
  source: Blob,
  a: Adjustments,
  preset: ExportPreset,
): Promise<Blob> {
  const img = await loadImage(source)
  const canvas = drawAdjusted(img, a, Math.max(preset.width, preset.height, img.naturalWidth, img.naturalHeight))
  const fit = preset.fit ?? 'contain'
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.imageSmoothingQuality = 'high'
  if (fit === 'contain') {
    const scale = Math.min(preset.width / canvas.width, preset.height / canvas.height, 1)
    out.width = Math.max(1, Math.round(canvas.width * scale))
    out.height = Math.max(1, Math.round(canvas.height * scale))
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
  } else {
    out.width = preset.width
    out.height = preset.height
    if (fit === 'pad') {
      ctx.fillStyle = preset.padColor || '#000000'
      ctx.fillRect(0, 0, out.width, out.height)
      const scale = Math.min(preset.width / canvas.width, preset.height / canvas.height)
      const w = canvas.width * scale, h = canvas.height * scale
      ctx.drawImage(canvas, (out.width - w) / 2, (out.height - h) / 2, w, h)
    } else {
      const scale = Math.max(preset.width / canvas.width, preset.height / canvas.height)
      const sw = preset.width / scale, sh = preset.height / scale
      ctx.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, out.width, out.height)
    }
  }
  const mime =
    preset.format === 'png' ? 'image/png' : preset.format === 'webp' ? 'image/webp' : 'image/jpeg'
  let q = preset.quality
  for (;;) {
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, mime, q))
    if (!blob) throw new Error('Could not export image')
    // Step quality down until the file fits the size limit (JPEG/WebP only).
    if (!preset.maxBytes || blob.size <= preset.maxBytes || mime === 'image/png' || q <= 0.4) return blob
    q = Math.round((q - 0.05) * 100) / 100
  }
}

export function presetById(id: string) {
  return PHOTO_PRESETS.find((p) => p.id === id) ?? null
}

// --- Local AI drafting engine (PRD §8.5) ---
// Templates grounded ONLY in the piece/series/profile record fields.
// Every output is labeled a suggestion; nothing is saved to records
// automatically and nothing is published.

function pieceFacts(piece: Piece, series: Series | null, profile: Profile | null): string[] {
  const facts: string[] = []
  if (piece.title) facts.push(`titled “${piece.title}”`)
  if (series?.name) facts.push(`from the ${series.name} series`)
  if (piece.medium) facts.push(`in ${piece.medium}`)
  if (piece.dimensions) facts.push(`${piece.dimensions}`)
  if (piece.materials) facts.push(`made with ${piece.materials}`)
  if (series?.clayBody) facts.push(`in ${series.clayBody} clay`)
  if (series?.glaze) facts.push(`finished with ${series.glaze}`)
  if (piece.retailPrice !== null && piece.retailPrice !== undefined)
    facts.push(`priced at ${money(piece.retailPrice, piece.currency || profile?.currency || 'USD')}`)
  return facts
}

export function draftTitle(piece: Piece, series: Series | null): string[] {
  const base = piece.title || 'Untitled piece'
  const out = [base]
  if (series?.name) out.push(`${base} — ${series.name}`)
  if (piece.materials) out.push(`${base} (${piece.materials})`)
  if (series?.glaze) out.push(`${base} · ${series.glaze}`)
  return [...new Set(out)]
}

export function draftDescription(piece: Piece, series: Series | null, profile: Profile | null): string {
  const facts = pieceFacts(piece, series, profile)
  const who = profile?.brand ? `From ${profile.brand}` : ''
  const lines: string[] = []
  lines.push(`${piece.title || 'Untitled piece'}${series?.name ? `, part of the ${series.name} series` : ''}.`)
  if (facts.length > 1) lines.push(`This piece is ${facts.slice(1).join(', ')}.`)
  if (series?.concept) lines.push(series.concept)
  if (piece.notes) lines.push(piece.notes)
  if (who) lines.push(who + (profile?.location ? `, ${profile.location}` : '') + '.')
  return lines.join(' ')
}

export function draftStatement(series: Series | null, profile: Profile | null): string {
  const name = profile?.name || 'The artist'
  const brand = profile?.brand || ''
  const medium = series?.medium === 'painting' ? 'painting' : 'hand-built ceramics'
  const parts: string[] = []
  parts.push(
    `${name}${brand ? ` (${brand})` : ''} works in ${medium}${series?.name ? `, most recently in the ${series.name} series` : ''}.`,
  )
  if (series?.concept) parts.push(series.concept)
  if (series?.clayBody || series?.glaze) {
    parts.push(
      `The work is made${series.clayBody ? ` in ${series.clayBody}` : ''}${series.glaze ? ` and finished with ${series.glaze}` : ''}, with seams and texture left visible as part of the piece.`,
    )
  }
  parts.push('Each piece is one of a kind, documented from first idea to finished photograph.')
  return parts.join(' ')
}

export function draftCaption(
  piece: Piece,
  series: Series | null,
  profile: Profile | null,
  destination: string,
): string {
  const lines: string[] = []
  lines.push(`${piece.title || 'New work'}${series?.name ? ` — ${series.name}` : ''}`)
  const details: string[] = []
  if (piece.medium) details.push(piece.medium)
  if (piece.dimensions) details.push(piece.dimensions)
  if (series?.clayBody) details.push(`${series.clayBody} clay`)
  if (series?.glaze) details.push(series.glaze)
  if (details.length) lines.push(details.join(' · '))
  if (piece.notes) lines.push(piece.notes)
  if (profile?.brand) lines.push(profile.brand)
  lines.push(`#${(profile?.brand || 'ceramics').replace(/[^A-Za-z0-9]+/g, '')} #handbuilt #ceramics`)
  if (destination.toLowerCase().includes('instagram')) lines.push('Link in bio.')
  return lines.join('\n')
}

export function draftBrainstorm(series: Series | null, profile: Profile | null): string {
  const theme = series?.name || 'a new series'
  const ideas = [
    `Keep building on ${theme}: vary the scale of one form across three pieces and photograph them together.`,
    `Try a contrasting finish on the next piece in ${theme} and compare the two side by side in the Photo Lab.`,
    `Write a one-line story for each piece in ${theme} — where it would live in a home — and use it as the listing caption.`,
    `Photograph the work-in-progress at the joining stage; the visible seams are part of the story for ${profile?.brand || 'the studio'}.`,
  ]
  if (series?.concept) ideas.push(`Series concept to explore further: ${series.concept}`)
  return ideas.join('\n\n')
}

// --- Concept images (PRD §8.5, §17 open item 5) ---
// No AI provider is wired yet. This hook is where a provider plugs in:
// implement `generateConceptImage` to call the chosen image model and
// return a Blob; until then the UI explains that and stays disabled.
export interface ConceptImageResult {
  configured: false
  message: string
}

export function conceptImageHook(): ConceptImageResult {
  return {
    configured: false,
    message:
      'No image provider is connected yet. The PRD leaves the AI provider open — once one is chosen, wire it into the generateConceptImage hook in src/lib/utils.ts and this button will produce labeled concept images.',
  }
}

// --- Final-piece size set (thumbnail/small/medium/large × square/portrait/landscape) ---
import { RATIO_SET, SIZE_SET, centerCrop, sizeFor } from './sizes'

/** Render every size × ratio of one photo (adjustments applied, center-cropped)
 *  and return a ZIP. Sources smaller than a target are never upscaled. */
export async function exportSizeSet(source: Blob, a: Adjustments, baseName: string): Promise<Blob> {
  const { zipSync } = await import('fflate')
  const img = await loadImage(source)
  const full = drawAdjusted(img, a, Math.max(img.naturalWidth, img.naturalHeight))
  const files: Record<string, Uint8Array> = {}
  for (const r of RATIO_SET) {
    const crop = centerCrop(full.width, full.height, r.w, r.h)
    for (const s of SIZE_SET) {
      const want = sizeFor(s.longEdge, r.w, r.h)
      const k = Math.min(1, crop.w / want.width)
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(want.width * k))
      c.height = Math.max(1, Math.round(want.height * k))
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(full, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height)
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88))
      if (!blob) throw new Error('Could not export image')
      files[`${baseName}/${r.id}/${baseName}-${r.id}-${s.id}-${c.width}x${c.height}.jpg`] = new Uint8Array(await blob.arrayBuffer())
    }
  }
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' })
}

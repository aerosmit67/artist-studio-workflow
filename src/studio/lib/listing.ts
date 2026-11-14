// Listing pack text + hashtags (PRD §8.8). Built only from record fields.
import type { Piece, Profile, Series } from './types'

export type ListingDestination = 'instagram' | 'etsy' | 'website'

const tag = (s: string) => '#' + s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function hashtagsFor(piece: Piece, series: Series | null, dest: ListingDestination): string[] {
  const out: string[] = []
  if (piece.medium === 'ceramics') out.push('ceramics', 'handmadeceramics', 'handbuilt', 'slabbuilt', 'contemporaryceramics')
  else if (piece.medium === 'painting') out.push('painting', 'originalart', 'contemporarypainting')
  else out.push('handmade', 'originalart')
  if (series?.name) out.push(series.name)
  if (series?.clayBody) out.push(series.clayBody)
  if (series?.glaze) out.push(series.glaze)
  if (series?.firing) out.push(series.firing)
  for (const m of piece.materials.split(/[,;/]/).map((s) => s.trim()).filter(Boolean).slice(0, 3)) out.push(m)
  if (dest === 'instagram') out.push('artistsoninstagram', 'studiolife')
  if (dest === 'etsy') out.push('etsyhandmade', 'uniquegift')
  const tags = [...new Set(out.map(tag).filter((t) => t.length > 2 && t.length < 32))]
  return tags.slice(0, dest === 'etsy' ? 13 : 20)
}

export function listingText(piece: Piece, series: Series | null, profile: Profile | null, dest: ListingDestination, description: string): string {
  const lines: string[] = []
  lines.push(piece.title || 'Untitled')
  if (series?.name) lines.push(`Series: ${series.name}`)
  const details: string[] = []
  if (piece.dimensions) details.push(`Dimensions: ${piece.dimensions}`)
  if (piece.weight) details.push(`Weight: ${piece.weight}`)
  if (piece.materials) details.push(`Materials: ${piece.materials}`)
  if (series?.clayBody) details.push(`Clay body: ${series.clayBody}`)
  if (series?.glaze) details.push(`Glaze: ${series.glaze}`)
  if (series?.firing) details.push(`Firing: ${series.firing}`)
  if (series?.finish) details.push(`Finish: ${series.finish}`)
  if (dest !== 'instagram' && piece.retailPrice !== null) details.push(`Price: ${piece.retailPrice} ${piece.currency || profile?.currency || 'USD'}`)
  if (details.length) lines.push('', ...details)
  if (description.trim()) lines.push('', description.trim())
  if (profile?.statement && dest !== 'instagram') lines.push('', `About the artist: ${profile.statement}`)
  lines.push('', `Inventory #${piece.inventoryNumber}`)
  const tags = hashtagsFor(piece, series, dest)
  if (dest === 'etsy') lines.push('', `Tags: ${tags.map((t) => t.slice(1)).join(', ')}`)
  else lines.push('', tags.join(' '))
  return lines.join('\n')
}

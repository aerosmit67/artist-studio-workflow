// Core data model for the Artist Studio Workflow app (MVP 1).
// Decisions folded in from the PRD review, Nov 13, 2026 (§17).

export type Medium = 'ceramics' | 'painting' | 'other'

export const MEDIUM_LABELS: Record<Medium, string> = {
  ceramics: 'Ceramics',
  painting: 'Painting',
  other: 'Other',
}

// Slab-built ceramic stages (the pilot's work is hand-built, not wheel-thrown).
export const CERAMIC_STAGES = [
  'idea',
  'slab prep',
  'forming',
  'joining',
  'drying',
  'bisque',
  'glazing',
  'glaze firing',
  'finished',
  'packed',
] as const

export const PAINTER_STAGES = ['sketch', 'underpainting', 'work in progress', 'finished'] as const

export const DEFAULT_LOCATIONS = [
  'Studio',
  'Home inventory',
  'Gallery',
  'Event / fair',
  'Shipped',
  'Reserved',
  'Sold',
  'Returned',
] as const

export type PhotoCategory = 'raw' | 'optimized' | 'edited' | 'final'

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  raw: 'Raw / original',
  optimized: 'Optimized',
  edited: 'Edited',
  final: 'Final / approved',
}

export interface Adjustments {
  exposure: number // -1..1  (brightness)
  warmth: number // -1..1  (white balance: negative = cooler, positive = warmer)
  contrast: number // -1..1
  saturation: number // -1..1
  rotation: number // degrees, steps of 90
  preset: string // preset id or 'none' / 'custom'
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  warmth: 0,
  contrast: 0,
  saturation: 0,
  rotation: 0,
  preset: 'none',
}

export interface PhotoPresetDef {
  id: string
  name: string
  description: string
  adjustments: Omit<Adjustments, 'preset'>
}

// Named one-tap presets the artist picks from (PRD §17 decision 7).
export const PHOTO_PRESETS: PhotoPresetDef[] = [
  {
    id: 'true-color',
    name: 'True Color',
    description: 'Neutral light: gentle lift, no warmth shift. Closest to the clay as it looks in the studio.',
    adjustments: { exposure: 0.08, warmth: 0, contrast: 0.05, saturation: 0.02, rotation: 0 },
  },
  {
    id: 'bright-daylight',
    name: 'Bright Daylight',
    description: 'Lifts shadows and cools slightly, for photos taken in warm indoor light.',
    adjustments: { exposure: 0.18, warmth: -0.18, contrast: 0.1, saturation: 0.05, rotation: 0 },
  },
  {
    id: 'warm-gallery',
    name: 'Warm Gallery',
    description: 'Warm, soft finish for gallery and website listings.',
    adjustments: { exposure: 0.1, warmth: 0.25, contrast: 0.08, saturation: 0.08, rotation: 0 },
  },
  {
    id: 'soft-matte',
    name: 'Soft Matte',
    description: 'Lowers contrast and saturation for the weathered, matte look of hand-built work.',
    adjustments: { exposure: 0.05, warmth: 0.05, contrast: -0.15, saturation: -0.12, rotation: 0 },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Punchy contrast for social posts where the piece needs to stand out.',
    adjustments: { exposure: 0.05, warmth: 0, contrast: 0.25, saturation: 0.15, rotation: 0 },
  },
]

export interface Profile {
  id: 'artist'
  name: string
  brand: string
  location: string
  statement: string
  currency: string
  timezone: string
  primaryMedium: Medium
  ceramicStages: string[]
  painterStages: string[]
}

export interface Series {
  id: string
  name: string
  concept: string
  notes: string
  medium: Medium
  // Ceramics shared fields
  clayBody: string
  glaze: string
  firing: string
  finish: string
  // Painter shared fields
  paintMedium: string
  support: string
  palette: string
  processNotes: string
  pricingGuidance: string
  archived: boolean
  createdAt: number
}

export interface Piece {
  id: string
  inventoryNumber: string
  title: string
  seriesId: string | null
  medium: Medium
  status: string // free-form, artist-only changes
  stage: string
  dimensions: string
  weight: string
  materials: string
  notes: string
  createdDate: string // YYYY-MM-DD
  location: string
  availableOnline: boolean
  onlineOverride: boolean
  retailPrice: number | null
  wholesalePrice: number | null
  minPrice: number | null
  currency: string
  // Editions: one record per edition, with size + sold count.
  edition: boolean
  editionSize: number | null
  editionSold: number
  costBasis: number | null
  archived: boolean
  createdAt: number
  updatedAt: number
}

export interface Milestone {
  id: string
  pieceId: string
  date: string // YYYY-MM-DD
  stage: string
  notes: string
  timeMinutes: number | null
  clayWeight: string
  glazeCost: number | null
  otherCosts: string
  createdAt: number
}

export interface Photo {
  id: string
  pieceId: string | null
  seriesId: string | null
  stage: string
  caption: string
  category: PhotoCategory
  master: Blob
  masterName: string
  masterType: string
  // On-device decoded JPEG working copy (HEIC masters) or a downscaled
  // JPEG working copy (other formats). Null when no working copy exists.
  workingCopy: Blob | null
  workingCopyNote: string | null
  adjustments: Adjustments
  processingHistory: string[]
  finalApproved: boolean
  createdAt: number
}

export interface OutboxItem {
  id: string
  file: Blob
  fileName: string
  fileType: string
  pieceId: string | null
  seriesId: string | null
  stage: string
  note: string
  status: 'queued' | 'syncing' | 'failed'
  error: string | null
  createdAt: number
}

export interface Partner {
  id: string
  name: string
  kind: string // Gallery, Shop, Event, Other
  contact: string
  email: string
  phone: string
  commissionPct: number
  paymentTerms: string
  notes: string
  archived: boolean
  createdAt: number
}

export interface Placement {
  id: string
  partnerId: string
  deliveryDate: string
  returnDate: string
  status: 'active' | 'closed'
  notes: string
  createdAt: number
}

export interface PlacementItem {
  id: string
  placementId: string
  pieceId: string
  retailPrice: number
  commissionPct: number
  expectedPayout: number
  status: 'held' | 'returned' | 'sold'
}

export interface Sale {
  id: string
  pieceId: string
  placementId: string | null
  channel: string
  date: string
  salePrice: number
  discount: number
  commissionPct: number
  fees: number
  expectedPayout: number
  actualPayout: number | null
  actualPayoutDate: string | null
  status: 'expected' | 'confirmed' | 'received'
  notes: string
  createdAt: number
}

export interface HistoryEvent {
  id: string
  pieceId: string
  date: number
  kind: 'status' | 'location' | 'stage'
  from: string
  to: string
  note: string
}

export interface ExportPreset {
  id: string
  name: string
  purpose: 'jury' | 'web' | 'social'
  width: number
  height: number
  format: 'jpeg' | 'png' | 'webp'
  quality: number // 0..1
}

export interface AIOutput {
  id: string
  kind: 'title' | 'description' | 'statement' | 'caption' | 'brainstorm' | 'concept'
  prompt: string
  output: string
  pieceId: string | null
  seriesId: string | null
  createdAt: number
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

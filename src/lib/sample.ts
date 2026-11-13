// Clearly-labeled sample data. The workspace ships EMPTY; the user can
// choose to load this from Settings, and it is fully removable.
// Sample record ids are tracked in localStorage so clearing removes exactly
// what was loaded — never real artwork.
import { makeWorkingCopy } from './utils'
import type { Milestone, Partner, Photo, Piece, Placement, PlacementItem, Series } from './types'
import { todayISO, uid } from './types'

const SAMPLE_KEY = 'asw-sample-ids'

export interface SampleRef {
  store: string
  id: string
}

export function sampleRefs(): SampleRef[] {
  try {
    return JSON.parse(localStorage.getItem(SAMPLE_KEY) ?? '[]') as SampleRef[]
  } catch {
    return []
  }
}

export function setSampleRefs(refs: SampleRef[]): void {
  localStorage.setItem(SAMPLE_KEY, JSON.stringify(refs))
}

export function clearSampleIds(): void {
  localStorage.removeItem(SAMPLE_KEY)
}

/** A simple generated artwork photo (canvas, no binary assets). */
async function sampleImageBlob(seed: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1000
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  const hue = seed % 2 === 0 ? 18 : 32
  const grad = ctx.createLinearGradient(0, 0, 0, 1000)
  grad.addColorStop(0, `hsl(${hue}, 45%, 88%)`)
  grad.addColorStop(1, `hsl(${hue}, 40%, 72%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 800, 1000)
  // shelf line
  ctx.fillStyle = 'rgba(90, 60, 40, 0.55)'
  ctx.fillRect(80, 780, 640, 10)
  // vessel body
  ctx.fillStyle = seed % 2 === 0 ? '#b4552d' : '#5d6b52'
  ctx.beginPath()
  ctx.ellipse(400, 560, 190, 220, 0, 0, Math.PI * 2)
  ctx.fill()
  // neck + rim
  ctx.fillRect(330, 300, 140, 130)
  ctx.beginPath()
  ctx.ellipse(400, 300, 120, 26, 0, 0, Math.PI * 2)
  ctx.fill()
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.ellipse(340, 500, 45, 130, 0.15, 0, Math.PI * 2)
  ctx.fill()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Could not generate sample image')
  return blob
}

export interface SampleBundle {
  series: Series[]
  pieces: Piece[]
  milestones: Milestone[]
  partners: Partner[]
  placements: Placement[]
  placementItems: PlacementItem[]
  photos: Photo[]
}

export async function buildSampleData(currency: string): Promise<SampleBundle> {
  const now = Date.now()
  const series1: Series = {
    id: uid(),
    name: 'Sample — Garden Totems',
    concept: 'Sample data: stacked hand-built forms for the garden, with visible seams.',
    notes: 'Loaded from Settings as clearly-labeled sample data. Delete it any time.',
    medium: 'ceramics',
    clayBody: 'Speckled buff stoneware',
    glaze: 'Matte cream with iron speckles',
    firing: 'Cone 6, oxidation',
    finish: 'Matte, weathered',
    paintMedium: '',
    support: '',
    palette: '',
    processNotes: '',
    pricingGuidance: 'Vases $350–$450',
    archived: false,
    createdAt: now,
  }
  const series2: Series = {
    id: uid(),
    name: 'Sample — Field Studies',
    concept: 'Sample data: small paintings from the field.',
    notes: 'Loaded from Settings as clearly-labeled sample data.',
    medium: 'painting',
    clayBody: '',
    glaze: '',
    firing: '',
    finish: '',
    paintMedium: 'Oil',
    support: 'Linen panel',
    palette: 'Ochre, sage, slate',
    processNotes: 'Plein air, one session each',
    pricingGuidance: '$200–$400',
    archived: false,
    createdAt: now,
  }
  const piece1: Piece = {
    id: uid(),
    inventoryNumber: 'SMP-2026-001',
    title: 'Sample — Armful Vase',
    seriesId: series1.id,
    medium: 'ceramics',
    status: 'In progress',
    stage: 'glazing',
    dimensions: '14 × 9 × 9 in',
    weight: '4.5 lb',
    materials: 'Speckled buff stoneware, matte cream glaze',
    notes: 'Sample piece. Second glaze coat pending.',
    createdDate: todayISO(),
    location: 'Studio',
    availableOnline: true,
    onlineOverride: false,
    retailPrice: 425,
    wholesalePrice: null,
    minPrice: 350,
    currency,
    edition: false,
    editionSize: null,
    editionSold: 0,
    costBasis: 38,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  const piece2: Piece = {
    id: uid(),
    inventoryNumber: 'SMP-2026-002',
    title: 'Sample — Gossip Column',
    seriesId: series1.id,
    medium: 'ceramics',
    status: 'Finished',
    stage: 'finished',
    dimensions: '20 × 6 × 7 in',
    weight: '6 lb',
    materials: 'Speckled buff stoneware, found metal',
    notes: 'Sample piece. Has a final photo.',
    createdDate: todayISO(),
    location: 'Ardest Gallery',
    availableOnline: false,
    onlineOverride: false,
    retailPrice: 650,
    wholesalePrice: null,
    minPrice: 550,
    currency,
    edition: false,
    editionSize: null,
    editionSold: 0,
    costBasis: 61,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  const piece3: Piece = {
    id: uid(),
    inventoryNumber: 'SMP-2026-003',
    title: 'Sample — Field Study No. 4',
    seriesId: series2.id,
    medium: 'painting',
    status: 'Finished',
    stage: 'finished',
    dimensions: '12 × 9 in',
    weight: '',
    materials: 'Oil on linen panel',
    notes: 'Sample piece.',
    createdDate: todayISO(),
    location: 'Studio',
    availableOnline: true,
    onlineOverride: false,
    retailPrice: 275,
    wholesalePrice: null,
    minPrice: 225,
    currency,
    edition: true,
    editionSize: 10,
    editionSold: 2,
    costBasis: 24,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  const milestone1: Milestone = {
    id: uid(),
    pieceId: piece1.id,
    date: todayISO(),
    stage: 'joining',
    notes: 'Sample milestone: joined slabs, seams left visible.',
    timeMinutes: 95,
    clayWeight: '6 lb speckled buff',
    glazeCost: null,
    otherCosts: '',
    createdAt: now,
  }
  const partner: Partner = {
    id: uid(),
    name: 'Sample — Ardest Gallery',
    kind: 'Gallery',
    contact: 'Gallery manager',
    email: '',
    phone: '',
    commissionPct: 40,
    paymentTerms: 'Net 30 after sale',
    notes: 'Sample partner.',
    archived: false,
    createdAt: now,
  }
  const placement: Placement = {
    id: uid(),
    partnerId: partner.id,
    deliveryDate: todayISO(),
    returnDate: '',
    status: 'active',
    notes: 'Sample placement.',
    createdAt: now,
  }
  const placementItem: PlacementItem = {
    id: uid(),
    placementId: placement.id,
    pieceId: piece2.id,
    retailPrice: 650,
    commissionPct: 40,
    expectedPayout: 390,
    status: 'held',
  }

  const photos: Photo[] = []
  for (const [i, piece] of [piece1, piece2].entries()) {
    const master = await sampleImageBlob(i)
    const workingCopy = await makeWorkingCopy(master, 1200)
    photos.push({
      id: uid(),
      pieceId: piece.id,
      seriesId: piece.seriesId,
      stage: piece.stage,
      caption: `Sample photo — ${piece.title}`,
      category: 'raw',
      master,
      masterName: `sample-${i + 1}.jpg`,
      masterType: 'image/jpeg',
      workingCopy,
      workingCopyNote: null,
      adjustments: { exposure: 0, warmth: 0, contrast: 0, saturation: 0, rotation: 0, preset: 'none' },
      processingHistory: ['Sample image generated'],
      finalApproved: i === 1,
      createdAt: now,
    })
  }

  return {
    series: [series1, series2],
    pieces: [piece1, piece2, piece3],
    milestones: [milestone1],
    partners: [partner],
    placements: [placement],
    placementItems: [placementItem],
    photos,
  }
}

// IndexedDB persistence via `idb`. All data lives on-device; there is no
// backend. Photos are stored as Blobs (masters preserved untouched).
import { openDB, type IDBPDatabase } from 'idb'
import type {
  AIOutput,
  ExportPreset,
  HistoryEvent,
  Milestone,
  OutboxItem,
  Partner,
  Photo,
  Piece,
  Placement,
  PlacementItem,
  Profile,
  Sale,
  Series,
} from './types'

const DB_NAME = 'artist-studio-db'
const DB_VERSION = 1

const STORES = [
  'profile',
  'series',
  'pieces',
  'milestones',
  'photos',
  'outbox',
  'partners',
  'placements',
  'placementItems',
  'sales',
  'history',
  'exportPresets',
  'aiOutputs',
] as const

export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' })
          }
        }
      },
    })
  }
  return dbPromise
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await getDB()
  return db.getAll(store) as Promise<T[]>
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get(store, id) as Promise<T | undefined>
}

// Change listener: the cloud sync engine subscribes here so every local
// write is queued for upload. Raw* variants skip it (used when applying
// records pulled from the cloud).
type ChangeListener = (store: StoreName, id: string, deleted: boolean) => void
let changeListener: ChangeListener | null = null
export function setChangeListener(fn: ChangeListener | null): void {
  changeListener = fn
}

export async function putRaw<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  const db = await getDB()
  await db.put(store, value)
}

export async function deleteRaw(store: StoreName, id: string): Promise<void> {
  const db = await getDB()
  await db.delete(store, id)
}

export async function clearRaw(store: StoreName): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}

export async function putOne<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  await putRaw(store, value)
  changeListener?.(store, value.id, false)
}

export async function deleteOne(store: StoreName, id: string): Promise<void> {
  await deleteRaw(store, id)
  changeListener?.(store, id, true)
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await getDB()
  const keys = (await db.getAllKeys(store)) as string[]
  await db.clear(store)
  for (const k of keys) changeListener?.(store, String(k), true)
}

export const ALL_STORES = STORES

// Default export presets, seeded on first run (editable in Settings).
export const DEFAULT_EXPORT_PRESETS: ExportPreset[] = [
  { id: 'preset-zapp', name: 'ZAPP (1920 square, under 5MB)', purpose: 'jury', width: 1920, height: 1920, format: 'jpeg', quality: 0.92, fit: 'pad', padColor: '#000000', maxBytes: 5 * 1024 * 1024 },
  { id: 'preset-cafe', name: 'CaFÉ (1920 longest side)', purpose: 'jury', width: 1920, height: 1920, format: 'jpeg', quality: 0.92, fit: 'contain' },
  { id: 'preset-jury', name: 'Juried show', purpose: 'jury', width: 1920, height: 1920, format: 'jpeg', quality: 0.92 },
  { id: 'preset-web', name: 'Web catalog', purpose: 'web', width: 1200, height: 1200, format: 'jpeg', quality: 0.85 },
  { id: 'preset-social', name: 'Social portrait', purpose: 'social', width: 1080, height: 1350, format: 'jpeg', quality: 0.85 },
]

// Re-export types for convenience in components.
export type {
  AIOutput,
  ExportPreset,
  HistoryEvent,
  Milestone,
  OutboxItem,
  Partner,
  Photo,
  Piece,
  Placement,
  PlacementItem,
  Profile,
  Sale,
  Series,
}

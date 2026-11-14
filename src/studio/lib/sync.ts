// Offline-first cloud sync. IndexedDB stays the source the UI reads from;
// every local change is queued (in a separate IndexedDB database) and
// pushed to Lovable Cloud when signed in and online. Blobs (photos) go to
// private file storage under the user's own folder.
import { openDB, type IDBPDatabase } from 'idb'
import { supabase } from '@/integrations/supabase/client'
import { ALL_STORES, clearRaw, deleteRaw, getOne, putRaw, setChangeListener, type StoreName } from './db'

const BUCKET = 'studio-files'
const USER_KEY = 'asw-sync-user'
// Captures waiting in the on-device outbox are device-local by design.
const SKIP: StoreName[] = ['outbox']
const SYNCED = ALL_STORES.filter((s) => !SKIP.includes(s))

interface QueueItem {
  key: string
  store: StoreName
  id: string
  deleted: boolean
  updatedAt: number
}

let metaPromise: Promise<IDBPDatabase> | null = null
function meta(): Promise<IDBPDatabase> {
  if (!metaPromise) {
    metaPromise = openDB('artist-studio-sync', 1, {
      upgrade(db) {
        db.createObjectStore('queue', { keyPath: 'key' })
        db.createObjectStore('versions') // key -> remote updated_at applied locally
        db.createObjectStore('uploads') // storage path -> size uploaded
      },
    })
  }
  return metaPromise
}

export type SyncStatus = { state: 'idle' | 'syncing' | 'error' | 'offline'; pending: number; error?: string | undefined }
type Listener = (s: SyncStatus) => void
const listeners = new Set<Listener>()
let status: SyncStatus = { state: 'idle', pending: 0 }
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s }
  listeners.forEach((l) => l(status))
}
export function subscribeSync(l: Listener): () => void {
  listeners.add(l)
  l(status)
  return () => listeners.delete(l)
}

let userId: string | null = null
let onPulled: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

async function enqueue(store: StoreName, id: string, deleted: boolean) {
  if (SKIP.includes(store)) return
  const db = await meta()
  const item: QueueItem = { key: `${store}:${id}`, store, id, deleted, updatedAt: Date.now() }
  await db.put('queue', item)
  setStatus({ pending: await db.count('queue') })
  schedule()
}

function schedule(delay = 1200) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

const isBlobMarker = (v: unknown): v is { __blob: string; type: string } =>
  !!v && typeof v === 'object' && '__blob' in (v as object)

async function serialize(store: StoreName, id: string, rec: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  const uploads = await meta()
  for (const [k, v] of Object.entries(rec)) {
    if (v instanceof Blob) {
      const path = `${userId}/${store}/${id}/${k}`
      const done = (await uploads.get('uploads', path)) as number | undefined
      if (done !== v.size) {
        const { error } = await supabase.storage.from(BUCKET).upload(path, v, { upsert: true, contentType: v.type || 'application/octet-stream' })
        if (error) throw error
        await uploads.put('uploads', v.size, path)
      }
      out[k] = { __blob: path, type: v.type }
    } else out[k] = v
  }
  return out
}

async function deserialize(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (isBlobMarker(v)) {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(v.__blob)
      if (error || !blob) throw error ?? new Error('Download failed')
      out[k] = v.type ? new Blob([blob], { type: v.type }) : blob
      ;(await meta()).put('uploads', blob.size, v.__blob)
    } else out[k] = v
  }
  return out
}

async function push() {
  const db = await meta()
  const items = (await db.getAll('queue')) as QueueItem[]
  for (const item of items) {
    if (item.deleted) {
      const { error } = await supabase.from('studio_records').upsert({
        user_id: userId!, store: item.store, id: item.id, data: {}, deleted: true, updated_at: item.updatedAt,
      })
      if (error) throw error
      const paths = ['master', 'workingCopy', 'file'].map((f) => `${userId}/${item.store}/${item.id}/${f}`)
      if (item.store === 'photos') await supabase.storage.from(BUCKET).remove(paths)
    } else {
      const rec = await getOne<Record<string, unknown>>(item.store, item.id)
      if (rec) {
        const data = await serialize(item.store, item.id, rec)
        const { error } = await supabase.from('studio_records').upsert({
          user_id: userId!, store: item.store, id: item.id, data: data as never, deleted: false, updated_at: item.updatedAt,
        })
        if (error) throw error
      }
    }
    await db.put('versions', item.updatedAt, item.key)
    // Only clear if not re-queued meanwhile.
    const cur = (await db.get('queue', item.key)) as QueueItem | undefined
    if (cur && cur.updatedAt === item.updatedAt) await db.delete('queue', item.key)
    setStatus({ pending: await db.count('queue') })
  }
}

async function pull(): Promise<boolean> {
  const db = await meta()
  let changed = false
  const page = 500
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('studio_records')
      .select('store,id,data,deleted,updated_at')
      .eq('user_id', userId!)
      .order('store').order('id')
      .range(from, from + page - 1)
    if (error) throw error
    for (const row of data ?? []) {
      const store = row.store as StoreName
      if (!SYNCED.includes(store)) continue
      const key = `${store}:${row.id}`
      if (await db.get('queue', key)) continue // local change wins until pushed
      const applied = (await db.get('versions', key)) as number | undefined
      if (applied === row.updated_at) continue
      if (row.deleted) await deleteRaw(store, row.id)
      else await putRaw(store, (await deserialize(row.data as Record<string, unknown>)) as { id: string })
      await db.put('versions', row.updated_at, key)
      changed = true
    }
    if (!data || data.length < page) break
  }
  return changed
}

export async function syncNow(): Promise<void> {
  if (!userId || running) return
  if (!navigator.onLine || localStorage.getItem('asw-simulate-offline') === '1') {
    setStatus({ state: 'offline' })
    return
  }
  running = true
  setStatus({ state: 'syncing', error: undefined })
  try {
    await push()
    if (await pull()) onPulled?.()
    setStatus({ state: 'idle' })
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
  } finally {
    running = false
  }
}

async function wipeLocal() {
  for (const s of ALL_STORES) await clearRaw(s)
  const db = await meta()
  for (const s of ['queue', 'versions', 'uploads']) await db.clear(s)
  localStorage.removeItem('asw-sample-ids')
}

const onOnline = () => schedule(200)
const onFocus = () => schedule(200)

/** Start syncing for a signed-in user. Handles first sign-in upload and account switches. */
export async function startSync(uid: string, pulled: () => void): Promise<void> {
  onPulled = pulled
  const last = localStorage.getItem(USER_KEY)
  if (last && last !== uid) {
    await wipeLocal()
    pulled()
  }
  userId = uid
  setChangeListener((s, id, del) => void enqueue(s, id, del))
  if (last !== uid) {
    // First sign-in on this device: upload everything already saved here.
    if (!last) {
      const { getAll } = await import('./db')
      for (const s of SYNCED) for (const r of await getAll<{ id: string }>(s)) await enqueue(s, r.id, false)
    }
    localStorage.setItem(USER_KEY, uid)
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  const db = await meta()
  setStatus({ pending: await db.count('queue') })
  await syncNow()
}

export function stopSync(): void {
  setChangeListener(null)
  userId = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('focus', onFocus)
}

export async function pendingCount(): Promise<number> {
  return (await meta()).count('queue')
}

/** Sign out: push what we can, then remove this account's data from the device. */
export async function signOutAndClear(): Promise<void> {
  await syncNow()
  stopSync()
  await wipeLocal()
  localStorage.removeItem(USER_KEY)
  await supabase.auth.signOut()
}

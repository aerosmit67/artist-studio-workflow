// Central store: loads everything from IndexedDB, exposes typed actions.
// Every mutation writes to IndexedDB first, then refreshes React state.
// Photos are stored as Blobs; object URLs are cached per photo id.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_EXPORT_PRESETS,
  deleteOne,
  getAll,
  putOne,
} from './lib/db'
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
} from './lib/types'
import { CERAMIC_STAGES, initialsOf, PAINTER_STAGES, uid } from './lib/types'
import { decodeHeic, expectedPayout, isHeicFile, makeWorkingCopy } from './lib/utils'
import { buildSampleData, clearSampleIds, setSampleRefs, type SampleRef } from './lib/sample'

export interface PhotoMeta {
  pieceId: string | null
  seriesId: string | null
  stage: string
  note: string
}

export interface PlacementLine {
  pieceId: string
  retailPrice: number
}

export interface StoreValue {
  loading: boolean
  profile: Profile | null
  series: Series[]
  pieces: Piece[]
  milestones: Milestone[]
  photos: Photo[]
  outbox: OutboxItem[]
  partners: Partner[]
  placements: Placement[]
  placementItems: PlacementItem[]
  sales: Sale[]
  history: HistoryEvent[]
  exportPresets: ExportPreset[]
  aiOutputs: AIOutput[]
  online: boolean
  simulateOffline: boolean
  syncing: boolean
  sampleLoaded: boolean
  setSimulateOffline: (b: boolean) => void
  refresh: () => Promise<void>
  saveProfile: (p: Profile) => Promise<void>
  saveSeries: (s: Series) => Promise<void>
  archiveSeries: (id: string, archived: boolean) => Promise<void>
  savePiece: (p: Piece) => Promise<void>
  archivePiece: (id: string, archived: boolean) => Promise<void>
  saveMilestone: (m: Milestone) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>
  addPhotoFromFile: (file: Blob, fileName: string, meta: PhotoMeta) => Promise<'saved' | 'queued'>
  syncOutbox: () => Promise<void>
  updatePhoto: (id: string, patch: Partial<Photo>) => Promise<void>
  deletePhoto: (id: string) => Promise<void>
  savePartner: (p: Partner) => Promise<void>
  archivePartner: (id: string, archived: boolean) => Promise<void>
  createPlacement: (
    partnerId: string,
    deliveryDate: string,
    returnDate: string,
    notes: string,
    lines: PlacementLine[],
  ) => Promise<void>
  updatePlacementItem: (id: string, status: PlacementItem['status']) => Promise<void>
  closePlacement: (id: string) => Promise<void>
  recordSale: (s: Sale) => Promise<void>
  updateSalePayout: (id: string, actualPayout: number | null, date: string | null) => Promise<void>
  deleteSale: (id: string) => Promise<void>
  saveExportPreset: (p: ExportPreset) => Promise<void>
  deleteExportPreset: (id: string) => Promise<void>
  saveAIOutput: (o: AIOutput) => Promise<void>
  deleteAIOutput: (id: string) => Promise<void>
  loadSampleData: () => Promise<boolean>
  clearSampleData: () => Promise<void>
  nextInventoryNumber: () => string
  photoUrl: (photo: Photo) => string | null
  seriesById: (id: string | null) => Series | null
  pieceById: (id: string) => Piece | null
  partnerById: (id: string) => Partner | null
  stagesFor: (medium: string) => string[]
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function defaultProfile(): Profile {
  return {
    id: 'artist',
    name: 'Doni Langlois',
    brand: 'ARTful LiFe CLAY',
    location: 'Montgomery, TX',
    statement: '',
    currency: 'USD',
    timezone: 'America/Chicago',
    primaryMedium: 'ceramics',
    ceramicStages: [...CERAMIC_STAGES],
    painterStages: [...PAINTER_STAGES],
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [series, setSeries] = useState<Series[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [placements, setPlacements] = useState<Placement[]>([])
  const [placementItems, setPlacementItems] = useState<PlacementItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>([])
  const [aiOutputs, setAiOutputs] = useState<AIOutput[]>([])
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine)
  const [simulateOffline, setSimulateOfflineState] = useState<boolean>(
    () => localStorage.getItem('asw-simulate-offline') === '1',
  )
  const [syncing, setSyncing] = useState(false)
  const [sampleLoaded, setSampleLoaded] = useState(false)
  const urlCache = useRef(new Map<string, string>())

  const online = browserOnline && !simulateOffline

  const refresh = useCallback(async () => {
    const [profiles, s, p, m, ph, ob, pa, pl, pli, sa, h, ep, ai] = await Promise.all([
      getAll<Profile>('profile'),
      getAll<Series>('series'),
      getAll<Piece>('pieces'),
      getAll<Milestone>('milestones'),
      getAll<Photo>('photos'),
      getAll<OutboxItem>('outbox'),
      getAll<Partner>('partners'),
      getAll<Placement>('placements'),
      getAll<PlacementItem>('placementItems'),
      getAll<Sale>('sales'),
      getAll<HistoryEvent>('history'),
      getAll<ExportPreset>('exportPresets'),
      getAll<AIOutput>('aiOutputs'),
    ])
    setProfile(profiles[0] ?? null)
    setSeries(s.sort((a, b) => b.createdAt - a.createdAt))
    setPieces(p.sort((a, b) => b.createdAt - a.createdAt))
    setMilestones(m.sort((a, b) => b.date.localeCompare(a.date)))
    setPhotos(ph.sort((a, b) => b.createdAt - a.createdAt))
    setOutbox(ob.sort((a, b) => a.createdAt - b.createdAt))
    setPartners(pa.sort((a, b) => a.name.localeCompare(b.name)))
    setPlacements(pl.sort((a, b) => b.createdAt - a.createdAt))
    setPlacementItems(pli)
    setSales(sa.sort((a, b) => b.date.localeCompare(a.date)))
    setHistory(h.sort((a, b) => b.date - a.date))
    setExportPresets(ep.length ? ep : DEFAULT_EXPORT_PRESETS)
    setAiOutputs(ai.sort((a, b) => b.createdAt - a.createdAt))
    try {
      const refs = JSON.parse(localStorage.getItem('asw-sample-ids') ?? '[]') as SampleRef[]
      setSampleLoaded(refs.length > 0)
    } catch {
      setSampleLoaded(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const existing = await getAll<ExportPreset>('exportPresets')
      if (existing.length === 0) {
        for (const preset of DEFAULT_EXPORT_PRESETS) await putOne('exportPresets', preset)
      }
      await refresh()
      setLoading(false)
    })()
  }, [refresh])

  useEffect(() => {
    const on = () => setBrowserOnline(true)
    const off = () => setBrowserOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const setSimulateOffline = useCallback((b: boolean) => {
    localStorage.setItem('asw-simulate-offline', b ? '1' : '0')
    setSimulateOfflineState(b)
  }, [])

  const photoUrl = useCallback((photo: Photo): string | null => {
    if (photo.workingCopy) {
      const key = `${photo.id}:wc`
      const cached = urlCache.current.get(key)
      if (cached) return cached
      const url = URL.createObjectURL(photo.workingCopy)
      urlCache.current.set(key, url)
      return url
    }
    if (photo.masterType.startsWith('image/') && !isHeicFile({ name: photo.masterName, type: photo.masterType })) {
      const key = `${photo.id}:master`
      const cached = urlCache.current.get(key)
      if (cached) return cached
      const url = URL.createObjectURL(photo.master)
      urlCache.current.set(key, url)
      return url
    }
    return null
  }, [])

  const seriesById = useCallback(
    (id: string | null) => series.find((s) => s.id === id) ?? null,
    [series],
  )
  const pieceById = useCallback((id: string) => pieces.find((p) => p.id === id) ?? null, [pieces])
  const partnerById = useCallback(
    (id: string) => partners.find((p) => p.id === id) ?? null,
    [partners],
  )
  const stagesFor = useCallback(
    (medium: string) => {
      if (!profile) return [...CERAMIC_STAGES]
      return medium === 'painting' ? profile.painterStages : profile.ceramicStages
    },
    [profile],
  )

  const addHistory = useCallback(async (pieceId: string, kind: HistoryEvent['kind'], from: string, to: string) => {
    if (from === to) return
    await putOne<HistoryEvent>('history', {
      id: uid(),
      pieceId,
      date: Date.now(),
      kind,
      from,
      to,
      note: '',
    })
  }, [])

  // Turn an image file into a stored Photo record. The master blob is always
  // preserved untouched; the working copy is a decoded/downscaled JPEG.
  const processFileToPhoto = useCallback(
    async (file: Blob, fileName: string, meta: PhotoMeta): Promise<void> => {
      const heic = isHeicFile({ name: fileName, type: file.type })
      const historyLines: string[] = [`Imported ${fileName}`]
      let workingCopy: Blob | null = null
      let workingCopyNote: string | null = null
      if (heic) {
        const decoded = await decodeHeic(file)
        if (decoded) {
          try {
            workingCopy = await makeWorkingCopy(decoded, 2000)
          } catch {
            workingCopy = decoded
          }
          historyLines.push('HEIC decoded on-device to a JPEG working copy; HEIC kept as master.')
        } else {
          workingCopyNote =
            'HEIC master stored. This browser could not decode it, so no preview is available — the master is preserved.'
          historyLines.push('HEIC decode not available in this browser; master stored without a working copy.')
        }
      } else {
        try {
          workingCopy = await makeWorkingCopy(file, 2000)
          historyLines.push('Working copy created (downscaled JPEG); original kept as master.')
        } catch {
          workingCopy = null
          historyLines.push('Working copy could not be created; the original is used for display.')
        }
      }
      const photo: Photo = {
        id: uid(),
        pieceId: meta.pieceId,
        seriesId: meta.seriesId,
        stage: meta.stage,
        caption: meta.note,
        category: 'raw',
        master: file,
        masterName: fileName,
        masterType: file.type || 'application/octet-stream',
        workingCopy,
        workingCopyNote,
        adjustments: { exposure: 0, warmth: 0, contrast: 0, saturation: 0, rotation: 0, preset: 'none' },
        processingHistory: historyLines,
        finalApproved: false,
        createdAt: Date.now(),
      }
      await putOne('photos', photo)
    },
    [],
  )

  const syncOutbox = useCallback(async () => {
    if (syncing) return
    const items = await getAll<OutboxItem>('outbox')
    const pending = items.filter((i) => i.status === 'queued' || i.status === 'failed')
    if (pending.length === 0) return
    setSyncing(true)
    try {
      for (const item of pending) {
        await putOne<OutboxItem>('outbox', { ...item, status: 'syncing' })
        try {
          await processFileToPhoto(item.file, item.fileName, {
            pieceId: item.pieceId,
            seriesId: item.seriesId,
            stage: item.stage,
            note: item.note,
          })
          await deleteOne('outbox', item.id)
        } catch (err) {
          await putOne<OutboxItem>('outbox', {
            ...item,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Sync failed',
          })
        }
      }
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [processFileToPhoto, refresh, syncing])

  // Sync when connectivity returns.
  useEffect(() => {
    if (online) void syncOutbox()
  }, [online, syncOutbox])

  const value = useMemo<StoreValue>(() => {
    const saveProfile = async (p: Profile) => {
      await putOne('profile', p)
      await refresh()
    }
    const saveSeries = async (s: Series) => {
      await putOne('series', s)
      await refresh()
    }
    const archiveSeries = async (id: string, archived: boolean) => {
      const s = series.find((x) => x.id === id)
      if (!s) return
      await putOne('series', { ...s, archived })
      await refresh()
    }
    const savePiece = async (p: Piece) => {
      const existing = pieces.find((x) => x.id === p.id)
      const next: Piece = { ...p, updatedAt: Date.now() }
      await putOne('pieces', next)
      if (existing) {
        await addHistory(p.id, 'status', existing.status, p.status)
        await addHistory(p.id, 'location', existing.location, p.location)
        await addHistory(p.id, 'stage', existing.stage, p.stage)
      }
      await refresh()
    }
    const archivePiece = async (id: string, archived: boolean) => {
      const p = pieces.find((x) => x.id === id)
      if (!p) return
      await putOne('pieces', { ...p, archived, updatedAt: Date.now() })
      await refresh()
    }
    const saveMilestone = async (m: Milestone) => {
      await putOne('milestones', m)
      const piece = pieces.find((x) => x.id === m.pieceId)
      if (piece && m.stage && m.stage !== piece.stage) {
        await addHistory(piece.id, 'stage', piece.stage, m.stage)
        await putOne('pieces', { ...piece, stage: m.stage, updatedAt: Date.now() })
      }
      await refresh()
    }
    const deleteMilestone = async (id: string) => {
      await deleteOne('milestones', id)
      await refresh()
    }
    const addPhotoFromFile = async (
      file: Blob,
      fileName: string,
      meta: PhotoMeta,
    ): Promise<'saved' | 'queued'> => {
      if (!online) {
        await putOne<OutboxItem>('outbox', {
          id: uid(),
          file,
          fileName,
          fileType: file.type || 'application/octet-stream',
          pieceId: meta.pieceId,
          seriesId: meta.seriesId,
          stage: meta.stage,
          note: meta.note,
          status: 'queued',
          error: null,
          createdAt: Date.now(),
        })
        await refresh()
        return 'queued'
      }
      await processFileToPhoto(file, fileName, meta)
      await refresh()
      return 'saved'
    }
    const updatePhoto = async (id: string, patch: Partial<Photo>) => {
      const ph = photos.find((x) => x.id === id)
      if (!ph) return
      await putOne('photos', { ...ph, ...patch })
      await refresh()
    }
    const deletePhoto = async (id: string) => {
      await deleteOne('photos', id)
      await refresh()
    }
    const savePartner = async (p: Partner) => {
      await putOne('partners', p)
      await refresh()
    }
    const archivePartner = async (id: string, archived: boolean) => {
      const p = partners.find((x) => x.id === id)
      if (!p) return
      await putOne('partners', { ...p, archived })
      await refresh()
    }
    const createPlacement = async (
      partnerId: string,
      deliveryDate: string,
      returnDate: string,
      notes: string,
      lines: PlacementLine[],
    ) => {
      const partner = partners.find((x) => x.id === partnerId)
      if (!partner) throw new Error('Partner not found')
      const placement: Placement = {
        id: uid(),
        partnerId,
        deliveryDate,
        returnDate,
        status: 'active',
        notes,
        createdAt: Date.now(),
      }
      await putOne('placements', placement)
      for (const line of lines) {
        const piece = pieces.find((x) => x.id === line.pieceId)
        if (!piece) continue
        const payout = expectedPayout(line.retailPrice, partner.commissionPct)
        await putOne<PlacementItem>('placementItems', {
          id: uid(),
          placementId: placement.id,
          pieceId: piece.id,
          retailPrice: line.retailPrice,
          commissionPct: partner.commissionPct,
          expectedPayout: payout,
          status: 'held',
        })
        await addHistory(piece.id, 'location', piece.location, partner.name)
        await putOne('pieces', {
          ...piece,
          location: partner.name,
          availableOnline: false,
          updatedAt: Date.now(),
        })
      }
      await refresh()
    }
    const updatePlacementItem = async (id: string, status: PlacementItem['status']) => {
      const item = placementItems.find((x) => x.id === id)
      if (!item) return
      const piece = pieces.find((x) => x.id === item.pieceId)
      const placement = placements.find((x) => x.id === item.placementId)
      await putOne('placementItems', { ...item, status })
      if (piece && placement) {
        const partner = partners.find((x) => x.id === placement.partnerId)
        if (status === 'returned') {
          await addHistory(piece.id, 'location', piece.location, 'Studio')
          await putOne('pieces', { ...piece, location: 'Studio', availableOnline: true, updatedAt: Date.now() })
        } else if (status === 'sold') {
          await addHistory(piece.id, 'status', piece.status, 'Sold')
          await addHistory(piece.id, 'location', piece.location, 'Sold')
          await putOne('pieces', {
            ...piece,
            status: 'Sold',
            location: 'Sold',
            availableOnline: false,
            editionSold: piece.edition ? piece.editionSold + 1 : piece.editionSold,
            updatedAt: Date.now(),
          })
        } else if (status === 'held' && partner) {
          await addHistory(piece.id, 'location', piece.location, partner.name)
          await putOne('pieces', { ...piece, location: partner.name, availableOnline: false, updatedAt: Date.now() })
        }
      }
      await refresh()
    }
    const closePlacement = async (id: string) => {
      const placement = placements.find((x) => x.id === id)
      if (!placement) return
      await putOne('placements', { ...placement, status: 'closed' })
      // Still-held pieces come back to the studio on close.
      for (const item of placementItems.filter((x) => x.placementId === id && x.status === 'held')) {
        await updatePlacementItem(item.id, 'returned')
      }
      await refresh()
    }
    const recordSale = async (s: Sale) => {
      await putOne('sales', s)
      const piece = pieces.find((x) => x.id === s.pieceId)
      if (piece) {
        await addHistory(piece.id, 'status', piece.status, 'Sold')
        await addHistory(piece.id, 'location', piece.location, 'Sold')
        await putOne('pieces', {
          ...piece,
          status: 'Sold',
          location: 'Sold',
          availableOnline: false,
          editionSold: piece.edition ? piece.editionSold + 1 : piece.editionSold,
          updatedAt: Date.now(),
        })
      }
      if (s.placementId) {
        const item = placementItems.find(
          (x) => x.placementId === s.placementId && x.pieceId === s.pieceId && x.status === 'held',
        )
        if (item) await putOne('placementItems', { ...item, status: 'sold' })
      }
      await refresh()
    }
    const updateSalePayout = async (id: string, actualPayout: number | null, date: string | null) => {
      const s = sales.find((x) => x.id === id)
      if (!s) return
      await putOne('sales', {
        ...s,
        actualPayout,
        actualPayoutDate: date,
        status: actualPayout !== null ? 'received' : s.status,
      })
      await refresh()
    }
    const deleteSale = async (id: string) => {
      await deleteOne('sales', id)
      await refresh()
    }
    const saveExportPreset = async (p: ExportPreset) => {
      await putOne('exportPresets', p)
      await refresh()
    }
    const deleteExportPreset = async (id: string) => {
      await deleteOne('exportPresets', id)
      await refresh()
    }
    const saveAIOutput = async (o: AIOutput) => {
      await putOne('aiOutputs', o)
      await refresh()
    }
    const deleteAIOutput = async (id: string) => {
      await deleteOne('aiOutputs', id)
      await refresh()
    }
    const loadSampleData = async (): Promise<boolean> => {
      try {
        const refs = JSON.parse(localStorage.getItem('asw-sample-ids') ?? '[]') as SampleRef[]
        if (refs.length > 0) return false
      } catch {
        /* fall through */
      }
      const bundle = await buildSampleData(profile?.currency ?? 'USD')
      const refs: SampleRef[] = []
      const putAll = async <T extends { id: string }>(store: Parameters<typeof putOne>[0], items: T[]) => {
        for (const item of items) {
          await putOne(store, item)
          refs.push({ store, id: item.id })
        }
      }
      await putAll('series', bundle.series)
      await putAll('pieces', bundle.pieces)
      await putAll('milestones', bundle.milestones)
      await putAll('partners', bundle.partners)
      await putAll('placements', bundle.placements)
      await putAll('placementItems', bundle.placementItems)
      await putAll('photos', bundle.photos)
      setSampleRefs(refs)
      await refresh()
      return true
    }
    const clearSampleData = async () => {
      let refs: SampleRef[] = []
      try {
        refs = JSON.parse(localStorage.getItem('asw-sample-ids') ?? '[]') as SampleRef[]
      } catch {
        refs = []
      }
      for (const ref of refs) {
        await deleteOne(ref.store as Parameters<typeof deleteOne>[0], ref.id)
      }
      clearSampleIds()
      await refresh()
    }
    const nextInventoryNumber = (): string => {
      const prefix = `${initialsOf(profile?.name ?? 'Artist Studio')}-${new Date().getFullYear()}`
      let max = 0
      for (const p of pieces) {
        const m = p.inventoryNumber.match(new RegExp(`^${prefix}-(\\d+)$`))
        if (m) max = Math.max(max, parseInt(m[1], 10))
      }
      return `${prefix}-${String(max + 1).padStart(3, '0')}`
    }

    return {
      loading,
      profile,
      series,
      pieces,
      milestones,
      photos,
      outbox,
      partners,
      placements,
      placementItems,
      sales,
      history,
      exportPresets,
      aiOutputs,
      online,
      simulateOffline,
      syncing,
      sampleLoaded,
      setSimulateOffline,
      refresh,
      saveProfile,
      saveSeries,
      archiveSeries,
      savePiece,
      archivePiece,
      saveMilestone,
      deleteMilestone,
      addPhotoFromFile,
      syncOutbox,
      updatePhoto,
      deletePhoto,
      savePartner,
      archivePartner,
      createPlacement,
      updatePlacementItem,
      closePlacement,
      recordSale,
      updateSalePayout,
      deleteSale,
      saveExportPreset,
      deleteExportPreset,
      saveAIOutput,
      deleteAIOutput,
      loadSampleData,
      clearSampleData,
      nextInventoryNumber,
      photoUrl,
      seriesById,
      pieceById,
      partnerById,
      stagesFor,
    }
  }, [
    loading,
    profile,
    series,
    pieces,
    milestones,
    photos,
    outbox,
    partners,
    placements,
    placementItems,
    sales,
    history,
    exportPresets,
    aiOutputs,
    online,
    simulateOffline,
    syncing,
    sampleLoaded,
    refresh,
    addHistory,
    processFileToPhoto,
    syncOutbox,
    photoUrl,
    seriesById,
    pieceById,
    partnerById,
    stagesFor,
    setSimulateOffline,
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

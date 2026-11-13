// Quick capture: phone camera or library, attached to a piece/series/stage.
// Offline captures queue in an IndexedDB outbox and sync on reconnect.
import { useRef, useState } from 'react'
import { useStore, type PhotoMeta } from '../store'
import { isImageFile } from '../lib/utils'
import { Badge, Btn, EmptyState, go } from './ui'

export function Capture({ presetPieceId }: { presetPieceId?: string | null }) {
  const { pieces, series, stagesFor, addPhotoFromFile, outbox, syncOutbox, online, syncing, photoUrl, profile, photos } = useStore()
  const [pieceId, setPieceId] = useState<string>(presetPieceId ?? '')
  const [seriesId, setSeriesId] = useState('')
  const [stage, setStage] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const piece = pieces.find((p) => p.id === pieceId) ?? null
  const stages = stagesFor(piece?.medium ?? profile?.primaryMedium ?? 'ceramics')
  const activePieceId = pieceId || ''

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setStatus(null)
    let saved = 0
    let queued = 0
    let rejected = 0
    for (const file of Array.from(files)) {
      if (!isImageFile(file)) {
        rejected++
        continue
      }
      const meta: PhotoMeta = {
        pieceId: activePieceId || null,
        seriesId: seriesId || piece?.seriesId || null,
        stage: stage || piece?.stage || 'idea',
        note: note.trim(),
      }
      const result = await addPhotoFromFile(file, file.name, meta)
      if (result === 'saved') saved++
      else queued++
    }
    setBusy(false)
    const parts: string[] = []
    if (saved) parts.push(`${saved} saved`)
    if (queued) parts.push(`${queued} queued offline — will sync when you’re back online`)
    if (rejected) parts.push(`${rejected} rejected (not an image file)`)
    setStatus(parts.join(' · ') || 'Nothing captured.')
    setNote('')
  }

  const recent = photos.slice(0, 6)

  return (
    <div className="page">
      <h1>Capture progress</h1>
      {!online && (
        <div className="alert alert-info">
          You’re offline. Captures will queue on this device and sync when you reconnect.
        </div>
      )}
      <p className="lede">Take a photo at a natural milestone — attach it, add a note, keep working.</p>

      <div className="actions">
        <Btn variant="primary" disabled={busy} onClick={() => cameraRef.current?.click()}>
          📷 Use camera
        </Btn>
        <Btn disabled={busy} onClick={() => libraryRef.current?.click()}>
          🖼 Choose from library
        </Btn>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-input"
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-input"
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }}
      />

      <div className="form">
        <label className="field">
          <span className="field-label">Attach to piece (optional — you can attach later)</span>
          <select className="input" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>
            <option value="">Unattached (draft)</option>
            {pieces.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled'} · {p.inventoryNumber}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Series</span>
          <select className="input" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
            <option value="">None</option>
            {series.filter((s) => !s.archived).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Stage</span>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Use piece stage</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Short note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. second glaze coat, seams visible" />
        </label>
      </div>
      {status && <div className="alert alert-info">{status}</div>}

      {outbox.length > 0 && (
        <div className="card">
          <h2>Offline queue ({outbox.length})</h2>
          <ul className="list">
            {outbox.map((item) => (
              <li key={item.id} className="list-item">
                <span className="row-title">{item.fileName}</span>
                <span className="row-sub">
                  <Badge tone={item.status === 'failed' ? 'warn' : 'info'}>{item.status}</Badge>
                  {item.error ? ` · ${item.error}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <Btn disabled={!online || syncing} onClick={() => { void syncOutbox() }}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Btn>
        </div>
      )}

      <h2>Recent captures</h2>
      {recent.length === 0 ? (
        <EmptyState title="No photos yet" body="Your captures will appear here." />
      ) : (
        <div className="thumbs">
          {recent.map((ph) => {
            const url = photoUrl(ph)
            return (
              <button key={ph.id} type="button" className="thumb" onClick={() => go(`#/photolab/${ph.id}`)}>
                {url ? (
                  <img src={url} alt={ph.caption || ph.stage} />
                ) : (
                  <span className="thumb-missing">HEIC master stored — no preview in this browser</span>
                )}
                <span className="thumb-cap">{ph.stage}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

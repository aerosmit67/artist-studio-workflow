// Photo Lab: named one-tap presets, manual sliders, before/after compare,
// non-destructive edits (the master is never modified), final approval,
// and export via configurable presets with batch download.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Adjustments, PhotoCategory } from '../lib/types'
import { DEFAULT_ADJUSTMENTS, PHOTO_CATEGORY_LABELS, PHOTO_PRESETS } from '../lib/types'
import {
  decodeHeic,
  downloadBlob,
  exportPhoto,
  filterString,
  loadImage,
  makeWorkingCopy,
  presetById,
  renderAdjustedCanvas,
  slugify,
} from '../lib/utils'
import { Btn, EmptyState, Field, go } from './ui'

export function PhotoLabList() {
  const { photos, pieces, photoUrl, exportPresets } = useStore()
  const [pieceFilter, setPieceFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exportPresetId, setExportPresetId] = useState(exportPresets[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const filtered = photos.filter((ph) => {
    if (pieceFilter === 'all') return true
    if (pieceFilter === 'unattached') return !ph.pieceId
    return ph.pieceId === pieceFilter
  })
  const preset = exportPresets.find((p) => p.id === exportPresetId) ?? exportPresets[0]

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportSelected = async () => {
    if (!preset || selected.size === 0) return
    setBusy(true)
    try {
      for (const id of selected) {
        const ph = photos.find((p) => p.id === id)
        if (!ph) continue
        const source = ph.workingCopy ?? ph.master
        const blob = await exportPhoto(source, ph.adjustments, preset)
        const piece = pieces.find((p) => p.id === ph.pieceId)
        const name = `${piece?.inventoryNumber ?? 'photo'}-${slugify(preset.name)}.${preset.format === 'jpeg' ? 'jpg' : preset.format}`
        downloadBlob(blob, name)
        await new Promise((r) => window.setTimeout(r, 400))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Photo Lab</h1>
        <Btn variant="primary" onClick={() => go('#/capture')}>📷 Capture</Btn>
      </div>
      <p className="lede">
        Originals are never modified. Presets are a starting point for color — not a
        calibration guarantee. Approve a photo as final before it goes into a listing.
      </p>
      <div className="filters">
        <select className="input" value={pieceFilter} onChange={(e) => setPieceFilter(e.target.value)} aria-label="Filter by piece">
          <option value="all">All photos</option>
          <option value="unattached">Unattached drafts</option>
          {pieces.filter((p) => !p.archived).map((p) => (
            <option key={p.id} value={p.id}>{p.title || 'Untitled'} · {p.inventoryNumber}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="No photos yet"
          body="Capture a photo from the studio and it will show up here for editing and export."
          action={<Btn variant="primary" onClick={() => go('#/capture')}>Capture a photo</Btn>}
        />
      ) : (
        <>
          <div className="thumbs">
            {filtered.map((ph) => {
              const url = photoUrl(ph)
              const checked = selected.has(ph.id)
              return (
                <div key={ph.id} className="thumb-wrap">
                  <button type="button" className="thumb" onClick={() => go(`#/photolab/${ph.id}`)}>
                    {url ? (
                      <img src={url} alt={ph.caption || ph.stage} />
                    ) : (
                      <span className="thumb-missing">HEIC master stored — no preview in this browser</span>
                    )}
                    <span className="thumb-cap">{ph.category}{ph.finalApproved ? ' · final' : ''}</span>
                  </button>
                  <label className="thumb-check">
                    <input type="checkbox" checked={checked} onChange={() => toggleSelect(ph.id)} />
                    Export
                  </label>
                </div>
              )
            })}
          </div>
          <div className="card">
            <h2>Batch export</h2>
            <Field label="Export preset">
              <select className="input" value={exportPresetId} onChange={(e) => setExportPresetId(e.target.value)}>
                {exportPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.width}×{p.height} {p.format.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Btn disabled={selected.size === 0 || busy} onClick={() => { void exportSelected() }}>
              {busy ? 'Exporting…' : `Download ${selected.size} selected`}
            </Btn>
            <p className="fineprint">
              Presets are configurable in Settings. Verify the current requirements for each
              show or platform — presets are not fixed standards.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export function PhotoLabEditor({ photoId }: { photoId: string }) {
  const { photos, pieces, series, updatePhoto, deletePhoto, photoUrl, exportPresets, stagesFor } = useStore()
  const photo = photos.find((p) => p.id === photoId) ?? null
  const [adj, setAdj] = useState<Adjustments>(photo?.adjustments ?? DEFAULT_ADJUSTMENTS)
  const [compareOriginal, setCompareOriginal] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState<string | null>(null)
  const [exportPresetId, setExportPresetId] = useState(exportPresets[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgReady, setImgReady] = useState(false)

  const sourceUrl = photo ? photoUrl(photo) : null
  const piece = photo?.pieceId ? pieces.find((p) => p.id === photo.pieceId) ?? null : null
  const preset = exportPresets.find((p) => p.id === exportPresetId) ?? exportPresets[0]

  // Load the source image once the working copy / master URL is available.
  useEffect(() => {
    let cancelled = false
    setImgReady(false)
    if (!photo || !sourceUrl) return
    void loadImage(photo.workingCopy ?? photo.master)
      .then((img) => {
        if (cancelled) return
        imgRef.current = img
        setImgReady(true)
      })
      .catch(() => {
        if (!cancelled) setImgReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [photo, sourceUrl])

  // Redraw the preview whenever adjustments or compare mode change.
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgReady || !photo) return
    const shown = compareOriginal ? DEFAULT_ADJUSTMENTS : adj
    const rendered = renderAdjustedCanvas(img, shown, 1400)
    canvas.width = rendered.width
    canvas.height = rendered.height
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(rendered, 0, 0)
  }, [adj, compareOriginal, imgReady, photo])

  const dirty = useMemo(
    () => JSON.stringify(adj) !== JSON.stringify(photo?.adjustments ?? DEFAULT_ADJUSTMENTS),
    [adj, photo],
  )

  if (!photo) {
    return (
      <div className="page">
        <EmptyState title="Photo not found" action={<Btn onClick={() => go('#/photolab')}>Back to Photo Lab</Btn>} />
      </div>
    )
  }

  const applyPreset = (id: string) => {
    const def = presetById(id)
    if (!def) return
    setAdj({ ...def.adjustments, preset: def.id })
  }

  const setSlider = (key: 'exposure' | 'warmth' | 'contrast' | 'saturation', v: number) => {
    setAdj((prev) => ({ ...prev, preset: 'custom', [key]: v }))
  }

  const rotate = () => {
    setAdj((prev) => ({ ...prev, preset: 'custom', rotation: (prev.rotation + 90) % 360 }))
  }

  const saveAdjustments = async () => {
    const presetName = adj.preset !== 'none' && adj.preset !== 'custom'
      ? presetById(adj.preset)?.name ?? adj.preset
      : 'manual adjustments'
    await updatePhoto(photo.id, {
      adjustments: adj,
      category: photo.category === 'raw' ? 'optimized' : photo.category,
      processingHistory: [...photo.processingHistory, `Applied ${presetName}`],
    })
  }

  const retryDecode = async () => {
    setRetrying(true)
    setRetryMsg(null)
    try {
      const decoded = await decodeHeic(photo.master)
      if (!decoded) {
        setRetryMsg('Still could not decode this HEIC in this browser. Try Safari, or keep the master stored.')
        return
      }
      const workingCopy = await makeWorkingCopy(decoded, 2000).catch(() => decoded)
      await updatePhoto(photo.id, {
        workingCopy,
        workingCopyNote: null,
        processingHistory: [...photo.processingHistory, 'HEIC decoded on retry to a JPEG working copy.'],
      })
      setRetryMsg('Decoded — a working copy is now available.')
    } finally {
      setRetrying(false)
    }
  }

  const downloadOne = async () => {
    if (!preset) return
    setBusy(true)
    try {
      const source = photo.workingCopy ?? photo.master
      const blob = await exportPhoto(source, adj, preset)
      const name = `${piece?.inventoryNumber ?? 'photo'}-${slugify(preset.name)}.${preset.format === 'jpeg' ? 'jpg' : preset.format}`
      downloadBlob(blob, name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Photo Lab</h1>
        <Btn variant="ghost" onClick={() => go('#/photolab')}>All photos</Btn>
      </div>
      <p className="lede">
        {piece ? `${piece.title || 'Untitled'} · ${piece.inventoryNumber}` : 'Unattached draft'} · {photo.stage}
        {photo.finalApproved ? ' · Final approved' : ''}
      </p>

      {!sourceUrl ? (
        <div className="alert alert-info">
          <strong>HEIC master stored — no preview in this browser.</strong>
          <p>
            {photo.workingCopyNote ??
              'This photo arrived as HEIC and this browser cannot decode it. The original is preserved untouched.'}
          </p>
          <Btn disabled={retrying} onClick={() => { void retryDecode() }}>
            {retrying ? 'Trying…' : 'Try decoding again'}
          </Btn>
          {retryMsg && <p>{retryMsg}</p>}
        </div>
      ) : (
        <>
          <div className="preview">
            <canvas ref={canvasRef} className="preview-canvas" aria-label="Photo preview" />
            {!imgReady && <p className="fineprint">Loading preview…</p>}
          </div>
          <div className="row-actions">
            <Btn
              onClick={() => setCompareOriginal((v) => !v)}
              variant={compareOriginal ? 'primary' : 'default'}
            >
              {compareOriginal ? 'Showing original — tap for edited' : 'Hold to compare: show original'}
            </Btn>
          </div>
          <p className="fineprint">Preview filter: <code>{filterString(compareOriginal ? DEFAULT_ADJUSTMENTS : adj)}</code></p>
        </>
      )}

      <h2>One-tap presets</h2>
      <div className="chips">
        {PHOTO_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${adj.preset === p.id ? ' chip-on' : ''}`}
            onClick={() => applyPreset(p.id)}
            title={p.description}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          className={`chip${adj.preset === 'none' ? ' chip-on' : ''}`}
          onClick={() => setAdj({ ...DEFAULT_ADJUSTMENTS })}
        >
          None
        </button>
      </div>
      {adj.preset !== 'none' && adj.preset !== 'custom' && (
        <p className="fineprint">{presetById(adj.preset)?.description}</p>
      )}

      <h2>Manual adjustments</h2>
      <div className="sliders">
        {(['exposure', 'warmth', 'contrast', 'saturation'] as const).map((key) => (
          <label key={key} className="field">
            <span className="field-label">
              {key === 'exposure' ? 'Exposure' : key === 'warmth' ? 'White balance (warmth)' : key === 'contrast' ? 'Contrast' : 'Saturation'}
              {' — '}{adj[key].toFixed(2)}
            </span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={adj[key]}
              onChange={(e) => setSlider(key, Number(e.target.value))}
              className="slider"
              aria-label={key}
            />
          </label>
        ))}
        <Btn onClick={rotate}>Rotate 90°{adj.rotation ? ` (now ${adj.rotation}°)` : ''}</Btn>
      </div>

      <div className="row-actions">
        <Btn variant="primary" disabled={!dirty} onClick={() => { void saveAdjustments() }}>
          Save adjustments
        </Btn>
        <Btn disabled={!dirty} onClick={() => setAdj(photo.adjustments)}>Undo changes</Btn>
        <Btn onClick={() => setAdj({ ...DEFAULT_ADJUSTMENTS })}>Reset</Btn>
      </div>
      <p className="fineprint">
        Saving stores the adjustment settings only — the master file is never modified.
        Category: {PHOTO_CATEGORY_LABELS[photo.category]}.
      </p>

      <h2>Details</h2>
      <div className="form">
        <Field label="Caption">
          <input
            className="input"
            value={photo.caption}
            onChange={(e) => { void updatePhoto(photo.id, { caption: e.target.value }) }}
          />
        </Field>
        <Field label="Attach to piece">
          <select
            className="input"
            value={photo.pieceId ?? ''}
            onChange={(e) => { void updatePhoto(photo.id, { pieceId: e.target.value || null }) }}
          >
            <option value="">Unattached draft</option>
            {pieces.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled'} · {p.inventoryNumber}</option>
            ))}
          </select>
        </Field>
        <Field label="Series">
          <select
            className="input"
            value={photo.seriesId ?? ''}
            onChange={(e) => { void updatePhoto(photo.id, { seriesId: e.target.value || null }) }}
          >
            <option value="">None</option>
            {series.filter((s) => !s.archived).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select
            className="input"
            value={photo.stage}
            onChange={(e) => { void updatePhoto(photo.id, { stage: e.target.value }) }}
          >
            {stagesFor(piece?.medium ?? 'ceramics').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            className="input"
            value={photo.category}
            onChange={(e) => { void updatePhoto(photo.id, { category: e.target.value as PhotoCategory }) }}
          >
            {(Object.keys(PHOTO_CATEGORY_LABELS) as PhotoCategory[]).map((c) => (
              <option key={c} value={c}>{PHOTO_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row-actions">
        <Btn
          variant={photo.finalApproved ? 'ghost' : 'primary'}
          onClick={() => {
            void updatePhoto(photo.id, {
              finalApproved: !photo.finalApproved,
              category: !photo.finalApproved ? 'final' : photo.category,
            })
          }}
        >
          {photo.finalApproved ? 'Remove final approval' : '✓ Approve as final photo'}
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            if (window.confirm('Delete this photo and its stored master? This cannot be undone.')) {
              void deletePhoto(photo.id)
              go('#/photolab')
            }
          }}
        >
          Delete photo
        </Btn>
      </div>

      <h2>Export</h2>
      <div className="form">
        <Field label="Export preset">
          <select className="input" value={exportPresetId} onChange={(e) => setExportPresetId(e.target.value)}>
            {exportPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.width}×{p.height} {p.format.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Btn disabled={busy || !sourceUrl} onClick={() => { void downloadOne() }}>
          {busy ? 'Exporting…' : 'Download this photo'}
        </Btn>
        <p className="fineprint">
          The download applies your current adjustments. Verify the destination’s
          current requirements — presets are configuration, not fixed standards.
        </p>
      </div>

      <h2>Processing history</h2>
      <ul className="list">
        {photo.processingHistory.map((h, i) => (
          <li key={i} className="list-item"><span className="row-sub">{h}</span></li>
        ))}
      </ul>
    </div>
  )
}

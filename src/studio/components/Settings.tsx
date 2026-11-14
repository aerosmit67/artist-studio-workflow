// Settings: artist profile, export presets, storage, sample data, and
// offline simulation. Includes full data export (JSON) and erase-all.
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { ExportPreset } from '../lib/types'
import { uid } from '../lib/types'
import { downloadText } from '../lib/utils'
import { ProfileForm } from './Onboarding'
import { Btn, EmptyState, Field, Modal } from './ui'
import { clearStore } from '../lib/db'
import { pendingCount, signOutAndClear, syncNow } from '../lib/sync'
import { supabase } from '@/integrations/supabase/client'

export function Settings() {
  const {
    profile,
    saveProfile,
    exportPresets,
    deleteExportPreset,
    series,
    pieces,
    photos,
    partners,
    placements,
    sales,
    simulateOffline,
    setSimulateOffline,
    loadSampleData,
    clearSampleData,
    sampleLoaded,
    refresh,
  } = useStore()
  const [showPresetForm, setShowPresetForm] = useState(false)
  const [editingPreset, setEditingPreset] = useState<ExportPreset | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])
  const signOut = async () => {
    await syncNow()
    const left = await pendingCount()
    if (left > 0 && !window.confirm(`${left} change(s) haven't reached the cloud yet (are you offline?). Signing out now will lose them. Sign out anyway?`)) return
    await signOutAndClear()
    window.location.hash = '#/'
  }

  useEffect(() => {
    void (async () => {
      try {
        const e = await navigator.storage?.estimate?.()
        if (e) setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 })
      } catch {
        setStorage(null)
      }
    })()
  }, [])

  const fmtMB = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

  const exportAllJson = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile,
      series,
      pieces: pieces.map((p) => ({ ...p })),
      photos: photos.map((ph) => ({
        ...ph,
        master: `[blob ${ph.masterType}, ${ph.master.size} bytes — not included]`,
        workingCopy: ph.workingCopy ? `[blob, ${ph.workingCopy.size} bytes — not included]` : null,
      })),
      partners,
      placements,
      sales,
    }
    downloadText(JSON.stringify(data, null, 2), 'artist-studio-backup.json', 'application/json')
  }

  const eraseAll = async () => {
    if (
      !window.confirm(
        'Erase ALL data in this workspace — profile, series, pieces, photos, partners, placements, and sales? This cannot be undone. Export a backup first if you need it.',
      )
    )
      return
    setBusy(true)
    for (const store of [
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
    ] as const) {
      await clearStore(store)
    }
    localStorage.removeItem('asw-sample-ids')
    localStorage.removeItem('asw-simulate-offline')
    setBusy(false)
    await refresh()
    window.location.hash = '#/'
    window.location.reload()
  }

  if (!profile) {
    return (
      <div className="page">
        <EmptyState title="No profile yet" body="Set up your studio first." />
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Settings</h1>

      <h2>Account</h2>
      <p className="fineprint">Signed in as {email ?? '…'}. Your records, settings and photos are saved to your private cloud account.</p>
      <div className="row-actions">
        <Btn onClick={() => { void syncNow() }}>Sync now</Btn>
        <Btn variant="danger" onClick={() => { void signOut() }}>Sign out</Btn>
      </div>

      <h2>Artist profile</h2>
      <ProfileForm
        initial={profile}
        onSave={(p) => {
          void saveProfile(p)
          setMsg('Profile saved.')
        }}
        submitLabel="Save profile"
      />
      {msg && <p className="fineprint">{msg}</p>}

      <h2>Export presets</h2>
      <p className="fineprint">
        Presets are configuration for a destination — verify the current requirements
        for each show or platform.
      </p>
      <ul className="list">
        {exportPresets.map((p) => (
          <li key={p.id} className="list-item">
            <span className="row-title">{p.name}</span>
            <span className="row-sub">
              {p.purpose} · {p.width}×{p.height} · {p.format.toUpperCase()} · quality {p.quality}
            </span>
            <div className="row-actions">
              <Btn
                onClick={() => {
                  setEditingPreset(p)
                  setShowPresetForm(true)
                }}
              >
                Edit
              </Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  if (window.confirm(`Delete the “${p.name}” preset?`)) void deleteExportPreset(p.id)
                }}
              >
                Delete
              </Btn>
            </div>
          </li>
        ))}
      </ul>
      <Btn
        onClick={() => {
          setEditingPreset(null)
          setShowPresetForm(true)
        }}
      >
        ＋ New export preset
      </Btn>
      {showPresetForm && (
        <Modal title={editingPreset ? 'Edit export preset' : 'New export preset'} onClose={() => setShowPresetForm(false)}>
          <ExportPresetForm
            existing={editingPreset}
            onDone={() => setShowPresetForm(false)}
          />
        </Modal>
      )}

      <h2>Storage</h2>
      <p className="fineprint">
        {storage
          ? `Using ${fmtMB(storage.usage)} of about ${fmtMB(storage.quota)} available on this device.`
          : 'Storage estimate unavailable in this browser.'}
      </p>
      <p className="fineprint">
        {series.length} series · {pieces.length} pieces · {photos.length} photos ·{' '}
        {partners.length} partners · {placements.length} placements · {sales.length} sales
      </p>

      <h2>Offline</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={simulateOffline}
          onChange={(e) => setSimulateOffline(e.target.checked)}
        />
        Simulate offline (test the capture queue without turning off your connection)
      </label>

      <h2>Sample data</h2>
      {sampleLoaded ? (
        <>
          <p className="fineprint">
            Sample data is loaded. It is clearly labeled “Sample —” and kept separate
            from real artwork.
          </p>
          <Btn
            variant="danger"
            onClick={() => {
              void clearSampleData()
            }}
          >
            Remove sample data
          </Btn>
        </>
      ) : (
        <>
          <p className="fineprint">
            The workspace ships empty. You can load a small, clearly-labeled sample set
            (two series, three pieces, one placement) to try the app — remove it any time.
          </p>
          <Btn
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await loadSampleData()
              setBusy(false)
            }}
          >
            Load sample data
          </Btn>
        </>
      )}

      <h2>Backup &amp; erase</h2>
      <div className="row-actions">
        <Btn onClick={() => { void exportAllJson() }}>Download full backup (JSON)</Btn>
        <Btn variant="danger" disabled={busy} onClick={() => { void eraseAll() }}>
          Erase all data…
        </Btn>
      </div>
      <p className="fineprint">
        The JSON backup covers records; photo files themselves are not included — export
        photos from the Photo Lab.
      </p>
    </div>
  )
}

function ExportPresetForm({ existing, onDone }: { existing: ExportPreset | null; onDone: () => void }) {
  const { saveExportPreset } = useStore()
  const [name, setName] = useState(existing?.name ?? '')
  const [purpose, setPurpose] = useState<ExportPreset['purpose']>(existing?.purpose ?? 'web')
  const [width, setWidth] = useState(existing ? String(existing.width) : '1200')
  const [height, setHeight] = useState(existing ? String(existing.height) : '1200')
  const [format, setFormat] = useState<ExportPreset['format']>(existing?.format ?? 'jpeg')
  const [quality, setQuality] = useState(existing ? String(existing.quality) : '0.85')
  const [fit, setFit] = useState<NonNullable<ExportPreset['fit']>>(existing?.fit ?? 'contain')
  const [maxMb, setMaxMb] = useState(existing?.maxBytes ? String(existing.maxBytes / 1024 / 1024) : '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveExportPreset({
      id: existing?.id ?? uid(),
      name: name.trim() || 'Untitled preset',
      purpose,
      width: Math.max(1, parseInt(width, 10) || 1200),
      height: Math.max(1, parseInt(height, 10) || 1200),
      format,
      quality: Math.min(1, Math.max(0.1, Number(quality) || 0.85)),
      fit,
      padColor: existing?.padColor ?? '#000000',
      maxBytes: Number(maxMb) > 0 ? Math.round(Number(maxMb) * 1024 * 1024) : null,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      <Field label="Preset name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Purpose">
        <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value as ExportPreset['purpose'])}>
          <option value="jury">Juried show</option>
          <option value="web">Web catalog</option>
          <option value="social">Social</option>
        </select>
      </Field>
      <div className="form-row">
        <Field label="Max width (px)"><input className="input" type="number" min="1" inputMode="numeric" value={width} onChange={(e) => setWidth(e.target.value)} /></Field>
        <Field label="Max height (px)"><input className="input" type="number" min="1" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
      </div>
      <div className="form-row">
        <Field label="Format">
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ExportPreset['format'])}>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </Field>
        <Field label="Quality (0.1–1)"><input className="input" type="number" min="0.1" max="1" step="0.05" inputMode="decimal" value={quality} onChange={(e) => setQuality(e.target.value)} /></Field>
      </div>
      <div className="form-row">
        <Field label="Fit">
          <select className="input" value={fit} onChange={(e) => setFit(e.target.value as NonNullable<ExportPreset['fit']>)}>
            <option value="contain">Fit inside (longest side)</option>
            <option value="pad">Exact size, fill with black</option>
            <option value="cover">Exact size, crop to fill</option>
          </select>
        </Field>
        <Field label="Max file size (MB, optional)"><input className="input" type="number" min="0" step="0.5" inputMode="decimal" value={maxMb} onChange={(e) => setMaxMb(e.target.value)} placeholder="e.g. 5" /></Field>
      </div>
      <Btn type="submit" variant="primary">{existing ? 'Save preset' : 'Add preset'}</Btn>
    </form>
  )
}

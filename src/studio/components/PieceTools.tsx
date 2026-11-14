// Piece tools: cost-based pricing calculator (§8.4) and listing pack (§8.8).
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { ExportPreset, Piece } from '../lib/types'
import { calculatePrice } from '../lib/pricing'
import { listingText, type ListingDestination } from '../lib/listing'
import { downloadBlob, draftDescription, exportPhoto, money, slugify } from '../lib/utils'
import { Badge, Btn, Field } from './ui'

const RATES_KEY = 'asw-pricing-rates'

export function PricingCalculator({ piece }: { piece: Piece }) {
  const { milestones, savePiece, placements, placementItems, partnerById } = useStore()
  const ms = milestones.filter((m) => m.pieceId === piece.id)
  const trackedHours = ms.reduce((s, m) => s + (m.timeMinutes ?? 0), 0) / 60
  const trackedGlaze = ms.reduce((s, m) => s + (m.glazeCost ?? 0), 0)
  const trackedClay = ms.reduce((s, m) => s + (parseFloat(m.clayWeight) || 0), 0)
  const activeItem = placementItems.find((i) => i.pieceId === piece.id && i.status === 'held')
  const partner = activeItem ? partnerById(placements.find((p) => p.id === activeItem.placementId)?.partnerId ?? '') : null

  const [open, setOpen] = useState(false)
  const [v, setV] = useState({
    hours: trackedHours ? String(Math.round(trackedHours * 100) / 100) : '',
    hourlyWage: '25', clayWeight: trackedClay ? String(trackedClay) : '', clayCostPerUnit: '1.5',
    glazeCost: trackedGlaze ? String(trackedGlaze) : '', firingFee: '15', otherCosts: '',
    profitPct: '20', commissionPct: String(partner?.commissionPct ?? 50),
  })
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RATES_KEY) ?? '{}') as Partial<typeof v>
      setV((p) => ({ ...p, ...(r.hourlyWage ? { hourlyWage: r.hourlyWage } : {}), ...(r.clayCostPerUnit ? { clayCostPerUnit: r.clayCostPerUnit } : {}), ...(r.firingFee ? { firingFee: r.firingFee } : {}), ...(r.profitPct ? { profitPct: r.profitPct } : {}) }))
    } catch { /* ignore */ }
  }, [])
  const num = (s: string) => Number(s) || 0
  const res = calculatePrice({
    hours: num(v.hours), hourlyWage: num(v.hourlyWage), clayWeight: num(v.clayWeight), clayCostPerUnit: num(v.clayCostPerUnit),
    glazeCost: num(v.glazeCost), firingFee: num(v.firingFee), otherCosts: num(v.otherCosts), profitPct: num(v.profitPct), commissionPct: num(v.commissionPct),
  })
  const cur = piece.currency
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => { setSaved(false); setV({ ...v, [k]: e.target.value }) }
  const input = (k: keyof typeof v, label: string, hint?: string) => (
    <Field label={label} {...(hint ? { hint } : {})}><input className="input" type="number" min="0" step="any" inputMode="decimal" value={v[k]} onChange={set(k)} /></Field>
  )

  if (!open) return <Btn onClick={() => setOpen(true)}>Open pricing calculator</Btn>
  return (
    <div className="card">
      <p className="fineprint">Estimates only — your tracked sessions fill in hours, clay and glaze where recorded. Nothing changes on the piece until you apply it.</p>
      <div className="form-row">{input('hours', 'Work hours', trackedHours ? `${trackedHours.toFixed(1)} h tracked` : undefined)}{input('hourlyWage', 'Hourly wage')}</div>
      <div className="form-row">{input('clayWeight', 'Clay weight (lb)')}{input('clayCostPerUnit', 'Clay cost per lb')}</div>
      <div className="form-row">{input('glazeCost', 'Glaze cost')}{input('firingFee', 'Kiln firing fee')}</div>
      <div className="form-row">{input('otherCosts', 'Other costs')}{input('profitPct', 'Profit margin %')}</div>
      {input('commissionPct', 'Gallery commission %', partner ? `From ${partner.name}` : '50 = a 50/50 consignment split')}
      <dl className="facts">
        <dt>Labor</dt><dd>{money(res.labor, cur)}</dd>
        <dt>Materials &amp; firing</dt><dd>{money(res.materials, cur)}</dd>
        <dt>Total cost</dt><dd>{money(res.totalCost, cur)}</dd>
        <dt>Suggested wholesale</dt><dd><strong>{money(res.wholesale, cur)}</strong></dd>
        <dt>Suggested retail</dt><dd><strong>{money(res.retail, cur)}</strong></dd>
      </dl>
      <p className="fineprint">Wholesale = cost × (1 + margin). Retail = wholesale ÷ (1 − commission), so you still net wholesale after the gallery's share.</p>
      <div className="row-actions">
        <Btn variant="primary" onClick={() => {
          localStorage.setItem(RATES_KEY, JSON.stringify({ hourlyWage: v.hourlyWage, clayCostPerUnit: v.clayCostPerUnit, firingFee: v.firingFee, profitPct: v.profitPct }))
          void savePiece({ ...piece, retailPrice: Math.round(res.retail), wholesalePrice: Math.round(res.wholesale), costBasis: res.totalCost, updatedAt: Date.now() }).then(() => setSaved(true))
        }}>Apply to this piece</Btn>
        <Btn variant="ghost" onClick={() => setOpen(false)}>Close</Btn>
        {saved && <Badge tone="good">Prices saved</Badge>}
      </div>
    </div>
  )
}

const CROPS: Record<ListingDestination, { label: string; preset: ExportPreset }> = {
  instagram: { label: 'Instagram', preset: { id: 'ig', name: 'Instagram', purpose: 'social', width: 1080, height: 1350, format: 'jpeg', quality: 0.9, fit: 'cover' } },
  etsy: { label: 'Etsy', preset: { id: 'etsy', name: 'Etsy', purpose: 'web', width: 2000, height: 1600, format: 'jpeg', quality: 0.9, fit: 'cover' } },
  website: { label: 'Website / shop', preset: { id: 'web', name: 'Website', purpose: 'web', width: 1600, height: 1600, format: 'jpeg', quality: 0.88, fit: 'cover' } },
}

export function ListingPack({ piece }: { piece: Piece }) {
  const { seriesById, profile, photos, aiOutputs } = useStore()
  const series = seriesById(piece.seriesId)
  const photo = photos.find((p) => p.pieceId === piece.id && p.finalApproved) ?? null
  const savedDesc = aiOutputs.find((o) => o.pieceId === piece.id && o.kind === 'description')?.output
  const [dest, setDest] = useState<ListingDestination>('instagram')
  const [desc, setDesc] = useState(savedDesc ?? draftDescription(piece, series, profile))
  const generated = useMemo(() => listingText(piece, series, profile, dest, desc), [piece, series, profile, dest, desc])
  const [text, setText] = useState(generated)
  useEffect(() => setText(generated), [generated])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const download = async () => {
    setBusy(true); setMsg(null)
    try {
      const { zipSync, strToU8 } = await import('fflate')
      const base = `${piece.inventoryNumber}-${slugify(piece.title || 'piece')}-${dest}`
      const files: Record<string, Uint8Array> = { [`${base}/listing.txt`]: strToU8(text) }
      if (photo) {
        const { preset } = CROPS[dest]
        const blob = await exportPhoto(photo.workingCopy ?? photo.master, photo.adjustments, preset)
        files[`${base}/${base}-${preset.width}x${preset.height}.jpg`] = new Uint8Array(await blob.arrayBuffer())
      }
      downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${base}.zip`)
    } catch {
      setMsg('Could not build the pack. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="card">
      {!photo && <div className="alert alert-info">No final approved photo yet — approve one in Photo Lab to include the crop.</div>}
      <Field label="Destination">
        <select className="input" value={dest} onChange={(e) => setDest(e.target.value as ListingDestination)}>
          {(Object.keys(CROPS) as ListingDestination[]).map((k) => <option key={k} value={k}>{CROPS[k].label}</option>)}
        </select>
      </Field>
      <Field label="Description" hint={savedDesc ? 'From your saved AI Studio description.' : 'Built from this piece’s record — edit freely.'}>
        <textarea className="input" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <Field label="Listing text (copy-ready)">
        <textarea className="input draft-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="row-actions">
        <Btn onClick={() => { void navigator.clipboard?.writeText(text).then(() => setMsg('Copied.')).catch(() => undefined) }}>Copy text</Btn>
        <Btn variant="primary" disabled={busy} onClick={() => { void download() }}>{busy ? 'Building…' : `Download pack${photo ? ' (text + photo)' : ' (text)'}`}</Btn>
      </div>
      {msg && <p className="fineprint">{msg}</p>}
      <p className="fineprint">Nothing is posted for you — review the text, then paste it into {CROPS[dest].label}.</p>
    </div>
  )
}

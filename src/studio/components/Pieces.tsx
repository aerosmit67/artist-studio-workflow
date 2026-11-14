// Pieces: searchable inventory list, create/edit form, and detail with
// milestones, photos, history, and sale recording.
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Medium, Piece } from '../lib/types'
import { DEFAULT_LOCATIONS, MEDIUM_LABELS, todayISO, uid } from '../lib/types'
import { money, saleExpectedPayout } from '../lib/utils'
import { Badge, Btn, EmptyState, Field, Modal, go } from './ui'
import { ListingPack, PricingCalculator } from './PieceTools'

export function PieceList() {
  const { pieces, series, seriesById, photos } = useStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [seriesFilter, setSeriesFilter] = useState('all')
  const [quick, setQuick] = useState<'all' | 'available' | 'gallery' | 'missing-photo'>('all')

  const statuses = useMemo(
    () => [...new Set(pieces.map((p) => p.status).filter(Boolean))].sort(),
    [pieces],
  )
  const filtered = pieces
    .filter((p) => !p.archived)
    .filter((p) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      const series = seriesById(p.seriesId)
      return [p.title, p.inventoryNumber, p.status, p.location, p.notes, series?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    .filter((p) => (statusFilter === 'all' ? true : p.status === statusFilter))
    .filter((p) => (seriesFilter === 'all' ? true : p.seriesId === seriesFilter))
    .filter((p) => {
      if (quick === 'available') return p.availableOnline
      if (quick === 'gallery') return p.location !== 'Studio' && p.location !== 'Home inventory' && p.location !== 'Sold'
      if (quick === 'missing-photo')
        return !photos.some((ph) => ph.pieceId === p.id && ph.finalApproved)
      return true
    })

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inventory</h1>
        <Btn variant="primary" onClick={() => go('#/pieces/new')}>＋ Add artwork</Btn>
      </div>
      <input
        className="input search"
        type="search"
        placeholder="Search title, inventory no., series, status, location…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search inventory"
      />
      <div className="filters">
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)} aria-label="Filter by series">
          <option value="all">All series</option>
          <option value="">No series</option>
          {series.filter((s) => !s.archived).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="chips">
        {(['all', 'available', 'gallery', 'missing-photo'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`chip${quick === k ? ' chip-on' : ''}`}
            onClick={() => setQuick(k)}
          >
            {k === 'all' ? 'All' : k === 'available' ? 'Available' : k === 'gallery' ? 'Out of studio' : 'Missing final photo'}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a different search or filter, or add a new piece."
          action={<Btn variant="primary" onClick={() => go('#/pieces/new')}>Add artwork</Btn>}
        />
      ) : (
        <ul className="list">
          {filtered.map((p) => (
            <li key={p.id}>
              <button type="button" className="rowlink" onClick={() => go(`#/pieces/${p.id}`)}>
                <span className="row-title">{p.title || 'Untitled'}</span>
                <span className="row-sub">
                  {p.inventoryNumber} · {p.status} · {p.stage} · {p.location}
                </span>
                <span className="row-right">{money(p.retailPrice, p.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function PieceForm({
  existing,
  presetSeriesId,
  onDone,
}: {
  existing: Piece | null
  presetSeriesId?: string | null
  onDone: () => void
}) {
  const { savePiece, series, stagesFor, nextInventoryNumber, pieces, profile } = useStore()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [seriesId, setSeriesId] = useState<string>(existing?.seriesId ?? presetSeriesId ?? '')
  const [medium, setMedium] = useState<Medium>(existing?.medium ?? 'ceramics')
  const [status, setStatus] = useState(existing?.status ?? 'In progress')
  const [stage, setStage] = useState(existing?.stage ?? 'idea')
  const [dimensions, setDimensions] = useState(existing?.dimensions ?? '')
  const [weight, setWeight] = useState(existing?.weight ?? '')
  const [materials, setMaterials] = useState(existing?.materials ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [createdDate, setCreatedDate] = useState(existing?.createdDate ?? todayISO())
  const [location, setLocation] = useState(existing?.location ?? 'Studio')
  const [availableOnline, setAvailableOnline] = useState(existing?.availableOnline ?? true)
  const [onlineOverride, setOnlineOverride] = useState(existing?.onlineOverride ?? false)
  const [retailPrice, setRetailPrice] = useState(existing?.retailPrice != null ? String(existing.retailPrice) : '')
  const [wholesalePrice, setWholesalePrice] = useState(existing?.wholesalePrice != null ? String(existing.wholesalePrice) : '')
  const [minPrice, setMinPrice] = useState(existing?.minPrice != null ? String(existing.minPrice) : '')
  const [edition, setEdition] = useState(existing?.edition ?? false)
  const [editionSize, setEditionSize] = useState(existing?.editionSize != null ? String(existing.editionSize) : '')
  const [editionSold, setEditionSold] = useState(existing ? String(existing.editionSold) : '0')
  const [costBasis, setCostBasis] = useState(existing?.costBasis != null ? String(existing.costBasis) : '')
  const [inventoryNumber, setInventoryNumber] = useState(existing?.inventoryNumber ?? nextInventoryNumber())
  const [error, setError] = useState<string | null>(null)

  const statuses = useMemo(
    () => [...new Set(pieces.map((p) => p.status).filter(Boolean))].sort(),
    [pieces],
  )
  const stages = stagesFor(medium)
  const chosenSeries = series.find((s) => s.id === seriesId) ?? null

  // Snapshot the series' shared fields into a new piece (inheritance at creation).
  const applySeries = (id: string) => {
    setSeriesId(id)
    if (existing) return
    const s = series.find((x) => x.id === id)
    if (!s) return
    setMedium(s.medium)
    const mats: string[] = []
    if (s.medium === 'ceramics') {
      if (s.clayBody) mats.push(`${s.clayBody} clay`)
      if (s.glaze) mats.push(s.glaze)
    } else {
      if (s.paintMedium) mats.push(s.paintMedium)
      if (s.support) mats.push(`on ${s.support}`)
    }
    if (mats.length) setMaterials(mats.join(', '))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const inv = inventoryNumber.trim()
    const clash = pieces.find((p) => p.inventoryNumber === inv && p.id !== existing?.id)
    if (clash) {
      setError(`Inventory number ${inv} is already used by “${clash.title || 'Untitled'}”. Pick another.`)
      return
    }
    const piece: Piece = {
      id: existing?.id ?? uid(),
      inventoryNumber: inv || nextInventoryNumber(),
      title: title.trim() || 'Untitled',
      seriesId: seriesId || null,
      medium,
      status: status.trim() || 'In progress',
      stage,
      dimensions: dimensions.trim(),
      weight: weight.trim(),
      materials: materials.trim(),
      notes: notes.trim(),
      createdDate,
      location: location.trim() || 'Studio',
      availableOnline,
      onlineOverride,
      retailPrice: numOrNull(retailPrice),
      wholesalePrice: numOrNull(wholesalePrice),
      minPrice: numOrNull(minPrice),
      currency: profile?.currency ?? 'USD',
      edition,
      editionSize: edition ? numOrNull(editionSize) : null,
      editionSold: edition ? Math.max(0, parseInt(editionSold || '0', 10) || 0) : 0,
      costBasis: numOrNull(costBasis),
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await savePiece(piece)
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      {error && <div className="alert alert-warn">{error}</div>}
      <Field label="Title / working name">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Armful Vase" />
      </Field>
      <Field label="Inventory number" hint="Auto-generated. You can override it; duplicates are not allowed.">
        <input className="input" value={inventoryNumber} onChange={(e) => setInventoryNumber(e.target.value)} required />
      </Field>
      <Field label="Series">
        <select className="input" value={seriesId} onChange={(e) => applySeries(e.target.value)}>
          <option value="">No series</option>
          {series.filter((s) => !s.archived).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      {chosenSeries?.pricingGuidance && (
        <p className="fineprint">Series pricing guidance: {chosenSeries.pricingGuidance}</p>
      )}
      <Field label="Medium">
        <select className="input" value={medium} onChange={(e) => setMedium(e.target.value as Medium)}>
          <option value="ceramics">Ceramics</option>
          <option value="painting">Painting</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Status (free-form — you decide the words)" hint="Status changes are artist-only.">
        <input className="input" value={status} onChange={(e) => setStatus(e.target.value)} list="status-list" />
        <datalist id="status-list">
          {statuses.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Stage">
        <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Dimensions">
          <input className="input" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="14 × 9 × 9 in" />
        </Field>
        <Field label="Weight">
          <input className="input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="4.5 lb" />
        </Field>
      </div>
      <Field label="Materials">
        <input className="input" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Clay body, glaze, found objects…" />
      </Field>
      <Field label="Date started">
        <input className="input" type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} />
      </Field>
      <Field label="Location">
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} list="location-list" />
        <datalist id="location-list">
          {DEFAULT_LOCATIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <label className="check">
        <input type="checkbox" checked={availableOnline} onChange={(e) => setAvailableOnline(e.target.checked)} />
        Available for online sale prep
      </label>
      {location !== 'Studio' && location !== 'Home inventory' && availableOnline && (
        <label className="check">
          <input type="checkbox" checked={onlineOverride} onChange={(e) => setOnlineOverride(e.target.checked)} />
          Override: keep it available online even though it is out of the studio (you were warned)
        </label>
      )}
      <div className="form-row">
        <Field label="Retail price"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} /></Field>
        <Field label="Wholesale price"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} /></Field>
        <Field label="Minimum price"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={edition} onChange={(e) => setEdition(e.target.checked)} />
        This is an edition (one record per edition — track size and sold count)
      </label>
      {edition && (
        <div className="form-row">
          <Field label="Edition size"><input className="input" type="number" min="1" inputMode="numeric" value={editionSize} onChange={(e) => setEditionSize(e.target.value)} /></Field>
          <Field label="Sold so far"><input className="input" type="number" min="0" inputMode="numeric" value={editionSold} onChange={(e) => setEditionSold(e.target.value)} /></Field>
        </div>
      )}
      <Field label="Cost basis (optional)" hint="Your recorded costs. Shown as an estimate, never as measured precision.">
        <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} />
      </Field>
      <Field label="Artist notes">
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Btn type="submit" variant="primary">{existing ? 'Save piece' : 'Create piece'}</Btn>
    </form>
  )
}

function MilestoneForm({ pieceId, onDone }: { pieceId: string; onDone: () => void }) {
  const { saveMilestone, pieceById, stagesFor } = useStore()
  const piece = pieceById(pieceId)
  const [date, setDate] = useState(todayISO())
  const [stage, setStage] = useState(piece?.stage ?? 'idea')
  const [notes, setNotes] = useState('')
  const [timeMinutes, setTimeMinutes] = useState('')
  const [clayWeight, setClayWeight] = useState('')
  const [glazeCost, setGlazeCost] = useState('')
  const [otherCosts, setOtherCosts] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveMilestone({
      id: uid(),
      pieceId,
      date,
      stage,
      notes: notes.trim(),
      timeMinutes: timeMinutes.trim() ? parseInt(timeMinutes, 10) || null : null,
      clayWeight: clayWeight.trim(),
      glazeCost: glazeCost.trim() ? Number(glazeCost) || null : null,
      otherCosts: otherCosts.trim(),
      createdAt: Date.now(),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="form-row">
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Stage">
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            {stagesFor(piece?.medium ?? 'ceramics').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Field label="Estimated time (minutes)" hint="An estimate after the session — no timer.">
        <input className="input" type="number" min="0" inputMode="numeric" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Clay weight"><input className="input" value={clayWeight} onChange={(e) => setClayWeight(e.target.value)} placeholder="e.g. 6 lb speckled buff" /></Field>
        <Field label="Glaze cost"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={glazeCost} onChange={(e) => setGlazeCost(e.target.value)} /></Field>
      </div>
      <Field label="Other costs (free text)"><input className="input" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} placeholder="e.g. found metal $12, kiln share" /></Field>
      <Btn type="submit" variant="primary">Save milestone</Btn>
    </form>
  )
}

function SaleForm({ piece, onDone }: { piece: Piece; onDone: () => void }) {
  const { recordSale, placementItems } = useStore()
  const [channel, setChannel] = useState('Gallery')
  const [date, setDate] = useState(todayISO())
  const [salePrice, setSalePrice] = useState(piece.retailPrice != null ? String(piece.retailPrice) : '')
  const [discount, setDiscount] = useState('')
  const [commissionPct, setCommissionPct] = useState('40')
  const [fees, setFees] = useState('')
  const [actualPayout, setActualPayout] = useState('')
  const [actualPayoutDate, setActualPayoutDate] = useState('')
  const [notes, setNotes] = useState('')

  const price = Number(salePrice) || 0
  const expected = saleExpectedPayout(price, Number(discount) || 0, Number(commissionPct) || 0, Number(fees) || 0)
  const activePlacement = placementItems.find(
    (i) => i.pieceId === piece.id && i.status === 'held',
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await recordSale({
      id: uid(),
      pieceId: piece.id,
      placementId: activePlacement?.placementId ?? null,
      channel,
      date,
      salePrice: price,
      discount: Number(discount) || 0,
      commissionPct: Number(commissionPct) || 0,
      fees: Number(fees) || 0,
      expectedPayout: expected,
      actualPayout: actualPayout.trim() ? Number(actualPayout) : null,
      actualPayoutDate: actualPayoutDate || null,
      status: actualPayout.trim() ? 'received' : 'expected',
      notes: notes.trim(),
      createdAt: Date.now(),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      <Field label="Channel">
        <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option>Gallery</option>
          <option>Online</option>
          <option>Fair / event</option>
          <option>Direct</option>
        </select>
      </Field>
      <div className="form-row">
        <Field label="Sale date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Sale price"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required /></Field>
      </div>
      <div className="form-row">
        <Field label="Discount"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
        <Field label="Commission %"><input className="input" type="number" min="0" max="100" step="0.5" inputMode="decimal" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} /></Field>
        <Field label="Fees"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} /></Field>
      </div>
      <p className="callout">
        Expected payout: <strong>{money(expected, piece.currency)}</strong>
        {' '}— sale price minus discount, minus {commissionPct || 0}% commission, minus fees.
        This is an expectation, not money received.
      </p>
      <Field label="Actual payout received (optional)">
        <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={actualPayout} onChange={(e) => setActualPayout(e.target.value)} />
      </Field>
      {actualPayout.trim() && (
        <Field label="Date received">
          <input className="input" type="date" value={actualPayoutDate} onChange={(e) => setActualPayoutDate(e.target.value)} />
        </Field>
      )}
      <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Btn type="submit" variant="primary">Record sale</Btn>
    </form>
  )
}

export function PieceDetail({ id }: { id: string }) {
  const { pieceById, seriesById, photos, milestones, history, archivePiece, photoUrl, profile } = useStore()
  const [editing, setEditing] = useState(false)
  const [showMilestone, setShowMilestone] = useState(false)
  const [showSale, setShowSale] = useState(false)
  const piece = pieceById(id)
  if (!piece) {
    return (
      <div className="page">
        <EmptyState title="Piece not found" action={<Btn onClick={() => go('#/pieces')}>Back to inventory</Btn>} />
      </div>
    )
  }
  if (editing) {
    return (
      <div className="page">
        <h1>Edit piece</h1>
        <PieceForm existing={piece} onDone={() => setEditing(false)} />
      </div>
    )
  }
  const series = seriesById(piece.seriesId)
  const piecePhotos = photos.filter((ph) => ph.pieceId === piece.id)
  const pieceMilestones = milestones.filter((m) => m.pieceId === piece.id)
  const pieceHistory = history.filter((h) => h.pieceId === piece.id)
  const finalPhoto = piecePhotos.find((ph) => ph.finalApproved)
  const outOfStudio = piece.location !== 'Studio' && piece.location !== 'Home inventory' && piece.location !== 'Sold'

  return (
    <div className="page">
      <div className="page-head">
        <h1>{piece.title}</h1>
        <Btn onClick={() => setEditing(true)}>Edit</Btn>
      </div>
      <p className="lede">{piece.inventoryNumber}{series ? ` · ${series.name}` : ''}</p>
      <div className="badges">
        <Badge tone="info">{piece.status}</Badge>
        <Badge>{piece.stage}</Badge>
        <Badge tone={outOfStudio ? 'warn' : 'muted'}>{piece.location}</Badge>
        {piece.availableOnline ? <Badge tone="good">Available online</Badge> : <Badge>Not available online</Badge>}
        {piece.edition && <Badge>Edition of {piece.editionSize ?? '?'} · {piece.editionSold} sold</Badge>}
        {finalPhoto && <Badge tone="good">Final photo approved</Badge>}
      </div>
      {outOfStudio && piece.availableOnline && !piece.onlineOverride && (
        <div className="alert alert-warn">
          This piece is out of the studio but still marked available online. Turn availability off, or confirm the override in Edit.
        </div>
      )}
      <dl className="facts">
        <dt>Medium</dt><dd>{MEDIUM_LABELS[piece.medium]}</dd>
        {piece.dimensions && <><dt>Dimensions</dt><dd>{piece.dimensions}</dd></>}
        {piece.weight && <><dt>Weight</dt><dd>{piece.weight}</dd></>}
        {piece.materials && <><dt>Materials</dt><dd>{piece.materials}</dd></>}
        {piece.createdDate && <><dt>Started</dt><dd>{piece.createdDate}</dd></>}
        <dt>Retail price</dt><dd>{money(piece.retailPrice, piece.currency)}</dd>
        {piece.wholesalePrice !== null && <><dt>Wholesale</dt><dd>{money(piece.wholesalePrice, piece.currency)}</dd></>}
        {piece.minPrice !== null && <><dt>Minimum</dt><dd>{money(piece.minPrice, piece.currency)}</dd></>}
        {piece.costBasis !== null && <><dt>Cost basis (est.)</dt><dd>{money(piece.costBasis, piece.currency)}</dd></>}
        {piece.notes && <><dt>Notes</dt><dd>{piece.notes}</dd></>}
      </dl>

      <h2>Photos ({piecePhotos.length})</h2>
      {piecePhotos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          body="Capture progress photos as you work, or add finished photos before listing."
          action={<Btn onClick={() => go(`#/capture?piece=${piece.id}`)}>Capture a photo</Btn>}
        />
      ) : (
        <div className="thumbs">
          {piecePhotos.map((ph) => {
            const url = photoUrl(ph)
            return (
              <button key={ph.id} type="button" className="thumb" onClick={() => go(`#/photolab/${ph.id}`)}>
                {url ? (
                  <img src={url} alt={ph.caption || ph.stage} />
                ) : (
                  <span className="thumb-missing">HEIC master stored — no preview in this browser</span>
                )}
                <span className="thumb-cap">{ph.category}{ph.finalApproved ? ' · final' : ''}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="row-actions">
        <Btn onClick={() => go(`#/capture?piece=${piece.id}`)}>📷 Add photo</Btn>
        <Btn onClick={() => go('#/photolab')}>Open Photo Lab</Btn>
      </div>

      <h2>Pricing calculator</h2>
      <PricingCalculator piece={piece} />

      <h2>Listing pack</h2>
      <ListingPack piece={piece} />

      <h2>Milestones</h2>
      {pieceMilestones.length === 0 ? (
        <p className="fineprint">No sessions recorded yet. Add one after a studio session — time and costs are estimates.</p>
      ) : (
        <ul className="list">
          {pieceMilestones.map((m) => (
            <li key={m.id} className="list-item">
              <span className="row-title">{m.stage} · {m.date}</span>
              <span className="row-sub">
                {m.timeMinutes !== null ? `${m.timeMinutes} min · ` : ''}
                {m.clayWeight ? `${m.clayWeight} · ` : ''}
                {m.glazeCost !== null ? `glaze ${money(m.glazeCost, profile?.currency)} · ` : ''}
                {m.otherCosts}
                {m.notes ? ` — ${m.notes}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showMilestone ? (
        <MilestoneForm pieceId={piece.id} onDone={() => setShowMilestone(false)} />
      ) : (
        <Btn onClick={() => setShowMilestone(true)}>＋ Add milestone / session</Btn>
      )}

      <h2>History</h2>
      {pieceHistory.length === 0 ? (
        <p className="fineprint">No status, location, or stage changes recorded yet.</p>
      ) : (
        <ul className="list">
          {pieceHistory.slice(0, 10).map((h) => (
            <li key={h.id} className="list-item">
              <span className="row-sub">
                {new Date(h.date).toLocaleDateString()} · {h.kind}: {h.from || '—'} → {h.to}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="row-actions">
        <Btn variant="primary" onClick={() => setShowSale(true)}>Record sale</Btn>
        <Btn variant="ghost" onClick={() => { void archivePiece(piece.id, !piece.archived); }}>
          {piece.archived ? 'Restore piece' : 'Archive piece'}
        </Btn>
      </div>
      {showSale && (
        <Modal title="Record sale" onClose={() => setShowSale(false)}>
          <SaleForm piece={piece} onDone={() => setShowSale(false)} />
        </Modal>
      )}
    </div>
  )
}

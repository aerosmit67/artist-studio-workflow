// Partners, placements, printable manifest, sales, and reports.
// Expected payout = retail × (1 − commission%) everywhere, shown as an
// expectation — never as money received.
import { useState } from 'react'
import { useStore } from '../store'
import type { Partner } from '../lib/types'
import { todayISO, uid } from '../lib/types'
import { downloadText, expectedPayout, money, toCSV } from '../lib/utils'
import { Badge, Btn, EmptyState, Field, Modal, go } from './ui'

export function PartnersHub() {
  const { partners, placements, placementItems, partnerById } = useStore()
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const activePartners = partners.filter((p) => !p.archived)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Partners &amp; placements</h1>
        <Btn variant="primary" onClick={() => go('#/placements/new')}>＋ New placement</Btn>
      </div>

      <h2>Partners</h2>
      {activePartners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          body="Add a gallery, shop, or event with its commission terms before placing work."
          action={<Btn variant="primary" onClick={() => setShowPartnerForm(true)}>Add partner</Btn>}
        />
      ) : (
        <ul className="list">
          {activePartners.map((p) => {
            const held = placementItems.filter(
              (i) => i.status === 'held' && placements.some((pl) => pl.id === i.placementId && pl.partnerId === p.id),
            ).length
            return (
              <li key={p.id}>
                <button type="button" className="rowlink" onClick={() => go(`#/partners/${p.id}`)}>
                  <span className="row-title">{p.name}</span>
                  <span className="row-sub">
                    {p.kind} · {p.commissionPct}% commission · {held} piece{held === 1 ? '' : 's'} held
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Btn onClick={() => setShowPartnerForm(true)}>＋ Add partner</Btn>
      {showPartnerForm && (
        <Modal title="Add partner" onClose={() => setShowPartnerForm(false)}>
          <PartnerForm existing={null} onDone={() => setShowPartnerForm(false)} />
        </Modal>
      )}

      <h2>Placements</h2>
      {placements.length === 0 ? (
        <p className="fineprint">No placements yet. Delivering work to a gallery creates one here.</p>
      ) : (
        <ul className="list">
          {placements.map((pl) => {
            const partner = partnerById(pl.partnerId)
            const items = placementItems.filter((i) => i.placementId === pl.id)
            const held = items.filter((i) => i.status === 'held').length
            const payout = items.filter((i) => i.status === 'held').reduce((s, i) => s + i.expectedPayout, 0)
            return (
              <li key={pl.id}>
                <button type="button" className="rowlink" onClick={() => go(`#/placements/${pl.id}`)}>
                  <span className="row-title">{partner?.name ?? 'Unknown partner'}</span>
                  <span className="row-sub">
                    Delivered {pl.deliveryDate} · {held} held · expected payout {money(payout)}
                    {pl.status === 'closed' ? ' · Closed' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="row-actions">
        <Btn onClick={() => go('#/sales')}>Sales</Btn>
        <Btn onClick={() => go('#/reports')}>Reports &amp; exports</Btn>
      </div>
      <p className="fineprint">
        A piece in an active placement is unavailable for online sale prep unless you
        explicitly override it. Use the piece record to override.
      </p>
      <p className="fineprint">
        Records here are not legal advice or a signed agreement. The manifest is a
        record only — no signature.
      </p>
    </div>
  )
}

export function PartnerForm({ existing, onDone }: { existing: Partner | null; onDone: () => void }) {
  const { savePartner } = useStore()
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState(existing?.kind ?? 'Gallery')
  const [contact, setContact] = useState(existing?.contact ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [commissionPct, setCommissionPct] = useState(existing ? String(existing.commissionPct) : '40')
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await savePartner({
      id: existing?.id ?? uid(),
      name: name.trim() || 'Unnamed partner',
      kind,
      contact: contact.trim(),
      email: email.trim(),
      phone: phone.trim(),
      commissionPct: Number(commissionPct) || 0,
      paymentTerms: paymentTerms.trim(),
      notes: notes.trim(),
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      <Field label="Partner name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Type">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option>Gallery</option>
          <option>Shop</option>
          <option>Event</option>
          <option>Other</option>
        </select>
      </Field>
      <Field label="Contact person"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Commission %" hint="Used for expected payout: retail × (1 − commission%).">
        <input className="input" type="number" min="0" max="100" step="0.5" inputMode="decimal" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
      </Field>
      <Field label="Payment terms"><input className="input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30 after sale" /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Btn type="submit" variant="primary">{existing ? 'Save partner' : 'Add partner'}</Btn>
    </form>
  )
}

export function PartnerDetail({ id }: { id: string }) {
  const { partnerById, placements, placementItems, archivePartner } = useStore()
  const [editing, setEditing] = useState(false)
  const p = partnerById(id)
  if (!p) {
    return (
      <div className="page">
        <EmptyState title="Partner not found" action={<Btn onClick={() => go('#/partners')}>Back to partners</Btn>} />
      </div>
    )
  }
  const partnerPlacements = placements.filter((pl) => pl.partnerId === p.id)
  const held = placementItems.filter(
    (i) => i.status === 'held' && partnerPlacements.some((pl) => pl.id === i.placementId),
  ).length
  if (editing) {
    return (
      <div className="page">
        <h1>Edit partner</h1>
        <PartnerForm existing={p} onDone={() => setEditing(false)} />
      </div>
    )
  }
  return (
    <div className="page">
      <div className="page-head">
        <h1>{p.name}</h1>
        <Btn onClick={() => setEditing(true)}>Edit</Btn>
      </div>
      <p className="lede">{p.kind}{p.archived ? ' · Archived' : ''}</p>
      <dl className="facts">
        {p.contact && <><dt>Contact</dt><dd>{p.contact}</dd></>}
        {p.email && <><dt>Email</dt><dd>{p.email}</dd></>}
        {p.phone && <><dt>Phone</dt><dd>{p.phone}</dd></>}
        <dt>Commission</dt><dd>{p.commissionPct}%</dd>
        {p.paymentTerms && <><dt>Payment terms</dt><dd>{p.paymentTerms}</dd></>}
        {p.notes && <><dt>Notes</dt><dd>{p.notes}</dd></>}
        <dt>Pieces held</dt><dd>{held}</dd>
      </dl>
      <h2>Placements</h2>
      {partnerPlacements.length === 0 ? (
        <p className="fineprint">No placements with this partner yet.</p>
      ) : (
        <ul className="list">
          {partnerPlacements.map((pl) => (
            <li key={pl.id}>
              <button type="button" className="rowlink" onClick={() => go(`#/placements/${pl.id}`)}>
                <span className="row-title">Delivered {pl.deliveryDate}</span>
                <span className="row-sub">{pl.status === 'closed' ? 'Closed' : 'Active'}{pl.returnDate ? ` · return by ${pl.returnDate}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Btn variant="ghost" onClick={() => { void archivePartner(p.id, !p.archived); }}>
        {p.archived ? 'Restore partner' : 'Archive partner'}
      </Btn>
    </div>
  )
}

export function PlacementForm() {
  const { partners, pieces, placementItems, createPlacement, profile } = useStore()
  const [partnerId, setPartnerId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(todayISO())
  const [returnDate, setReturnDate] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const partner = partners.find((p) => p.id === partnerId) ?? null
  const placedPieceIds = new Set(placementItems.filter((i) => i.status === 'held').map((i) => i.pieceId))
  const available = pieces.filter(
    (p) => !p.archived && p.status !== 'Sold' && !placedPieceIds.has(p.id),
  )
  const lines = Object.entries(selected)
    .map(([pieceId, price]) => ({ pieceId, retailPrice: Number(price) || 0 }))
    .filter((l) => l.retailPrice > 0)
  const totalExpected = lines.reduce(
    (s, l) => s + expectedPayout(l.retailPrice, partner?.commissionPct ?? 0),
    0,
  )

  const toggle = (pieceId: string, defaultPrice: number | null) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (pieceId in next) delete next[pieceId]
      else next[pieceId] = defaultPrice != null ? String(defaultPrice) : ''
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partner) {
      setError('Choose a partner first.')
      return
    }
    if (lines.length === 0) {
      setError('Choose at least one piece with a retail price.')
      return
    }
    await createPlacement(partnerId, deliveryDate, returnDate, notes.trim(), lines)
    go('#/partners')
  }

  return (
    <div className="page">
      <h1>New placement</h1>
      <p className="lede">
        Delivering pieces moves them to the partner and makes them unavailable for
        online sale prep. Expected payout is retail × (1 − commission%).
      </p>
      {error && <div className="alert alert-warn">{error}</div>}
      <form onSubmit={submit} className="form">
        <Field label="Partner">
          <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Choose a partner…</option>
            {partners.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.commissionPct}% commission</option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Delivery date"><input className="input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required /></Field>
          <Field label="Return / review date"><input className="input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <h2>Pieces</h2>
        {available.length === 0 ? (
          <EmptyState title="No pieces available to place" body="Pieces already in an active placement or sold are not listed." />
        ) : (
          <ul className="list">
            {available.map((p) => {
              const checked = p.id in selected
              return (
                <li key={p.id} className="list-item">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id, p.retailPrice)}
                    />
                    <span>
                      <span className="row-title">{p.title || 'Untitled'} · {p.inventoryNumber}</span>
                      <span className="row-sub">{p.status} · {p.location}</span>
                    </span>
                  </label>
                  {checked && (
                    <Field label="Agreed retail price">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={selected[p.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </Field>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {lines.length > 0 && partner && (
          <p className="callout">
            Total expected payout: <strong>{money(totalExpected, profile?.currency)}</strong>
            {' '}({lines.length} piece{lines.length > 1 ? 's' : ''} at {partner.commissionPct}% commission)
          </p>
        )}
        <Btn type="submit" variant="primary">Confirm placement</Btn>
      </form>
    </div>
  )
}

export function PlacementDetail({ id }: { id: string }) {
  const { placements, placementItems, partnerById, pieceById, updatePlacementItem, closePlacement, profile, photoUrl, photos } = useStore()
  const pl = placements.find((p) => p.id === id) ?? null
  if (!pl) {
    return (
      <div className="page">
        <EmptyState title="Placement not found" action={<Btn onClick={() => go('#/partners')}>Back to partners</Btn>} />
      </div>
    )
  }
  const partner = partnerById(pl.partnerId)
  const items = placementItems.filter((i) => i.placementId === pl.id)
  const held = items.filter((i) => i.status === 'held')
  const totalExpected = held.reduce((s, i) => s + i.expectedPayout, 0)
  const overdue = pl.status === 'active' && pl.returnDate && pl.returnDate < todayISO() && held.length > 0

  return (
    <div className="page">
      <div className="page-head">
        <h1>{partner?.name ?? 'Placement'}</h1>
        <Btn onClick={() => go(`#/placements/${pl.id}/manifest`)}>Manifest</Btn>
      </div>
      <p className="lede">
        Delivered {pl.deliveryDate}
        {pl.returnDate ? ` · return by ${pl.returnDate}` : ''}
        {' · '}{pl.status === 'closed' ? 'Closed' : 'Active'}
      </p>
      {overdue && <div className="alert alert-warn">Past the return date with pieces still held.</div>}
      {pl.notes && <p>{pl.notes}</p>}
      <p className="callout">
        Expected payout for held pieces: <strong>{money(totalExpected, profile?.currency)}</strong>
        {' '}— retail minus {partner?.commissionPct ?? 0}% commission. An expectation, not money received.
      </p>
      <h2>Items</h2>
      <ul className="list">
        {items.map((item) => {
          const piece = pieceById(item.pieceId)
          const thumb = photos.find((ph) => ph.pieceId === item.pieceId && ph.finalApproved) ??
            photos.find((ph) => ph.pieceId === item.pieceId)
          const thumbUrl = thumb ? photoUrl(thumb) : null
          return (
            <li key={item.id} className="list-item">
              <div className="manifest-row">
                {thumbUrl && <img src={thumbUrl} alt="" className="manifest-thumb" />}
                <div>
                  <span className="row-title">{piece?.title || 'Unknown piece'}</span>
                  <span className="row-sub">
                    {piece?.inventoryNumber} · retail {money(item.retailPrice, profile?.currency)} ·{' '}
                    expected payout {money(item.expectedPayout, profile?.currency)}
                  </span>
                  <span className="row-sub">
                    <Badge tone={item.status === 'held' ? 'info' : item.status === 'sold' ? 'good' : 'muted'}>
                      {item.status}
                    </Badge>
                  </span>
                </div>
              </div>
              {pl.status === 'active' && (
                <div className="row-actions">
                  {item.status === 'held' && (
                    <>
                      <Btn onClick={() => { void updatePlacementItem(item.id, 'returned') }}>Mark returned</Btn>
                      <Btn onClick={() => { void updatePlacementItem(item.id, 'sold') }}>Mark sold</Btn>
                    </>
                  )}
                  {item.status !== 'held' && (
                    <Btn variant="ghost" onClick={() => { void updatePlacementItem(item.id, 'held') }}>Back to held</Btn>
                  )}
                  {piece && <Btn variant="ghost" onClick={() => go(`#/pieces/${piece.id}`)}>Open piece</Btn>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {pl.status === 'active' && (
        <Btn
          variant="danger"
          onClick={() => {
            if (window.confirm('Close this placement? Any pieces still held will be returned to the studio.')) {
              void closePlacement(pl.id)
            }
          }}
        >
          Close placement
        </Btn>
      )}
    </div>
  )
}

export function ManifestView({ id }: { id: string }) {
  const { placements, placementItems, partnerById, pieceById, profile, photoUrl, photos } = useStore()
  const pl = placements.find((p) => p.id === id) ?? null
  if (!pl) {
    return (
      <div className="page">
        <EmptyState title="Placement not found" action={<Btn onClick={() => go('#/partners')}>Back to partners</Btn>} />
      </div>
    )
  }
  const partner = partnerById(pl.partnerId)
  const items = placementItems.filter((i) => i.placementId === pl.id)
  const totalRetail = items.reduce((s, i) => s + i.retailPrice, 0)
  const totalExpected = items.reduce((s, i) => s + i.expectedPayout, 0)

  return (
    <div className="page manifest-page">
      <div className="page-head no-print">
        <h1>Manifest</h1>
        <Btn variant="primary" onClick={() => window.print()}>Print / save as PDF</Btn>
      </div>
      <div className="manifest">
        <h1>{profile?.brand || profile?.name || 'Artist'}</h1>
        <p>{profile?.name} · {profile?.location}</p>
        <h2>Consignment manifest — {partner?.name ?? 'Partner'}</h2>
        <dl className="facts">
          <dt>Delivery date</dt><dd>{pl.deliveryDate}</dd>
          {pl.returnDate && <><dt>Return / review date</dt><dd>{pl.returnDate}</dd></>}
          <dt>Commission</dt><dd>{partner?.commissionPct ?? 0}%</dd>
          {partner?.paymentTerms && <><dt>Payment terms</dt><dd>{partner.paymentTerms}</dd></>}
          {pl.notes && <><dt>Notes</dt><dd>{pl.notes}</dd></>}
        </dl>
        <table className="manifest-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Inventory</th>
              <th>Title</th>
              <th>Retail</th>
              <th>Expected payout</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const piece = pieceById(item.pieceId)
              const thumb = photos.find((ph) => ph.pieceId === item.pieceId && ph.finalApproved) ??
                photos.find((ph) => ph.pieceId === item.pieceId)
              const thumbUrl = thumb ? photoUrl(thumb) : null
              return (
                <tr key={item.id}>
                  <td>{thumbUrl ? <img src={thumbUrl} alt="" className="manifest-thumb" /> : '—'}</td>
                  <td>{piece?.inventoryNumber ?? '—'}</td>
                  <td>{piece?.title || 'Unknown piece'}</td>
                  <td>{money(item.retailPrice, profile?.currency)}</td>
                  <td>{money(item.expectedPayout, profile?.currency)}</td>
                  <td>{item.status}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Totals</td>
              <td>{money(totalRetail, profile?.currency)}</td>
              <td>{money(totalExpected, profile?.currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="fineprint">
          Expected payout = retail price minus commission ({partner?.commissionPct ?? 0}%). This
          manifest is a record only — not a signed agreement and not legal advice.
        </p>
      </div>
    </div>
  )
}

export function SalesList() {
  const { sales, pieceById, deleteSale, updateSalePayout, profile } = useStore()
  const [editingPayout, setEditingPayout] = useState<string | null>(null)
  const [payoutValue, setPayoutValue] = useState('')
  const [payoutDate, setPayoutDate] = useState(todayISO())

  const confirmed = sales.filter((s) => s.status !== 'expected').reduce((sum, s) => sum + s.salePrice, 0)
  const received = sales.reduce((sum, s) => sum + (s.actualPayout ?? 0), 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Sales</h1>
        <Btn variant="primary" onClick={() => go('#/pieces')}>Record from a piece</Btn>
      </div>
      <p className="lede">
        Confirmed sales {money(confirmed, profile?.currency)} · payouts actually received{' '}
        {money(received, profile?.currency)} — kept separate from expectations.
      </p>
      {sales.length === 0 ? (
        <EmptyState
          title="No sales yet"
          body="Record a sale from a piece’s detail page, or from a placement item."
        />
      ) : (
        <ul className="list">
          {sales.map((s) => {
            const piece = pieceById(s.pieceId)
            return (
              <li key={s.id} className="list-item">
                <span className="row-title">{piece?.title || 'Unknown piece'} · {s.date}</span>
                <span className="row-sub">
                  {s.channel} · sale {money(s.salePrice, profile?.currency)} · expected payout{' '}
                  {money(s.expectedPayout, profile?.currency)} ·{' '}
                  {s.actualPayout !== null
                    ? `received ${money(s.actualPayout, profile?.currency)}${s.actualPayoutDate ? ` on ${s.actualPayoutDate}` : ''}`
                    : 'payout not yet received'}
                  {' · '}<Badge tone={s.status === 'received' ? 'good' : s.status === 'confirmed' ? 'info' : 'warn'}>{s.status}</Badge>
                </span>
                <div className="row-actions">
                  {s.actualPayout === null && (
                    editingPayout === s.id ? (
                      <>
                        <input
                          className="input inline"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="Amount received"
                          value={payoutValue}
                          onChange={(e) => setPayoutValue(e.target.value)}
                        />
                        <input
                          className="input inline"
                          type="date"
                          value={payoutDate}
                          onChange={(e) => setPayoutDate(e.target.value)}
                        />
                        <Btn
                          variant="primary"
                          onClick={() => {
                            void updateSalePayout(s.id, payoutValue.trim() ? Number(payoutValue) : null, payoutDate || null)
                            setEditingPayout(null)
                          }}
                        >
                          Save payout
                        </Btn>
                      </>
                    ) : (
                      <Btn onClick={() => { setEditingPayout(s.id); setPayoutValue(''); }}>Record payout received</Btn>
                    )
                  )}
                  <Btn
                    variant="danger"
                    onClick={() => {
                      if (window.confirm('Delete this sale record? The piece status is left for you to correct.')) {
                        void deleteSale(s.id)
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Reports() {
  const { pieces, sales, placements, placementItems, profile, seriesById } = useStore()
  const activePieces = pieces.filter((p) => !p.archived)
  const askingValue = activePieces.reduce((s, p) => s + (p.retailPrice ?? 0), 0)
  const expectedHeld = placementItems.filter((i) => i.status === 'held').reduce((s, i) => s + i.expectedPayout, 0)
  const confirmed = sales.reduce((s, x) => s + x.salePrice, 0)
  const received = sales.reduce((s, x) => s + (x.actualPayout ?? 0), 0)
  const overdue = placements.filter(
    (pl) =>
      pl.status === 'active' &&
      pl.returnDate &&
      pl.returnDate < todayISO() &&
      placementItems.some((i) => i.placementId === pl.id && i.status === 'held'),
  )
  const unpaid = sales.filter((s) => s.actualPayout === null)

  const exportInventory = () => {
    const rows: (string | number | null)[][] = [
      ['Inventory Number', 'Title', 'Series', 'Medium', 'Status', 'Stage', 'Location', 'Retail Price', 'Wholesale Price', 'Available Online', 'Edition', 'Edition Size', 'Edition Sold'],
      ...activePieces.map((p) => [
        p.inventoryNumber,
        p.title,
        seriesById(p.seriesId)?.name ?? '',
        p.medium,
        p.status,
        p.stage,
        p.location,
        p.retailPrice,
        p.wholesalePrice,
        p.availableOnline ? 'yes' : 'no',
        p.edition ? 'yes' : 'no',
        p.editionSize,
        p.editionSold,
      ]),
    ]
    downloadText(toCSV(rows), 'inventory.csv', 'text/csv')
  }

  const exportSales = () => {
    const rows: (string | number | null)[][] = [
      ['Date', 'Piece', 'Channel', 'Sale Price', 'Discount', 'Commission %', 'Fees', 'Expected Payout', 'Actual Payout', 'Status'],
      ...sales.map((s) => [
        s.date,
        s.pieceId,
        s.channel,
        s.salePrice,
        s.discount,
        s.commissionPct,
        s.fees,
        s.expectedPayout,
        s.actualPayout,
        s.status,
      ]),
    ]
    downloadText(toCSV(rows), 'sales.csv', 'text/csv')
  }

  return (
    <div className="page">
      <h1>Reports</h1>
      <div className="stats">
        <div className="stat"><strong>{money(askingValue, profile?.currency)}</strong><span>asking value</span></div>
        <div className="stat"><strong>{money(expectedHeld, profile?.currency)}</strong><span>expected payout (held)</span></div>
        <div className="stat"><strong>{money(confirmed, profile?.currency)}</strong><span>confirmed sales</span></div>
        <div className="stat"><strong>{money(received, profile?.currency)}</strong><span>payouts received</span></div>
      </div>
      <p className="fineprint">
        Expected amounts are projections, not guarantees. Confirmed sales and received
        payouts are the only money that has actually happened.
      </p>
      <h2>Needs attention</h2>
      {overdue.length === 0 && unpaid.length === 0 ? (
        <p className="fineprint">Nothing overdue. No unpaid payouts.</p>
      ) : (
        <ul className="list">
          {overdue.map((pl) => (
            <li key={pl.id} className="list-item">
              <span className="row-title">Overdue return</span>
              <span className="row-sub">
                Placement delivered {pl.deliveryDate}, return was due {pl.returnDate}.{' '}
                <button type="button" className="link" onClick={() => go(`#/placements/${pl.id}`)}>Open placement</button>
              </span>
            </li>
          ))}
          {unpaid.map((s) => (
            <li key={s.id} className="list-item">
              <span className="row-title">Unpaid payout</span>
              <span className="row-sub">
                Expected {money(s.expectedPayout, profile?.currency)} from {s.date} sale ({s.channel}).{' '}
                <button type="button" className="link" onClick={() => go('#/sales')}>Record payout</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h2>Export</h2>
      <div className="row-actions">
        <Btn onClick={exportInventory}>Download inventory CSV</Btn>
        <Btn onClick={exportSales}>Download sales CSV</Btn>
      </div>
      <p className="fineprint">
        CSV exports are your portable backup — inventory and sales, with expected and
        actual payouts kept distinct.
      </p>
    </div>
  )
}

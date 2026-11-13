// Studio home: quick actions, alerts, and a glance at the work.
import { useStore } from '../store'
import { money } from '../lib/utils'
import { Badge, Btn, EmptyState, go } from './ui'

export function Home() {
  const { profile, pieces, placements, placementItems, sales, outbox, photos, syncing } = useStore()

  const activePieces = pieces.filter((p) => !p.archived)
  const atGallery = activePieces.filter((p) => p.location !== 'Studio' && p.location !== 'Home inventory' && p.location !== 'Sold')
  const askingValue = activePieces.reduce((sum, p) => sum + (p.retailPrice ?? 0), 0)
  const expectedPayout = placementItems
    .filter((i) => i.status === 'held')
    .reduce((sum, i) => sum + i.expectedPayout, 0)
  const unpaid = sales.filter((s) => s.actualPayout === null)
  const overdue = placements.filter(
    (pl) =>
      pl.status === 'active' &&
      pl.returnDate &&
      pl.returnDate < new Date().toISOString().slice(0, 10) &&
      placementItems.some((i) => i.placementId === pl.id && i.status === 'held'),
  )
  const missingFinal = activePieces.filter(
    (p) => !photos.some((ph) => ph.pieceId === p.id && ph.finalApproved),
  )
  const recent = activePieces.slice(0, 5)

  return (
    <div className="page">
      <h1>{profile ? `${profile.brand || profile.name}` : 'Studio'}</h1>
      <p className="lede">
        {profile ? `${profile.name} · ${profile.location}` : 'Your studio workspace'}
      </p>

      {outbox.length > 0 && (
        <div className="alert alert-info">
          {syncing
            ? `Syncing ${outbox.length} queued capture${outbox.length > 1 ? 's' : ''}…`
            : `${outbox.length} capture${outbox.length > 1 ? 's' : ''} queued offline — will sync when you’re back online.`}
        </div>
      )}
      {overdue.length > 0 && (
        <div className="alert alert-warn">
          {overdue.length} placement{overdue.length > 1 ? 's are' : ' is'} past {overdue.length > 1 ? 'their' : 'its'} return date.{' '}
          <button type="button" className="link" onClick={() => go('#/partners')}>Review placements</button>
        </div>
      )}
      {unpaid.length > 0 && (
        <div className="alert alert-warn">
          {unpaid.length} sale{unpaid.length > 1 ? 's are' : ' is'} waiting on payout.{' '}
          <button type="button" className="link" onClick={() => go('#/sales')}>Review sales</button>
        </div>
      )}

      <div className="actions">
        <Btn variant="primary" onClick={() => go('#/capture')}>📷 Capture progress</Btn>
        <Btn onClick={() => go('#/pieces/new')}>＋ Add artwork</Btn>
        <Btn onClick={() => go('#/series/new')}>＋ Add series</Btn>
        <Btn onClick={() => go('#/capture')}>🖼 Photograph finished work</Btn>
        <Btn onClick={() => go('#/pieces')}>🔍 Find inventory</Btn>
      </div>

      <div className="stats">
        <div className="stat"><strong>{activePieces.length}</strong><span>pieces</span></div>
        <div className="stat"><strong>{atGallery.length}</strong><span>out of studio</span></div>
        <div className="stat"><strong>{money(askingValue, profile?.currency)}</strong><span>asking value</span></div>
        <div className="stat"><strong>{money(expectedPayout, profile?.currency)}</strong><span>expected payout</span></div>
      </div>

      <h2>Recent work</h2>
      {recent.length === 0 ? (
        <EmptyState
          title="No pieces yet"
          body="Add your first artwork, or capture a photo and attach it to a piece as you go."
          action={<Btn variant="primary" onClick={() => go('#/pieces/new')}>Add artwork</Btn>}
        />
      ) : (
        <ul className="list">
          {recent.map((p) => (
            <li key={p.id}>
              <button type="button" className="rowlink" onClick={() => go(`#/pieces/${p.id}`)}>
                <span className="row-title">{p.title || 'Untitled'}</span>
                <span className="row-sub">
                  {p.inventoryNumber} · {p.status} · {p.location}
                </span>
                <span className="row-right">{money(p.retailPrice, p.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {missingFinal.length > 0 && (
        <p className="fineprint">
          <Badge tone="warn">{missingFinal.length} missing a final photo</Badge>{' '}
          Pieces without an approved final photo won’t look their best in listings.
        </p>
      )}
    </div>
  )
}

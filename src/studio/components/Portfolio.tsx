// Portfolio: visual grid of every piece with its best photo; tap to view large.
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Photo, Piece } from '../lib/types'
import { money } from '../lib/utils'
import { Btn, EmptyState, go } from './ui'

function coverFor(pieceId: string, photos: Photo[]): Photo | null {
  const mine = photos.filter((p) => p.pieceId === pieceId)
  return mine.find((p) => p.finalApproved) ?? mine.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
}

export function Portfolio() {
  const { pieces, series, seriesById, photos, photoUrl } = useStore()
  const [query, setQuery] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pieces
      .filter((p) => !p.archived)
      .filter((p) => (seriesFilter === 'all' ? true : p.seriesId === seriesFilter))
      .filter((p) =>
        !q ? true : [p.title, p.inventoryNumber, p.materials, p.status, seriesById(p.seriesId)?.name ?? ''].join(' ').toLowerCase().includes(q),
      )
      .sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || ''))
  }, [pieces, query, seriesFilter, seriesById])

  const open: Piece | null = openId ? pieces.find((p) => p.id === openId) ?? null : null
  const openPhotos = open
    ? photos.filter((p) => p.pieceId === open.id).sort((a, b) => Number(b.finalApproved) - Number(a.finalApproved) || b.createdAt - a.createdAt)
    : []
  const shown = openPhotos[photoIdx] ?? null
  const shownUrl = shown ? photoUrl(shown) : null

  return (
    <div className="page">
      <div className="page-head">
        <h1>Portfolio</h1>
        <span className="row-sub">{items.length} pieces</span>
      </div>
      <input className="input search" type="search" placeholder="Search title, material, series…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search portfolio" />
      <div className="filters">
        <select className="input" value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)} aria-label="Filter by series">
          <option value="all">All series</option>
          {series.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No pieces yet" body="Add artwork and photos to build your portfolio." action={<Btn variant="primary" onClick={() => go('#/pieces/new')}>Add artwork</Btn>} />
      ) : (
        <ul className="pf-grid">
          {items.map((p) => {
            const c = coverFor(p.id, photos)
            const url = c ? photoUrl(c) : null
            return (
              <li key={p.id}>
                <button type="button" className="pf-card" onClick={() => { setOpenId(p.id); setPhotoIdx(0) }}>
                  {url ? <img src={url} alt={p.title || 'Untitled'} loading="lazy" /> : <span className="pf-noimg">No photo</span>}
                  <span className="pf-title">{p.title || 'Untitled'}</span>
                  <span className="pf-sub">{seriesById(p.seriesId)?.name ?? p.inventoryNumber}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && (
        <div className="pf-viewer" role="dialog" aria-label={open.title || 'Piece'} onClick={() => setOpenId(null)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pf-imgwrap">
              {shownUrl ? <img src={shownUrl} alt={shown?.caption || open.title} /> : <span className="pf-noimg">No photo</span>}
            </div>
            {openPhotos.length > 1 && (
              <div className="pf-thumbs">
                {openPhotos.map((ph, i) => {
                  const u = photoUrl(ph)
                  return (
                    <button key={ph.id} type="button" className={`pf-thumb${i === photoIdx ? ' on' : ''}`} onClick={() => setPhotoIdx(i)} aria-label={`Photo ${i + 1}`}>
                      {u ? <img src={u} alt="" /> : '·'}
                    </button>
                  )
                })}
              </div>
            )}
            <h2>{open.title || 'Untitled'}</h2>
            <p className="row-sub">{[open.inventoryNumber, open.dimensions, open.materials].filter(Boolean).join(' · ')}</p>
            <p className="row-sub">{open.status} · {open.location} · {money(open.retailPrice, open.currency)}</p>
            <div className="pf-actions">
              <Btn variant="primary" onClick={() => go(`#/pieces/${open.id}`)}>Open full record</Btn>
              <Btn onClick={() => setOpenId(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Series: list, create/edit, and detail.
// Inheritance rule (PRD §17 decision 12): a series field change applies
// only to pieces created after the change; existing pieces keep their values.
import { useState } from 'react'
import { useStore } from '../store'
import type { Medium, Series } from '../lib/types'
import { MEDIUM_LABELS, uid } from '../lib/types'
import { Btn, EmptyState, Field, go } from './ui'

export function SeriesList() {
  const { series, pieces } = useStore()
  const active = series.filter((s) => !s.archived)
  const archived = series.filter((s) => s.archived)
  return (
    <div className="page">
      <div className="page-head">
        <h1>Series</h1>
        <Btn variant="primary" onClick={() => go('#/series/new')}>＋ New series</Btn>
      </div>
      {active.length === 0 ? (
        <EmptyState
          title="No series yet"
          body="A series groups related works and holds the shared clay, glaze, and pricing notes new pieces inherit."
          action={<Btn variant="primary" onClick={() => go('#/series/new')}>Create a series</Btn>}
        />
      ) : (
        <ul className="list">
          {active.map((s) => {
            const count = pieces.filter((p) => p.seriesId === s.id && !p.archived).length
            return (
              <li key={s.id}>
                <button type="button" className="rowlink" onClick={() => go(`#/series/${s.id}`)}>
                  <span className="row-title">{s.name}</span>
                  <span className="row-sub">{MEDIUM_LABELS[s.medium]} · {count} piece{count === 1 ? '' : 's'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {archived.length > 0 && (
        <>
          <h2>Archived</h2>
          <ul className="list">
            {archived.map((s) => (
              <li key={s.id}>
                <button type="button" className="rowlink" onClick={() => go(`#/series/${s.id}`)}>
                  <span className="row-title">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function SeriesForm({ existing, onDone }: { existing: Series | null; onDone: () => void }) {
  const { saveSeries } = useStore()
  const [name, setName] = useState(existing?.name ?? '')
  const [concept, setConcept] = useState(existing?.concept ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [medium, setMedium] = useState<Medium>(existing?.medium ?? 'ceramics')
  const [clayBody, setClayBody] = useState(existing?.clayBody ?? '')
  const [glaze, setGlaze] = useState(existing?.glaze ?? '')
  const [firing, setFiring] = useState(existing?.firing ?? '')
  const [finish, setFinish] = useState(existing?.finish ?? '')
  const [paintMedium, setPaintMedium] = useState(existing?.paintMedium ?? '')
  const [support, setSupport] = useState(existing?.support ?? '')
  const [palette, setPalette] = useState(existing?.palette ?? '')
  const [processNotes, setProcessNotes] = useState(existing?.processNotes ?? '')
  const [pricingGuidance, setPricingGuidance] = useState(existing?.pricingGuidance ?? '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const s: Series = {
      id: existing?.id ?? uid(),
      name: name.trim() || 'Untitled series',
      concept: concept.trim(),
      notes: notes.trim(),
      medium,
      clayBody: clayBody.trim(),
      glaze: glaze.trim(),
      firing: firing.trim(),
      finish: finish.trim(),
      paintMedium: paintMedium.trim(),
      support: support.trim(),
      palette: palette.trim(),
      processNotes: processNotes.trim(),
      pricingGuidance: pricingGuidance.trim(),
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await saveSeries(s)
    onDone()
  }

  return (
    <form onSubmit={submit} className="form">
      <Field label="Series name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Medium">
        <select className="input" value={medium} onChange={(e) => setMedium(e.target.value as Medium)}>
          <option value="ceramics">Ceramics</option>
          <option value="painting">Painting</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Concept">
        <textarea className="input" rows={3} value={concept} onChange={(e) => setConcept(e.target.value)} />
      </Field>
      {medium === 'ceramics' ? (
        <>
          <Field label="Clay body"><input className="input" value={clayBody} onChange={(e) => setClayBody(e.target.value)} /></Field>
          <Field label="Glaze / glaze notes"><input className="input" value={glaze} onChange={(e) => setGlaze(e.target.value)} /></Field>
          <Field label="Firing schedule / temperature"><input className="input" value={firing} onChange={(e) => setFiring(e.target.value)} /></Field>
          <Field label="Intended finish"><input className="input" value={finish} onChange={(e) => setFinish(e.target.value)} /></Field>
        </>
      ) : (
        <>
          <Field label="Medium"><input className="input" value={paintMedium} onChange={(e) => setPaintMedium(e.target.value)} /></Field>
          <Field label="Support"><input className="input" value={support} onChange={(e) => setSupport(e.target.value)} /></Field>
          <Field label="Palette"><input className="input" value={palette} onChange={(e) => setPalette(e.target.value)} /></Field>
          <Field label="Process notes"><input className="input" value={processNotes} onChange={(e) => setProcessNotes(e.target.value)} /></Field>
        </>
      )}
      <Field label="Shared pricing guidance">
        <input className="input" value={pricingGuidance} onChange={(e) => setPricingGuidance(e.target.value)} placeholder="e.g. Vases $350–$450" />
      </Field>
      <Field label="Notes">
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="fineprint">
        New pieces created under this series inherit these shared fields. Editing
        them later never rewrites pieces that already exist.
      </p>
      <Btn type="submit" variant="primary">{existing ? 'Save series' : 'Create series'}</Btn>
    </form>
  )
}

export function SeriesDetail({ id }: { id: string }) {
  const { seriesById, pieces, archiveSeries } = useStore()
  const [editing, setEditing] = useState(false)
  const s = seriesById(id)
  if (!s) {
    return (
      <div className="page">
        <EmptyState title="Series not found" action={<Btn onClick={() => go('#/series')}>Back to series</Btn>} />
      </div>
    )
  }
  const members = pieces.filter((p) => p.seriesId === s.id && !p.archived)
  if (editing) {
    return (
      <div className="page">
        <h1>Edit series</h1>
        <SeriesForm existing={s} onDone={() => setEditing(false)} />
      </div>
    )
  }
  return (
    <div className="page">
      <div className="page-head">
        <h1>{s.name}</h1>
        <Btn onClick={() => setEditing(true)}>Edit</Btn>
      </div>
      <p className="lede">{MEDIUM_LABELS[s.medium]}{s.archived ? ' · Archived' : ''}</p>
      {s.concept && <p>{s.concept}</p>}
      <dl className="facts">
        {s.clayBody && <><dt>Clay body</dt><dd>{s.clayBody}</dd></>}
        {s.glaze && <><dt>Glaze</dt><dd>{s.glaze}</dd></>}
        {s.firing && <><dt>Firing</dt><dd>{s.firing}</dd></>}
        {s.finish && <><dt>Finish</dt><dd>{s.finish}</dd></>}
        {s.paintMedium && <><dt>Medium</dt><dd>{s.paintMedium}</dd></>}
        {s.support && <><dt>Support</dt><dd>{s.support}</dd></>}
        {s.palette && <><dt>Palette</dt><dd>{s.palette}</dd></>}
        {s.processNotes && <><dt>Process</dt><dd>{s.processNotes}</dd></>}
        {s.pricingGuidance && <><dt>Pricing guidance</dt><dd>{s.pricingGuidance}</dd></>}
        {s.notes && <><dt>Notes</dt><dd>{s.notes}</dd></>}
      </dl>
      <h2>Pieces ({members.length})</h2>
      {members.length === 0 ? (
        <EmptyState title="No pieces in this series yet" action={<Btn variant="primary" onClick={() => go('#/pieces/new')}>Add artwork</Btn>} />
      ) : (
        <ul className="list">
          {members.map((p) => (
            <li key={p.id}>
              <button type="button" className="rowlink" onClick={() => go(`#/pieces/${p.id}`)}>
                <span className="row-title">{p.title || 'Untitled'}</span>
                <span className="row-sub">{p.inventoryNumber} · {p.status} · {p.stage}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row-actions">
        <Btn variant="primary" onClick={() => go('#/pieces/new')}>＋ Add artwork to this series</Btn>
        <Btn variant="ghost" onClick={() => { void archiveSeries(s.id, !s.archived); }}>
          {s.archived ? 'Restore series' : 'Archive series'}
        </Btn>
      </div>
    </div>
  )
}

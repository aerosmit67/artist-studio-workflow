// AI Studio: drafting grounded ONLY in the piece/series record fields.
// Every output is labeled a suggestion; nothing is saved to records or
// published automatically. Concept-image generation is a labeled placeholder
// hook — no AI provider is wired yet (PRD §17 open item 5).
import { useState } from 'react'
import { useStore } from '../store'
import type { AIOutput } from '../lib/types'
import { uid } from '../lib/types'
import {
  conceptImageHook,
  draftBrainstorm,
  draftCaption,
  draftDescription,
  draftStatement,
  draftTitle,
} from '../lib/utils'
import { Badge, Btn, EmptyState, Field, go } from './ui'

type DraftKind = 'title' | 'description' | 'statement' | 'caption' | 'brainstorm'

const KIND_LABELS: Record<DraftKind, string> = {
  title: 'Titles',
  description: 'Description',
  statement: 'Artist statement',
  caption: 'Social caption',
  brainstorm: 'Brainstorm ideas',
}

export function AIStudio() {
  const { pieces, series, profile, aiOutputs, saveAIOutput, deleteAIOutput } = useStore()
  const [pieceId, setPieceId] = useState('')
  const [seriesId, setSeriesId] = useState('')
  const [kind, setKind] = useState<DraftKind>('description')
  const [destination, setDestination] = useState('Instagram')
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [conceptPrompt, setConceptPrompt] = useState('')
  const [conceptMsg, setConceptMsg] = useState<string | null>(null)

  const piece = pieces.find((p) => p.id === pieceId) ?? null
  const serie = series.find((s) => s.id === seriesId) ?? (piece ? series.find((s) => s.id === piece.seriesId) ?? null : null)

  const generate = () => {
    let out = ''
    if (kind === 'title' && piece) out = draftTitle(piece, serie).join('\n')
    else if (kind === 'description' && piece) out = draftDescription(piece, serie, profile)
    else if (kind === 'statement') out = draftStatement(serie, profile)
    else if (kind === 'caption' && piece) out = draftCaption(piece, serie, profile, destination)
    else if (kind === 'brainstorm') out = draftBrainstorm(serie, profile)
    else out = 'Pick a piece first — drafts are built from that piece’s own record.'
    if (prompt.trim()) out += `\n\n(Your note: ${prompt.trim()})`
    setDraft(out)
  }

  const saveDraft = async () => {
    if (!draft) return
    const output: AIOutput = {
      id: uid(),
      kind,
      prompt: prompt.trim() || `${KIND_LABELS[kind]}${piece ? ` for ${piece.title}` : ''}${serie ? ` / ${serie.name}` : ''}`,
      output: draft,
      pieceId: piece?.id ?? null,
      seriesId: serie?.id ?? null,
      createdAt: Date.now(),
    }
    await saveAIOutput(output)
    setDraft(null)
    setPrompt('')
  }

  const tryConcept = () => {
    const hook = conceptImageHook()
    setConceptMsg(hook.message)
  }

  return (
    <div className="page">
      <h1>AI Studio</h1>
      <p className="lede">
        Drafts are built only from your own records — titles, dimensions, materials,
        series notes. Nothing here is saved to a record or published without you.
      </p>

      <div className="form">
        <Field label="Piece (optional)">
          <select className="input" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>
            <option value="">No piece — use series only</option>
            {pieces.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled'} · {p.inventoryNumber}</option>
            ))}
          </select>
        </Field>
        <Field label="Series (optional)">
          <select className="input" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
            <option value="">No series</option>
            {series.filter((s) => !s.archived).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="What do you need?">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as DraftKind)}>
            {(Object.keys(KIND_LABELS) as DraftKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        {kind === 'caption' && (
          <Field label="Destination">
            <select className="input" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option>Instagram</option>
              <option>Facebook</option>
              <option>Website / shop</option>
            </select>
          </Field>
        )}
        <Field label="Your prompt / notes (optional)">
          <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. warm tone, mention the garden" />
        </Field>
        <Btn variant="primary" onClick={generate}>Draft it</Btn>
      </div>

      {draft !== null && (
        <div className="card suggestion">
          <div className="badges"><Badge tone="info">Suggestion — review before using</Badge></div>
          <p className="draft-text">{draft}</p>
          <div className="row-actions">
            <Btn
              onClick={() => {
                void navigator.clipboard?.writeText(draft).catch(() => undefined)
              }}
            >
              Copy
            </Btn>
            <Btn variant="primary" onClick={() => { void saveDraft() }}>Save to AI Studio</Btn>
            <Btn variant="ghost" onClick={() => setDraft(null)}>Discard</Btn>
          </div>
        </div>
      )}

      <h2>Concept images</h2>
      <div className="card">
        <p>
          Visualize an idea, form, or palette before making it. Generated images are
          concept/reference material — never a photograph of a finished piece.
        </p>
        <Field label="Describe the concept">
          <input
            className="input"
            value={conceptPrompt}
            onChange={(e) => setConceptPrompt(e.target.value)}
            placeholder="e.g. a tall stacked garden totem in matte cream glaze"
          />
        </Field>
        <Btn
          disabled={!conceptPrompt.trim()}
          onClick={tryConcept}
        >
          Generate concept image
        </Btn>
        {conceptMsg && <div className="alert alert-info">{conceptMsg}</div>}
        <p className="fineprint">
          No image provider is connected yet — the PRD leaves the AI provider open.
          When one is chosen, it plugs into the concept-image hook and this button
          will produce labeled concept images.
        </p>
      </div>

      <h2>Saved suggestions</h2>
      {aiOutputs.length === 0 ? (
        <EmptyState title="No saved suggestions yet" body="Drafts you choose to keep will live here with their prompt and date." />
      ) : (
        <ul className="list">
          {aiOutputs.map((o) => (
            <li key={o.id} className="list-item">
              <span className="row-title">
                {KIND_LABELS[o.kind as DraftKind] ?? o.kind} · {new Date(o.createdAt).toLocaleDateString()}
              </span>
              <span className="row-sub">{o.prompt}</span>
              <p className="draft-text">{o.output}</p>
              <div className="row-actions">
                <Btn onClick={() => { void navigator.clipboard?.writeText(o.output).catch(() => undefined) }}>Copy</Btn>
                <Btn variant="danger" onClick={() => { void deleteAIOutput(o.id) }}>Delete</Btn>
                {o.pieceId && <Btn variant="ghost" onClick={() => go(`#/pieces/${o.pieceId}`)}>Open piece</Btn>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// AI Studio: drafting grounded ONLY in the piece/series record fields.
// Every output is labeled a suggestion; nothing is saved to records or
// published automatically. Text and concept images come from Lovable AI.
import { useState } from 'react'
import { useStore } from '../store'
import type { AIOutput } from '../lib/types'
import { uid } from '../lib/types'
import { useServerFn } from '@tanstack/react-start'
import { conceptImage, draftText } from '@/lib/ai.functions'
import { Badge, Btn, EmptyState, Field, go } from './ui'

type DraftKind = 'title' | 'description' | 'statement' | 'caption' | 'brainstorm'

const KIND_LABELS: Record<DraftKind | 'concept', string> = {
  concept: 'Concept image',
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
  const [conceptUrl, setConceptUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [conceptBusy, setConceptBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sketch, setSketch] = useState<string | null>(null)
  const [sketchErr, setSketchErr] = useState<string | null>(null)
  const runDraft = useServerFn(draftText)
  const runConcept = useServerFn(conceptImage)

  const pickSketch = async (file: File | undefined) => {
    setSketchErr(null)
    if (!file) return
    try {
      setSketch(await shrinkToDataUrl(file))
    } catch {
      setSketchErr('Could not read that image. Try a JPEG or PNG photo.')
    }
  }

  const piece = pieces.find((p) => p.id === pieceId) ?? null
  const serie = series.find((s) => s.id === seriesId) ?? (piece ? series.find((s) => s.id === piece.seriesId) ?? null : null)

  const clean = (o: unknown) =>
    o ? JSON.stringify(o, (k, v) => (k === 'id' || k.endsWith('Id') || k.endsWith('At') || v instanceof Blob || (typeof v === 'string' && v.length > 2000) ? undefined : v), 2) : 'none'

  const generate = async () => {
    setError(null)
    if ((kind === 'title' || kind === 'description' || kind === 'caption') && !piece) {
      setError('Pick a piece first — drafts are built from that piece’s own record.')
      return
    }
    const context = `ARTIST: ${clean(profile)}\nPIECE: ${clean(piece)}\nSERIES: ${clean(serie)}${kind === 'caption' ? `\nDESTINATION: ${destination}` : ''}`
    setBusy(true)
    try {
      const res = await runDraft({ data: { kind, context, note: prompt.trim(), image: sketch } })
      if (res.ok) setDraft(res.text)
      else setError(res.error)
    } catch {
      setError('Could not reach AI. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
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

  const tryConcept = async () => {
    setConceptMsg(null)
    setConceptUrl(null)
    setConceptBusy(true)
    try {
      const res = await runConcept({ data: { prompt: conceptPrompt.trim(), image: sketch } })
      if (res.ok) setConceptUrl(res.dataUrl)
      else setConceptMsg(res.error)
    } catch {
      setConceptMsg('Could not reach AI. Check your connection and try again.')
    } finally {
      setConceptBusy(false)
    }
  }

  const saveConcept = async () => {
    if (!conceptUrl) return
    await saveAIOutput({
      id: uid(), kind: 'concept', prompt: conceptPrompt.trim(), output: conceptUrl,
      pieceId: null, seriesId: serie?.id ?? null, createdAt: Date.now(),
    })
    setConceptUrl(null)
    setConceptPrompt('')
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
            {(Object.keys(KIND_LABELS).filter((k) => k !== 'concept') as DraftKind[]).map((k) => (
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
        <Field label="Sketch or notebook photo (optional)" hint="Guides drafts and concept images. Used only as a reference, never saved to a piece.">
          <input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => { void pickSketch(e.target.files?.[0]); e.target.value = '' }} />
        </Field>
        {sketch && (
          <div className="suggestion">
            <img src={sketch} alt="Your sketch reference" style={{ maxWidth: 220, borderRadius: 12 }} />
            <div className="row-actions"><Btn variant="ghost" onClick={() => setSketch(null)}>Remove sketch</Btn></div>
          </div>
        )}
        {sketchErr && <div className="alert alert-info">{sketchErr}</div>}
        <Btn variant="primary" disabled={busy} onClick={() => { void generate() }}>{busy ? 'Drafting…' : 'Draft it'}</Btn>
        {error && <div className="alert alert-info">{error}</div>}
      </div>

      {draft !== null && (
        <div className="card suggestion">
          <div className="badges"><Badge tone="info">Suggestion — review before using</Badge></div>
          <textarea className="input draft-text" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
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
          disabled={(!conceptPrompt.trim() && !sketch) || conceptBusy}
          onClick={() => { void tryConcept() }}
        >
          {conceptBusy ? 'Generating… (up to a minute)' : 'Generate concept image'}
        </Btn>
        {sketch && <p className="fineprint">Your sketch above will guide this image.</p>}
        {conceptMsg && <div className="alert alert-info">{conceptMsg}</div>}
        {conceptUrl && (
          <div className="suggestion">
            <div className="badges"><Badge tone="info">Concept image — not a photo of finished work</Badge></div>
            <img src={conceptUrl} alt={`Concept: ${conceptPrompt}`} style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
            <div className="row-actions">
              <Btn variant="primary" onClick={() => { void saveConcept() }}>Save to AI Studio</Btn>
              <Btn variant="ghost" onClick={() => setConceptUrl(null)}>Discard</Btn>
            </div>
          </div>
        )}
      </div>

      <h2>Saved suggestions</h2>
      {aiOutputs.length === 0 ? (
        <EmptyState title="No saved suggestions yet" body="Drafts you choose to keep will live here with their prompt and date." />
      ) : (
        <ul className="list">
          {aiOutputs.map((o) => (
            <li key={o.id} className="list-item">
              <span className="row-title">
                {KIND_LABELS[o.kind as DraftKind | 'concept'] ?? o.kind} · {new Date(o.createdAt).toLocaleDateString()}
              </span>
              <span className="row-sub">{o.prompt}</span>
              {o.kind === 'concept' ? (
                <img src={o.output} alt={`Concept: ${o.prompt}`} style={{ width: '100%', borderRadius: 12 }} />
              ) : (
                <p className="draft-text">{o.output}</p>
              )}
              <div className="row-actions">
                {o.kind !== 'concept' && <Btn onClick={() => { void navigator.clipboard?.writeText(o.output).catch(() => undefined) }}>Copy</Btn>}
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

// Downscale a photo to a JPEG data URL (max 1280px) so uploads stay small.
async function shrinkToDataUrl(file: File, max = 1280): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

// Onboarding (first run) and the reusable artist profile form.
// Prefilled with the pilot artist from the PRD; everything is editable.
import { useState } from 'react'
import { useStore, defaultProfile } from '../store'
import type { Medium, Profile } from '../lib/types'
import { CERAMIC_STAGES, PAINTER_STAGES } from '../lib/types'
import { Btn, Field, go } from './ui'

export function ProfileForm({
  initial,
  onSave,
  submitLabel,
}: {
  initial: Profile
  onSave: (p: Profile) => void
  submitLabel: string
}) {
  const [name, setName] = useState(initial.name)
  const [brand, setBrand] = useState(initial.brand)
  const [location, setLocation] = useState(initial.location)
  const [statement, setStatement] = useState(initial.statement)
  const [currency, setCurrency] = useState(initial.currency)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [primaryMedium, setPrimaryMedium] = useState<Medium>(initial.primaryMedium)
  const [ceramicStages, setCeramicStages] = useState(initial.ceramicStages.join(', '))
  const [painterStages, setPainterStages] = useState(initial.painterStages.join(', '))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parse = (s: string, fallback: readonly string[]) => {
      const list = s.split(',').map((x) => x.trim()).filter(Boolean)
      return list.length ? list : [...fallback]
    }
    onSave({
      ...initial,
      name: name.trim() || 'Artist',
      brand: brand.trim(),
      location: location.trim(),
      statement: statement.trim(),
      currency,
      timezone: timezone.trim() || 'America/Chicago',
      primaryMedium,
      ceramicStages: parse(ceramicStages, CERAMIC_STAGES),
      painterStages: parse(painterStages, PAINTER_STAGES),
    })
  }

  return (
    <form onSubmit={submit} className="form">
      <Field label="Your name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Studio / brand name">
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      <Field label="Location">
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label="Artist statement (optional)">
        <textarea className="input" rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </Field>
      <Field label="Currency">
        <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Time zone">
        <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
      </Field>
      <Field label="Primary medium">
        <select
          className="input"
          value={primaryMedium}
          onChange={(e) => setPrimaryMedium(e.target.value as Medium)}
        >
          <option value="ceramics">Ceramics</option>
          <option value="painting">Painting</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Ceramic stages (comma-separated)" hint="Slab-built defaults. Edit or add steps any time.">
        <input className="input" value={ceramicStages} onChange={(e) => setCeramicStages(e.target.value)} />
      </Field>
      <Field label="Painter stages (comma-separated)">
        <input className="input" value={painterStages} onChange={(e) => setPainterStages(e.target.value)} />
      </Field>
      <Btn type="submit" variant="primary">{submitLabel}</Btn>
    </form>
  )
}

export function Onboarding() {
  const { saveProfile } = useStore()
  const [busy, setBusy] = useState(false)

  const save = async (p: Profile) => {
    setBusy(true)
    await saveProfile(p)
    setBusy(false)
    go('#/')
  }

  return (
    <div className="page">
      <h1>Welcome to your studio</h1>
      <p className="lede">
        This is a private workspace for one artist at a time. It starts with your
        details already filled in from the plan — change anything here.
      </p>
      <ProfileForm initial={defaultProfile()} onSave={save} submitLabel={busy ? 'Saving…' : 'Set up my studio'} />
      <p className="fineprint">
        Your records and photos stay on this device. Nothing is uploaded anywhere.
      </p>
    </div>
  )
}

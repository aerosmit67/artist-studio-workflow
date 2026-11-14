// App shell: hash routing (works on any static host, incl. GitHub Pages),
// header with connectivity state, and a mobile bottom nav.
import { useEffect, useState, type ReactNode } from 'react'
import { StoreProvider, useStore } from './store'
import { Home } from './components/Home'
import { Onboarding } from './components/Onboarding'
import { SeriesDetail, SeriesForm, SeriesList } from './components/Series'
import { PieceDetail, PieceForm, PieceList } from './components/Pieces'
import { Capture } from './components/Capture'
import { PhotoLabEditor, PhotoLabList } from './components/PhotoLab'
import { AIStudio } from './components/AIStudio'
import {
  ManifestView,
  PartnerDetail,
  PartnersHub,
  PlacementDetail,
  PlacementForm,
  Reports,
  SalesList,
} from './components/Partners'
import { Portfolio } from './components/Portfolio'
import { Settings } from './components/Settings'
import { go } from './components/ui'
import { AuthGate } from './components/Auth'
import { startSync, stopSync, subscribeSync, type SyncStatus } from './lib/sync'

function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>({ state: 'idle', pending: 0 })
  useEffect(() => subscribeSync(setS), [])
  return s
}

function SyncRunner({ userId }: { userId: string }) {
  const { refresh } = useStore()
  useEffect(() => {
    void startSync(userId, () => void refresh())
    return () => stopSync()
  }, [userId, refresh])
  return null
}

interface Route {
  path: string
  query: Record<string, string>
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '')
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart || '/'
  const query: Record<string, string> = {}
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [k, v] = pair.split('=')
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
    }
  }
  return { path, query }
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

function MorePage() {
  const links: { hash: string; label: string; sub: string }[] = [
    { hash: '#/portfolio', label: 'Portfolio', sub: 'Browse every piece by photo' },
    { hash: '#/series', label: 'Series', sub: 'Collections and shared material notes' },
    { hash: '#/partners', label: 'Partners & placements', sub: 'Galleries, consignments, manifests' },
    { hash: '#/sales', label: 'Sales', sub: 'Expected vs. received payouts' },
    { hash: '#/reports', label: 'Reports & exports', sub: 'Summaries and CSV downloads' },
    { hash: '#/settings', label: 'Settings', sub: 'Profile, presets, storage, sample data' },
  ]
  return (
    <div className="page">
      <h1>More</h1>
      <ul className="list">
        {links.map((l) => (
          <li key={l.hash}>
            <button type="button" className="rowlink" onClick={() => go(l.hash)}>
              <span className="row-title">{l.label}</span>
              <span className="row-sub">{l.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const NAV: { hash: string; label: string; match: string }[] = [
  { hash: '#/', label: 'Studio', match: '' },
  { hash: '#/capture', label: 'Capture', match: 'capture' },
  { hash: '#/pieces', label: 'Inventory', match: 'pieces' },
  { hash: '#/portfolio', label: 'Portfolio', match: 'portfolio' },
  { hash: '#/photolab', label: 'Photo Lab', match: 'photolab' },
  { hash: '#/ai', label: 'AI Studio', match: 'ai' },
]

function Shell() {
  const { loading, profile, online, outbox } = useStore()
  const route = useRoute()
  const sync = useSyncStatus()

  if (loading) {
    return (
      <div className="page">
        <p>Loading your studio…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <Onboarding />
        </main>
      </div>
    )
  }

  const seg = route.path.split('/').filter(Boolean)
  const [first, second, third] = seg
  let content: ReactNode = <Home />
  if (first === 'capture') content = <Capture presetPieceId={route.query['piece'] ?? null} />
  else if (first === 'series' && !second) content = <SeriesList />
  else if (first === 'series' && second === 'new')
    content = (
      <div className="page">
        <h1>New series</h1>
        <SeriesForm existing={null} onDone={() => go('#/series')} />
      </div>
    )
  else if (first === 'series' && second) content = <SeriesDetail id={second} />
  else if (first === 'pieces' && !second) content = <PieceList />
  else if (first === 'pieces' && second === 'new')
    content = (
      <div className="page">
        <h1>New artwork</h1>
        <PieceForm existing={null} onDone={() => go('#/pieces')} />
      </div>
    )
  else if (first === 'pieces' && second) content = <PieceDetail id={second} />
  else if (first === 'photolab' && !second) content = <PhotoLabList />
  else if (first === 'photolab' && second) content = <PhotoLabEditor photoId={second} />
  else if (first === 'ai') content = <AIStudio />
  else if (first === 'partners' && !second) content = <PartnersHub />
  else if (first === 'partners' && second) content = <PartnerDetail id={second} />
  else if (first === 'placements' && second === 'new') content = <PlacementForm />
  else if (first === 'placements' && second && third === 'manifest') content = <ManifestView id={second} />
  else if (first === 'placements' && second) content = <PlacementDetail id={second} />
  else if (first === 'sales') content = <SalesList />
  else if (first === 'reports') content = <Reports />
  else if (first === 'portfolio') content = <Portfolio />
  else if (first === 'settings') content = <Settings />
  else if (first === 'more') content = <MorePage />

  const active = first ?? ''
  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => go('#/')}>
          {profile.brand || profile.name}
        </button>
        <div className="header-right">
          {outbox.length > 0 && (
            <button type="button" className="queue-badge" onClick={() => go('#/capture')}>
              {outbox.length} queued
            </button>
          )}
          <span className="sync-pill" title={sync.error ?? ''}>
            {sync.state === 'syncing' ? 'Saving to cloud…' : sync.state === 'error' ? 'Cloud save failed' : sync.pending > 0 ? `${sync.pending} to upload` : 'Saved'}
          </span>
          <span className={`online-dot ${online ? 'online' : 'offline'}`} title={online ? 'Online' : 'Offline'}>
            {online ? '● Online' : '○ Offline'}
          </span>
          <button type="button" className="more-link" onClick={() => go('#/more')}>
            More
          </button>
        </div>
      </header>
      <main className="app-main">{content}</main>
      <nav className="app-nav" aria-label="Main navigation">
        {NAV.map((item) => (
          <button
            key={item.hash}
            type="button"
            className={`nav-link${active === item.match ? ' active' : ''}`}
            onClick={() => go(item.hash)}
            aria-current={active === item.match ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {(session) => (
        <StoreProvider key={session.user.id}>
          <SyncRunner userId={session.user.id} />
          <Shell />
        </StoreProvider>
      )}
    </AuthGate>
  )
}

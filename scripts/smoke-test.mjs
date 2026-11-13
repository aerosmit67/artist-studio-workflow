// Browser smoke test: serves the production build, drives it in headless
// Chromium, and checks that the key screens render and the core flows work.
// Usage: npm run smoke   (builds first via `npm test`)
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4173
const ROOT = new URL('..', import.meta.url).pathname
const BASE = `http://localhost:${PORT}`

const server = spawn(
  'npm',
  ['run', 'preview', '--', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/`)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('preview server did not start')
}

const checks = []
const check = (name, cond) => checks.push([name, !!cond])

let browser
try {
  await waitForServer()
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

  // Onboarding (workspace ships empty).
  await page.waitForSelector('text=Welcome to your studio', { timeout: 15000 })
  check('onboarding renders', true)
  check('onboarding prefilled with Doni Langlois', (await page.content()).includes('Doni Langlois'))
  check('onboarding prefilled with ARTful LiFe CLAY', (await page.content()).includes('ARTful LiFe CLAY'))

  // Submit onboarding → home.
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Capture progress', { timeout: 15000 })
  check('home renders after onboarding', true)
  check('home shows quick actions', (await page.content()).includes('Add artwork'))

  // Key screens via hash routing.
  const routes = [
    ['#/pieces', 'Inventory'],
    ['#/pieces/new', 'New artwork'],
    ['#/series', 'Series'],
    ['#/capture', 'Capture progress'],
    ['#/photolab', 'Photo Lab'],
    ['#/ai', 'AI Studio'],
    ['#/partners', 'Partners'],
    ['#/sales', 'Sales'],
    ['#/reports', 'Reports'],
    ['#/settings', 'Settings'],
  ]
  for (const [hash, label] of routes) {
    await page.evaluate((h) => {
      window.location.hash = h
    }, hash)
    await page.waitForSelector(`text=${label}`, { timeout: 10000 }).catch(() => undefined)
    check(`route ${hash} renders`, (await page.content()).includes(label))
  }

  // Create a series, then a piece under it (inheritance + inventory number).
  await page.evaluate(() => {
    window.location.hash = '#/series/new'
  })
  await page.waitForSelector('text=New series', { timeout: 10000 })
  await page.fill('input', 'Garden Totems').catch(() => undefined)
  // Fill by label: the first text input on the series form is the name.
  const nameInput = page.locator('form input').first()
  await nameInput.fill('Garden Totems')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Garden Totems', { timeout: 10000 })
  check('series created', true)

  await page.evaluate(() => {
    window.location.hash = '#/pieces/new'
  })
  await page.waitForSelector('text=New artwork', { timeout: 10000 })
  const titleInput = page.locator('form input').first()
  await titleInput.fill('Armful Vase')
  const invText = await page.locator('form input').nth(1).inputValue()
  check('inventory number auto-generated (DL-YYYY-001)', /^DL-\d{4}-001$/.test(invText))
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Armful Vase', { timeout: 10000 })
  check('piece created and detail renders', true)

  // Photo Lab list + AI Studio draft flow.
  await page.evaluate(() => {
    window.location.hash = '#/ai'
  })
  await page.waitForSelector('text=AI Studio', { timeout: 10000 })
  await page.click('text=Draft it')
  await page.waitForSelector('text=Suggestion — review before using', { timeout: 10000 })
  check('AI Studio produces a labeled suggestion', true)

  // Static PWA assets.
  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json()
  check('manifest names the app', manifest.name === 'Artist Studio Workflow')
  const sw = await fetch(`${BASE}/sw.js`)
  check('service worker served', sw.ok)
  const icon192 = await fetch(`${BASE}/icons/icon-192.png`)
  check('192px icon served', icon192.ok)
  const icon512 = await fetch(`${BASE}/icons/icon-512.png`)
  check('512px icon served', icon512.ok)

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log('page errors:', errors.slice(0, 5))

  let failed = 0
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
    if (!ok) failed++
  }
  process.exitCode = failed ? 1 : 0
} catch (err) {
  console.error('SMOKE TEST ERROR:', err)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => undefined)
  server.kill()
}

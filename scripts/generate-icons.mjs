// Generates the PWA icons (192px + 512px PNG) from code, so the repo stays
// text-only: no binary assets are committed. Runs via `predev`/`prebuild`
// and writes into public/icons/ (gitignored); Vite copies them into dist/.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

// --- Minimal PNG encoder (8-bit RGBA, filter 0) ---
const table = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  table[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])))
  return Buffer.concat([len, td, data, crc])
}
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Draw a simple clay-vessel mark at 512px ---
const S = 512
const px = Buffer.alloc(S * S * 4)
function set(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= S || y >= S) return
  const i = (y * S + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = 255
}
// Terracotta background
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) set(x, y, 176, 84, 45)
// Cream vessel: body ellipse, neck, rim
const cream = [245, 237, 227]
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = (x - 256) / 120
    const dy = (y - 320) / 105
    const inBody = dx * dx + dy * dy <= 1 && y > 210
    const inNeck = x >= 216 && x <= 296 && y >= 168 && y <= 250
    const rdx = (x - 256) / 82
    const rdy = (y - 172) / 16
    const inRim = rdx * rdx + rdy * rdy <= 1
    if (inBody || inNeck || inRim) set(x, y, ...cream)
  }
}
// Sage sprig above the rim
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = (x - 256) / 10
    const dy = (y - 118) / 36
    if (dx * dx + dy * dy <= 1) set(x, y, 122, 138, 106)
  }
}

function downsample(src, s, t) {
  const out = Buffer.alloc(t * t * 4)
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < t; x++) {
      const sx = Math.floor((x * s) / t)
      const sy = Math.floor((y * s) / t)
      const si = (sy * s + sx) * 4
      const di = (y * t + x) * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return out
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon-512.png'), png(512, 512, px))
writeFileSync(join(outDir, 'icon-192.png'), png(192, 192, downsample(px, 512, 192)))
console.log('PWA icons written to public/icons/')

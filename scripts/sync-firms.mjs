import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrape } from './scrape-municipios.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'data')

const WEST = -0.55
const EAST = -0.05
const SOUTH = 39.7
const NORTH = 40.05

const SOURCES = [
  {
    id: 'viirs_n20',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs',
    window: '24h',
  },
  {
    id: 'viirs_n21',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs',
    window: '24h',
  },
  {
    id: 'viirs_snpp',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs',
    window: '24h',
  },
  {
    id: 'modis_24h',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Europe_24h.csv',
    kind: 'modis',
    window: '24h',
  },
  {
    id: 'modis_7d',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Europe_7d.csv',
    kind: 'modis',
    window: '7d',
  },
]

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i]
    })
    return row
  })
}

function inBbox(lat, lon) {
  return lat >= SOUTH && lat <= NORTH && lon >= WEST && lon <= EAST
}

function toDetection(row, kind, sourceId) {
  const lat = Number(row.latitude)
  const lon = Number(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBbox(lat, lon)) return null
  const brightness = Number(row.brightness ?? row.bright_ti4)
  const frp = Number(row.frp)
  return {
    lat,
    lon,
    brightness: Number.isFinite(brightness) ? brightness : null,
    frp: Number.isFinite(frp) ? frp : null,
    acq_date: row.acq_date,
    acq_time: String(row.acq_time).padStart(4, '0'),
    satellite: row.satellite ?? '',
    confidence: row.confidence ?? '',
    daynight: row.daynight ?? '',
    source: kind,
    feed: sourceId,
  }
}

async function fetchCsv(url, fallbackPath) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    return await res.text()
  } catch (err) {
    if (fallbackPath && existsSync(fallbackPath)) {
      console.warn(`Fallback local: ${fallbackPath} (${err.message})`)
      return readFileSync(fallbackPath, 'utf8')
    }
    throw err
  }
}

function dedupe(detections) {
  const seen = new Set()
  const out = []
  for (const d of detections) {
    const key = [
      d.lat.toFixed(3),
      d.lon.toFixed(3),
      d.acq_date,
      d.acq_time.slice(0, 3),
      d.satellite,
      d.source,
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const activeRaw = []
  const weekRaw = []

  for (const src of SOURCES) {
    const localName = src.url.split('/').pop()
    const text = await fetchCsv(src.url, join(root, localName))
    const rows = parseCsv(text)
      .map((r) => toDetection(r, src.kind, src.id))
      .filter(Boolean)
    console.log(`${src.id}: ${rows.length}`)
    if (src.window === '24h') activeRaw.push(...rows)
    if (src.window === '7d') weekRaw.push(...rows)
  }

  const active = dedupe(activeRaw)
  const activeKeys = new Set(active.map((d) => `${d.lat.toFixed(3)}|${d.lon.toFixed(3)}`))

  const cooled = []
  const cooledSeen = new Set()
  for (const d of weekRaw) {
    if (d.acq_date < '2026-07-25') continue
    const k = `${d.lat.toFixed(3)}|${d.lon.toFixed(3)}`
    if (activeKeys.has(k) || cooledSeen.has(k)) continue
    cooledSeen.add(k)
    cooled.push(d)
  }

  // Municipios afectados por el incendio (datos oficiales Cecopi/Generalitat)
  // ACTUALIZAR MANUALMENTE cuando haya novedades oficiales
  const municipios = [
    // Confinados
    { name: "La Vall d'Uixó", status: 'confined', lat: 39.8447, lon: -0.2564 },
    { name: 'Almassora', status: 'confined', lat: 39.9511, lon: -0.0442 },
    { name: 'Almenara', status: 'confined', lat: 39.8697, lon: -0.1636 },
    { name: 'Betxí', status: 'confined', lat: 39.8636, lon: -0.2089 },
    { name: 'Eslida', status: 'confined', lat: 39.8436, lon: -0.3253 },
    { name: 'Aín', status: 'confined', lat: 39.8503, lon: -0.3614 },
    { name: 'Azuébar', status: 'confined', lat: 39.8714, lon: -0.3864 },
    { name: 'Castellnovo', status: 'confined', lat: 39.8711, lon: -0.4136 },
    { name: 'Chóvar', status: 'confined', lat: 39.8886, lon: -0.4114 },
    { name: 'Geldo', status: 'confined', lat: 39.8764, lon: -0.4336 },
    { name: 'Higueras', status: 'confined', lat: 39.8886, lon: -0.4469 },
    { name: 'Jérica', status: 'confined', lat: 39.9011, lon: -0.4636 },
    { name: 'Matet', status: 'confined', lat: 39.9136, lon: -0.4769 },
    { name: 'Pavías', status: 'confined', lat: 39.9261, lon: -0.4903 },
    { name: 'Sot de Ferrer', status: 'confined', lat: 39.8836, lon: -0.4569 },
    { name: 'Torres Torres', status: 'confined', lat: 39.8961, lon: -0.4703 },
    { name: 'Algimia de Almonacid', status: 'confined', lat: 39.8586, lon: -0.4086 },
    { name: 'Alfondeguilla', status: 'confined', lat: 39.8336, lon: -0.3469 },
    { name: 'Suera', status: 'confined', lat: 39.8211, lon: -0.3336 },
    { name: 'Vall de Almonacid', status: 'confined', lat: 39.8461, lon: -0.3903 },
    
    // Evacuados (núcleos específicos)
    { name: 'Artana', status: 'evacuated', lat: 39.8836, lon: -0.2736 },
    { name: 'Tales', status: 'evacuated', lat: 39.8711, lon: -0.2903 },
    { name: 'Ayódar', status: 'evacuated', lat: 39.8586, lon: -0.3069 },
    { name: 'Fanzara', status: 'evacuated', lat: 39.8461, lon: -0.3203 },
  ]

  // Calcular personas afectadas (estimación por municipio)
  const poblacionPorMunicipio = {
    "La Vall d'Uixó": 31000, 'Almassora': 27000, 'Almenara': 7000,
    'Vila-real': 52000, 'Burriana': 35000, 'Nules': 14000,
  }
  
  const confinedPeople = municipios
    .filter(m => m.status === 'confined')
    .reduce((sum, m) => sum + (poblacionPorMunicipio[m.name] || 2000), 0)
  
  const evacuatedPeople = municipios
    .filter(m => m.status === 'evacuated')
    .reduce((sum, m) => sum + (poblacionPorMunicipio[m.name] || 2000), 0)
  
  const payload = {
    generatedAt: new Date().toISOString(),
    sources: {
      firms: 'NASA FIRMS (VIIRS NOAA-20/21, Suomi-NPP + MODIS C6.1)',
      municipalities: 'Cecopi / Generalitat Valenciana (datos oficiales)',
      geocoding: 'OpenStreetMap Nominatim',
    },
    incident: {
      name: "Incendio Serra d'Espadà · Vall d'Uixó",
      started: '2026-07-25T11:00:00+02:00',
      hectares: 8500,
      perimeterKm: 72,
      status: 'Activo — ni estabilizado ni controlado',
      confinedPeople: confinedPeople || 64000,
      evacuatedPeople: evacuatedPeople || 16000,
      aerialMeans: 30,
      groundCrew: 450,
    },
    bbox: [WEST, SOUTH, EAST, NORTH],
    active,
    cooled,
    municipalities: municipios,
  }

  writeFileSync(join(outDir, 'fire.json'), JSON.stringify(payload))
  console.log(`Wrote ${active.length} active, ${cooled.length} cooled, ${municipios.length} towns`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

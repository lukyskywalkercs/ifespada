import type { Detection } from '../types'

const WEST = -0.55
const EAST = -0.05
const SOUTH = 39.7
const NORTH = 40.05

const ACTIVE_FEEDS = [
  {
    id: 'viirs_n20',
    path: '/api/firms/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs' as const,
  },
  {
    id: 'viirs_n21',
    path: '/api/firms/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs' as const,
  },
  {
    id: 'viirs_snpp',
    path: '/api/firms/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_24h.csv',
    kind: 'viirs' as const,
  },
  {
    id: 'modis_24h',
    path: '/api/firms/modis-c6.1/csv/MODIS_C6_1_Europe_24h.csv',
    kind: 'modis' as const,
  },
]

const WEEK_FEED = {
  id: 'modis_7d',
  path: '/api/firms/modis-c6.1/csv/MODIS_C6_1_Europe_7d.csv',
  kind: 'modis' as const,
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })
}

function rowToDetection(
  row: Record<string, string>,
  kind: 'viirs' | 'modis',
  feed: string,
): Detection | null {
  const lat = Number(row.latitude)
  const lon = Number(row.longitude)
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < SOUTH ||
    lat > NORTH ||
    lon < WEST ||
    lon > EAST
  ) {
    return null
  }
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
    feed,
  }
}

function dedupe(detections: Detection[]): Detection[] {
  const seen = new Set<string>()
  const out: Detection[] = []
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

async function fetchFeed(path: string, id: string, kind: 'viirs' | 'modis') {
  const res = await fetch(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`)
  if (!res.ok) throw new Error(`${id}: ${res.status}`)
  const text = await res.text()
  if (text.trim().startsWith('{')) throw new Error(`${id}: respuesta no CSV`)
  return parseCsv(text)
    .map((row) => rowToDetection(row, kind, id))
    .filter((d): d is Detection => Boolean(d))
}

export async function fetchLiveSnapshot(): Promise<{
  active: Detection[]
  cooled: Detection[]
  latestPass: string | null
}> {
  const [activeBatches, weekRows] = await Promise.all([
    Promise.all(
      ACTIVE_FEEDS.map((feed) => fetchFeed(feed.path, feed.id, feed.kind)),
    ),
    fetchFeed(WEEK_FEED.path, WEEK_FEED.id, WEEK_FEED.kind),
  ])

  const active = dedupe(activeBatches.flat())
  const activeKeys = new Set(active.map((d) => `${d.lat.toFixed(3)}|${d.lon.toFixed(3)}`))

  const cooledSeen = new Set<string>()
  const cooled: Detection[] = []
  for (const d of weekRows) {
    if (d.acq_date < '2026-07-25') continue
    const k = `${d.lat.toFixed(3)}|${d.lon.toFixed(3)}`
    if (activeKeys.has(k) || cooledSeen.has(k)) continue
    cooledSeen.add(k)
    cooled.push(d)
  }

  return {
    active,
    cooled,
    latestPass: latestAcquisition([...active, ...cooled]),
  }
}

export function latestAcquisition(detections: Detection[]): string | null {
  if (!detections.length) return null
  let best: Detection | null = null
  for (const d of detections) {
    if (!best) {
      best = d
      continue
    }
    const a = `${d.acq_date}${d.acq_time}`
    const b = `${best.acq_date}${best.acq_time}`
    if (a > b) best = d
  }
  return best ? formatAcq(best.acq_date, best.acq_time) : null
}

export function formatAcq(date: string, time: string): string {
  const hh = time.slice(0, 2)
  const mm = time.slice(2, 4)
  return `${date} · ${hh}:${mm} UTC`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

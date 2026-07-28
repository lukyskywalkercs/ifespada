import { useCallback, useEffect, useMemo, useState } from 'react'
import { FireMap } from './components/FireMap'
import {
  fetchLiveSnapshot,
  formatNumber,
  latestAcquisition,
} from './lib/firms'
import type { FirePayload, LayerKey } from './types'
import './App.css'

const LAYER_META: { key: LayerKey; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'cooled', label: 'Sin detección' },
  { key: 'confined', label: 'Confinados' },
  { key: 'evacuated', label: 'Evacuados' },
]

const REFRESH_MS = 90_000

function formatStamp(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatPass(pass: string) {
  const m = pass.match(/^(\d{4})-(\d{2})-(\d{2}) · (\d{2}:\d{2} UTC)$/)
  if (!m) return pass
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} · ${m[4]}`
}

export default function App() {
  const [data, setData] = useState<FirePayload | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [liveOk, setLiveOk] = useState(false)
  const [latestPass, setLatestPass] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    active: true,
    cooled: true,
    confined: true,
    evacuated: true,
  })

  const applyLive = useCallback(async (base: FirePayload) => {
    const snap = await fetchLiveSnapshot()
    setLiveOk(true)
    setLatestPass(snap.latestPass)
    setData({
      ...base,
      municipalities: base.municipalities,
      generatedAt: new Date().toISOString(),
      active: snap.active,
      cooled: snap.cooled,
    })
    return snap
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/data/fire.json')
        if (!res.ok) throw new Error('No se pudo cargar el dataset local')
        const json = (await res.json()) as FirePayload
        if (cancelled) return
        setData(json)
        setLatestPass(latestAcquisition([...json.active, ...json.cooled]))
        try {
          setRefreshing(true)
          await applyLive(json)
        } catch (liveErr) {
          setLiveOk(false)
          setError(
            liveErr instanceof Error
              ? `FIRMS en vivo no disponible (${liveErr.message}). Mostrando última copia local.`
              : 'FIRMS en vivo no disponible',
          )
        } finally {
          if (!cancelled) setRefreshing(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error de carga')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyLive])

  const refresh = useCallback(async () => {
    if (!data) return
    setRefreshing(true)
    setError(null)
    try {
      await applyLive(data)
    } catch (err) {
      setLiveOk(false)
      setError(
        err instanceof Error
          ? `Actualización FIRMS: ${err.message}. Se mantienen los últimos datos.`
          : 'No se pudo actualizar FIRMS',
      )
    } finally {
      setRefreshing(false)
    }
  }, [applyLive, data])

  useEffect(() => {
    if (!data) return
    const id = window.setInterval(() => {
      void refresh()
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [data, refresh])

  const toggle = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="shell">
      <div className={`loading-veil ${data && mapReady ? 'is-gone' : ''}`}>
        <div className="loading-card">
          <span aria-hidden />
          <strong>Espadà</strong>
          <p>Conectando con NASA FIRMS…</p>
        </div>
      </div>

      {data && (
        <>
          <section className={`map-pane ${mapReady ? 'is-ready' : ''}`}>
            <FireMap
              active={data.active}
              cooled={data.cooled}
              municipalities={data.municipalities}
              layers={layers}
              onReady={() => setMapReady(true)}
            />

            <div className="map-chrome">
              <div className="map-legend" role="group" aria-label="Capas del mapa">
                {LAYER_META.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`legend-item ${layers[item.key] ? 'is-on' : 'is-off'}`}
                    onClick={() => toggle(item.key)}
                    aria-pressed={layers[item.key]}
                  >
                    <span className={`swatch ${item.key}`} aria-hidden />
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="map-source">
                Focos: NASA FIRMS NRT ·{' '}
                <a
                  href="https://firms.modaps.eosdis.nasa.gov/"
                  target="_blank"
                  rel="noreferrer"
                >
                  API / datos
                </a>
              </p>
            </div>

            <footer className="site-credit">
              <span>Lind Informática</span>
              <span aria-hidden>·</span>
              <a href="mailto:lucas@lindinformatica.com">lucas@lindinformatica.com</a>
              <span aria-hidden>·</span>
              <a href="https://www.lindinformatica.co" target="_blank" rel="noreferrer">
                lindinformatica.co
              </a>
              <span aria-hidden>·</span>
              <a
                href="https://www.linkedin.com/in/lucas-chabrera-querol/"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
              <span aria-hidden>·</span>
              <a href="tel:+34689388980">689 388 980</a>
            </footer>
          </section>

          <aside className="side" aria-label="Información del incendio">
            <header className="side-head">
              <div className="brand-mark">
                <span className={`live-dot ${liveOk ? '' : 'is-stale'}`} aria-hidden />
                <p className="eyebrow">
                  {liveOk ? 'En vivo' : 'Copia local'} · NASA FIRMS
                </p>
              </div>
              <h1>Serra d&apos;Espadà</h1>

              <div className="meta">
                <dl className="meta-grid">
                  <div>
                    <dt>Actualizado</dt>
                    <dd>{formatStamp(data.generatedAt)}</dd>
                  </div>
                  {latestPass && (
                    <div>
                      <dt>Última pasada</dt>
                      <dd>{formatPass(latestPass)}</dd>
                    </div>
                  )}
                </dl>
                <button
                  className="btn"
                  type="button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                >
                  {refreshing ? 'Actualizando…' : 'Actualizar'}
                </button>
              </div>
            </header>

            <section className="cecopi" aria-label="Estado Cecopi">
              <p className="eyebrow">Cecopi</p>
              <h2>{data.incident.status}</h2>

              <div className="cecopi-metrics">
                <div>
                  <span>Superficie</span>
                  <strong>{formatNumber(data.incident.hectares)} ha</strong>
                </div>
                <div>
                  <span>Perímetro</span>
                  <strong>{data.incident.perimeterKm} km</strong>
                </div>
                <div>
                  <span>Focos</span>
                  <strong>{formatNumber(data.active.length)}</strong>
                </div>
                <div>
                  <span>Sin detección</span>
                  <strong>{formatNumber(data.cooled.length)}</strong>
                </div>
                <div>
                  <span>Confinadas</span>
                  <strong>{formatNumber(data.incident.confinedPeople)}</strong>
                </div>
                <div>
                  <span>Evacuadas</span>
                  <strong>{formatNumber(data.incident.evacuatedPeople)}</strong>
                </div>
              </div>
            </section>

          </aside>
        </>
      )}

      {error && <div className="error-banner">{error}</div>}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup as MapLibrePopup,
  type Map as MapInstance,
  type Popup,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Detection, LayerKey, Municipality } from '../types'
import { formatAcq } from '../lib/firms'

interface FireMapProps {
  active: Detection[]
  cooled: Detection[]
  municipalities: Municipality[]
  layers: Record<LayerKey, boolean>
  onReady: () => void
}

function createFireMarkerElement(kind: 'active' | 'cooled', frp?: number) {
  const el = document.createElement('div')
  const size = kind === 'active' ? Math.min(20, 8 + (frp || 0) / 10) : 10
  const color = kind === 'active' ? '#e4572e' : '#78716c'
  
  el.style.backgroundColor = color
  el.style.width = size + 'px'
  el.style.height = size + 'px'
  el.style.borderRadius = '50%'
  el.style.border = '2px solid white'
  el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'
  el.style.cursor = 'pointer'
  
  return el
}

function makeTownEl(town: Municipality) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'town-marker town-marker--' + town.status
  el.setAttribute('aria-label', town.name + ', ' + (town.status === 'confined' ? 'confinado' : 'evacuado'))
  el.innerHTML = '<span class="town-marker__dot"></span><span class="town-marker__name">' + town.name + '</span>'
  return el
}

export function FireMap({
  active,
  cooled,
  municipalities,
  layers,
  onReady,
}: FireMapProps) {
  console.log('[FireMap] Render con', { active: active.length, cooled: cooled.length, towns: municipalities.length })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const townMarkersRef = useRef<Marker[]>([])
  const fireMarkersRef = useRef<Marker[]>([])
  const readyRef = useRef(false)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (active.length === 0 && cooled.length === 0) return

    console.log('[FireMap] Creando ' + (active.length + cooled.length) + ' marcadores de focos')

    fireMarkersRef.current.forEach(m => m.remove())
    fireMarkersRef.current = []

    active.forEach(d => {
      const el = createFireMarkerElement('active', d.frp ?? undefined)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        popupRef.current
          ?.setLngLat([d.lon, d.lat])
          .setHTML('<div class="popup"><h3>Foco activo</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
          .addTo(map)
      })
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([d.lon, d.lat])
        .addTo(map)
      fireMarkersRef.current.push(marker)
    })

    cooled.forEach(d => {
      const el = createFireMarkerElement('cooled')
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        popupRef.current
          ?.setLngLat([d.lon, d.lat])
          .setHTML('<div class="popup"><h3>Sin deteccion reciente</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
          .addTo(map)
      })
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([d.lon, d.lat])
        .addTo(map)
      fireMarkersRef.current.push(marker)
    })
    
    console.log('[FireMap] ' + fireMarkersRef.current.length + ' marcadores creados')
  }, [active, cooled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    townMarkersRef.current.forEach(m => m.remove())
    townMarkersRef.current = []

    municipalities.forEach(town => {
      const visible =
        (town.status === 'confined' && layers.confined) ||
        (town.status === 'evacuated' && layers.evacuated)
      if (!visible) return

      const el = makeTownEl(town)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const title = town.status === 'confined' ? 'Municipio confinado' : 'Nucleo evacuado'
        popupRef.current
          ?.setLngLat([town.lon, town.lat])
          .setHTML('<div class="popup"><h3>' + town.name + '</h3><p>' + title + '</p></div>')
          .addTo(map)
      })

      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([town.lon, town.lat])
        .addTo(map)
      townMarkersRef.current.push(marker)
    })
  }, [municipalities, layers.confined, layers.evacuated])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: 'OpenStreetMap CARTO',
          },
        },
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
      center: [-0.28, 39.88],
      zoom: 10.45,
      maxBounds: [
        [-0.85, 39.45],
        [0.25, 40.35],
      ],
      attributionControl: { compact: true },
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    
    popupRef.current = new MapLibrePopup({
      closeButton: false,
      closeOnClick: true,
      offset: 18,
      maxWidth: '280px',
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    map.on('load', () => {
      readyRef.current = true
      onReady()
    })

    map.on('error', (e) => console.error('Map error:', e.error))

    mapRef.current = map
    return () => {
      ro.disconnect()
      fireMarkersRef.current.forEach(m => m.remove())
      townMarkersRef.current.forEach(m => m.remove())
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [onReady])

  return <div ref={containerRef} className="map-canvas" />
}

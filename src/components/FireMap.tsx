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
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const townMarkersRef = useRef<Marker[]>([])
  const fireMarkersRef = useRef<Marker[]>([])
  const readyRef = useRef(false)

  // Efecto para marcadores de focos - se ejecuta cuando el mapa carga
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (active.length === 0 && cooled.length === 0) return

    fireMarkersRef.current.forEach(m => m.remove())
    fireMarkersRef.current = []urrent,
      style: {
    active.forEach(d => {
      const el = createFireMarkerElement('active', d.frp ?? undefined)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        popupRef.current
          ?.setLngLat([d.lon, d.lat])tocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          .setHTML('<div class="popup"><h3>Foco activo</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
          .addTo(map)//c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      })    ],
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([d.lon, d.lat])etMap CARTO',
        .addTo(map)
      fireMarkersRef.current.push(marker)
    })  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
    cooled.forEach(d => {88],
      const el = createFireMarkerElement('cooled')
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        popupRef.current
          ?.setLngLat([d.lon, d.lat])
          .setHTML('<div class="popup"><h3>Sin deteccion reciente</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
          .addTo(map)
      })
      const marker = new Marker({ element: el, anchor: 'center' })'bottom-right')
        .setLngLat([d.lon, d.lat])
        .addTo(map)t = new MapLibrePopup({
      fireMarkersRef.current.push(marker)
    })closeOnClick: true,
  }, [active, cooled])
      maxWidth: '280px',
  // Actualizar visibilidad de municipios cuando cambien los layers
  useEffect(() => {
    const map = mapRef.currenterver(() => map.resize())
    if (!map || !readyRef.current) returnainerRef.current)
    
    // Re-renderizar municipios con nuevos filtros    map.on('load', () => {
    townMarkersRef.current.forEach(m => m.remove())
    townMarkersRef.current = []
    
    municipalities.forEach(town => {
      const visible =, (e) => console.error('Map error:', e.error))
        (town.status === 'confined' && layers.confined) ||
        (town.status === 'evacuated' && layers.evacuated)
      if (!visible) return
      
      const el = makeTownEl(town)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation().current?.remove()
        const title = town.status === 'confined' ? 'Municipio confinado' : 'Nucleo evacuado'
        popupRef.current
          ?.setLngLat([town.lon, town.lat])ef.current = false
          .setHTML('<div class="popup"><h3>' + town.name + '</h3><p>' + title + '</p></div>')
          .addTo(map)
      })
      ef} className="map-canvas" />
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([town.lon, town.lat])
        .addTo(map)eMap load] Mapa cargado, creando marcadores...')
      townMarkersRef.current.push(marker)
    }) Crear marcadores de focos
  }, [layers.confined, layers.evacuated]) > 0) {
  fireMarkersRef.current.forEach(m => m.remove())
  // NOTA: Municipios se crean en el evento load junto con los focos        fireMarkersRef.current = []

  // Inicialización del mapa    active.forEach(d => {
  useEffect(() => {nt('active', d.frp ?? undefined)
    if (!containerRef.current || mapRef.current) returnener('click', (e) => {
tion()
    const map = new MapLibreMap({Ref.current
      container: containerRef.current,t([d.lon, d.lat])
      style: {        .setHTML('<div class="popup"><h3>Foco activo</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
        version: 8,              .addTo(map)
        sources: {
          carto: {{ element: el, anchor: 'center' })
            type: 'raster',            .setLngLat([d.lon, d.lat])
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',ent.push(marker)
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',  
            ],        cooled.forEach(d => {
            tileSize: 256,
            attribution: 'OpenStreetMap CARTO',          el.addEventListener('click', (e) => {
          },ation()
        },ef.current
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],gLat([d.lon, d.lat])
      },teccion reciente</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>')
      center: [-0.28, 39.88],
      zoom: 10.45,
      maxBounds: [rker = new Marker({ element: el, anchor: 'center' })
        [-0.85, 39.45],on, d.lat])
        [0.25, 40.35],
      ],     fireMarkersRef.current.push(marker)
      attributionControl: { compact: true },
    })        
rent.length + ' focos creados')
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')     }
          
































}  return <div ref={containerRef} className="map-canvas" />  }, [onReady])    }      readyRef.current = false      mapRef.current = null      map.remove()      popupRef.current?.remove()      townMarkersRef.current.forEach(m => m.remove())      fireMarkersRef.current.forEach(m => m.remove())      ro.disconnect()    return () => {    mapRef.current = map    map.on('error', (e) => console.error('Map error:', e.error))    })      onReady()      readyRef.current = true    map.on('load', () => {    ro.observe(containerRef.current)    const ro = new ResizeObserver(() => map.resize())    })      maxWidth: '280px',      offset: 18,      closeOnClick: true,      closeButton: false,    popupRef.current = new MapLibrePopup({      // Crear marcadores de municipios AQUÍ MISMO
      if (municipalities.length > 0) {
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
        
        console.log('[FireMap load] ' + townMarkersRef.current.length + ' municipios creados')
      }
      
      
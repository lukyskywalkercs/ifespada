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
  onToggleSatellite?: () => void
  registerToggle?: (toggleFn: () => void) => void
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

export function FireMap({ active, cooled, municipalities, layers, onReady, onToggleSatellite, registerToggle }: FireMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const townMarkersRef = useRef<Marker[]>([])
  const fireMarkersRef = useRef<Marker[]>([])
  const readyRef = useRef(false)
  const isSatelliteRef = useRef(false)

  const toggleBaseLayer = () => {
    // Registrar la funció de toggle perquè pugui ser cridada des de SatellitePanel
    if (registerToggle) {
      registerToggle(toggleBaseLayer)
    }

    if (!mapRef.current) return
    isSatelliteRef.current = !isSatelliteRef.current
    onToggleSatellite?.()
    const map = mapRef.current
    
    if (isSatelliteRef.current) {
      // Switch to NASA GIBS True Color (MODIS Corrected Reflectance)
      const today = new Date().toISOString().split('T')[0]
      map.setStyle({
        version: 8,
        sources: {
          nasa_gibs: {
            type: 'raster',
            tiles: [
              `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
            ],
            tileSize: 256,
            attribution: 'NASA GIBS / MODIS',
          },
        },
        layers: [{ id: 'nasa_gibs', type: 'raster', source: 'nasa_gibs' }],
      })
    } else {
      // Switch back to CartoDB Voyager
      map.setStyle({
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
      })
    }

    // Re-add markers after style change
    setTimeout(() => {
      if (mapRef.current) {
        townMarkersRef.current.forEach(m => m.addTo(mapRef.current!))
        fireMarkersRef.current.forEach(m => m.addTo(mapRef.current!))
      }
    }, 1000)
  }

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
      maxBounds: [[-0.85, 39.45], [0.25, 40.35]],
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')

    popupRef.current = new MapLibrePopup({ closeButton: false, closeOnClick: true, offset: 18, maxWidth: '280px' })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    map.on('load', () => {
      readyRef.current = true
      console.log('[FireMap load] Mapa cargado')
      
      // FOCOS ACTIVOS
      fireMarkersRef.current.forEach(m => m.remove())
      fireMarkersRef.current = []
      active.forEach(d => {
        const el = createFireMarkerElement('active', d.frp ?? undefined)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          popupRef.current?.setLngLat([d.lon, d.lat]).setHTML('<div class="popup"><h3>Foco activo</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>').addTo(map)
        })
        fireMarkersRef.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map))
      })
      // FOCOS COOLED
      cooled.forEach(d => {
        const el = createFireMarkerElement('cooled')
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          popupRef.current?.setLngLat([d.lon, d.lat]).setHTML('<div class="popup"><h3>Sin deteccion reciente</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>').addTo(map)
        })
        fireMarkersRef.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map))
      })
      console.log('[FireMap load] ' + fireMarkersRef.current.length + ' focos creados')
      
      // MUNICIPIOS
      townMarkersRef.current.forEach(m => m.remove())
      townMarkersRef.current = []
      municipalities.forEach(town => {
        const visible = (town.status === 'confined' && layers.confined) || (town.status === 'evacuated' && layers.evacuated)
        if (!visible) return
        const el = makeTownEl(town)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const title = town.status === 'confined' ? 'Municipio confinado' : 'Nucleo evacuado'
          popupRef.current?.setLngLat([town.lon, town.lat]).setHTML('<div class="popup"><h3>' + town.name + '</h3><p>' + title + '</p></div>').addTo(map)
        })
        townMarkersRef.current.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat([town.lon, town.lat]).addTo(map))
      })
      console.log('[FireMap load] ' + townMarkersRef.current.length + ' municipios creados')
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

  // Actualizar focos cuando cambien layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    fireMarkersRef.current.forEach(m => m.remove())
    fireMarkersRef.current = []
    
    // FOCOS ACTIVOS
    if (layers.active) {
      active.forEach(d => {
        const el = createFireMarkerElement('active', d.frp ?? undefined)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          popupRef.current?.setLngLat([d.lon, d.lat]).setHTML('<div class="popup"><h3>Foco activo</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>').addTo(map)
        })
        fireMarkersRef.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map))
      })
    }
    
    // FOCOS COOLED
    if (layers.cooled) {
      cooled.forEach(d => {
        const el = createFireMarkerElement('cooled')
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          popupRef.current?.setLngLat([d.lon, d.lat]).setHTML('<div class="popup"><h3>Sin deteccion reciente</h3><p>' + formatAcq(d.acq_date, d.acq_time) + '</p></div>').addTo(map)
        })
        fireMarkersRef.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map))
      })
    }
  }, [active, cooled, layers.active, layers.cooled])

  // Actualizar municipios cuando cambien layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    townMarkersRef.current.forEach(m => m.remove())
    townMarkersRef.current = []
    municipalities.forEach(town => {
      const visible = (town.status === 'confined' && layers.confined) || (town.status === 'evacuated' && layers.evacuated)
      if (!visible) return
      const el = makeTownEl(town)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const title = town.status === 'confined' ? 'Municipio confinado' : 'Nucleo evacuado'
        popupRef.current?.setLngLat([town.lon, town.lat]).setHTML('<div class="popup"><h3>' + town.name + '</h3><p>' + title + '</p></div>').addTo(map)
      })
      townMarkersRef.current.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat([town.lon, town.lat]).addTo(map))
    })
  }, [municipalities, layers.confined, layers.evacuated])

  return <div ref={containerRef} className="map-canvas" />
}

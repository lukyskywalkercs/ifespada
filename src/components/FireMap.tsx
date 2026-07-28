import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup as MapLibrePopup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type Map as MapInstance,
  type Popup,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Detection, LayerKey, Municipality } from '../types'
import { formatAcq } from '../lib/firms'

// NO establecer worker personalizado - usar el default de MapLibre
// setWorkerUrl(...) causa problemas en producción (Netlify)

interface FireMapProps {
  active: Detection[]
  cooled: Detection[]
  municipalities: Municipality[]
  layers: Record<LayerKey, boolean>
  onReady: () => void
}

function toPoints(detections: Detection[], kind: 'active' | 'cooled') {
  return {
    type: 'FeatureCollection' as const,
    features: detections.map((d, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: {
        kind,
        frp: d.frp ?? 0,
        brightness: d.brightness ?? 0,
        confidence: String(d.confidence),
        source: d.source,
        when: formatAcq(d.acq_date, d.acq_time),
        satellite: d.satellite,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [d.lon, d.lat],
      },
    })),
  }
}

function makeTownEl(town: Municipality) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `town-marker town-marker--${town.status}`
  el.setAttribute('aria-label', `${town.name}, ${town.status === 'confined' ? 'confinado' : 'evacuado'}`)
  el.innerHTML = `<span class="town-marker__dot"></span><span class="town-marker__name">${town.name}</span>`
  return el
}

export function FireMap({
  active,
  cooled,
  municipalities,
  layers,
  onReady,
}: FireMapProps) {
  console.log('[FireMap] Props recibidas:', {
    activeCount: active.length,
    cooledCount: cooled.length,
    townsCount: municipalities.length,
    layersActive: layers.active,
    layersCooled: layers.cooled
  })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const markersRef = useRef<Marker[]>([])
  const readyRef = useRef(false)
  const onReadyRef = useRef(onReady)
  const layersRef = useRef(layers)
  onReadyRef.current = onReady
  layersRef.current = layers

  const syncTownMarkers = (map: MapInstance, towns: Municipality[]) => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    for (const town of towns) {
      const visible =
        (town.status === 'confined' && layersRef.current.confined) ||
        (town.status === 'evacuated' && layersRef.current.evacuated)
      if (!visible) continue

      const el = makeTownEl(town)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const title =
          town.status === 'confined'
            ? 'Municipio confinado'
            : 'Núcleo evacuado de forma preventiva'
        popupRef.current
          ?.setLngLat([town.lon, town.lat])
          .setHTML(
            `<div class="popup"><h3>${town.name}</h3><p>${title}</p></div>`,
          )
          .addTo(map)
      })

      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([town.lon, town.lat])
        .addTo(map)
      markersRef.current.push(marker)
    }
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
            attribution:
              '&copy; OpenStreetMap &copy; CARTO · Detecciones térmicas NASA FIRMS',
          },
        },
        layers: [
          {
            id: 'carto',
            type: 'raster',
            source: 'carto',
          },
        ],
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

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(containerRef.current)

    map.on('load', () => {
      console.log('✅ [FireMap] Evento LOAD disparado - mapa inicializado correctamente')
      console.log('[FireMap] Datos iniciales:', { active: active.length, cooled: cooled.length })
      console.log('[FireMap] Zoom:', map.getZoom(), 'Center:', map.getCenter())
      console.log('[FireMap] Canvas size:', map.getCanvas().width, 'x', map.getCanvas().height)
      
      // Añadimos fuentes con datos vacíos si aún no hay datos
      map.addSource('active', {
        type: 'geojson',
        data: toPoints(active.length > 0 ? active : [], 'active'),
      })
      map.addSource('cooled', {
        type: 'geojson',
        data: toPoints(cooled.length > 0 ? cooled : [], 'cooled'),
      })

      // Capa base: cooled-glow - ESTILO SIMPLIFICADO PARA PROD
      map.addLayer({
        id: 'cooled-glow',
        type: 'circle',
        source: 'cooled',
        paint: {
          'circle-radius': 10,
          'circle-color': '#78716c',
          'circle-opacity': 0.5,
          'circle-blur': 0,
        },
      })

      // active-halo - ESTILO SIMPLE SIN EXPRESIONES
      map.addLayer({
        id: 'active-halo',
        type: 'circle',
        source: 'active',
        paint: {
          'circle-radius': 12,
          'circle-color': '#e4572e',
          'circle-opacity': 0.3,
          'circle-blur': 2,
        },
      })

      // cooled-core - ESTILO SIMPLE
      map.addLayer({
        id: 'cooled-core',
        type: 'circle',
        source: 'cooled',
        paint: {
          'circle-radius': 5,
          'circle-color': '#57534e',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 1,
        },
      })

      // active-core - ESTILO SIMPLE
      map.addLayer({
        id: 'active-core',
        type: 'circle',
        source: 'active',
        paint: {
          'circle-radius': 6,
          'circle-color': '#e4572e',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 1,
        },
      })

      const bindHover = (
        layerId: string,
        html: (props: Record<string, unknown>) => string,
      ) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = ''
          popupRef.current?.remove()
        })
        map.on('mousemove', layerId, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0]
          if (!f || !e.lngLat) return
          popupRef.current
            ?.setLngLat(e.lngLat)
            .setHTML(
              `<div class="popup">${html((f.properties ?? {}) as Record<string, unknown>)}</div>`,
            )
            .addTo(map)
        })
      }

      bindHover('active-core', (p) =>
        [
          `<h3>Foco activo</h3>`,
          `<p>${String(p.when)}<br/>FRP ${Number(p.frp).toFixed(1)} MW · ${String(p.source).toUpperCase()} · conf. ${String(p.confidence)}</p>`,
        ].join(''),
      )
      bindHover('cooled-core', (p) =>
        [
          `<h3>Sin detección reciente</h3>`,
          `<p>${String(p.when)}<br/>Detección previa ya no activa en las últimas 24 h.</p>`,
        ].join(''),
      )

      syncTownMarkers(map, municipalities)
      readyRef.current = true
      
      // Forzar actualización inicial de datos ahora que el mapa está listo
      const activeSource = map.getSource('active') as GeoJSONSource | undefined
      const cooledSource = map.getSource('cooled') as GeoJSONSource | undefined
      
      const activeGeoJSON = toPoints(active, 'active')
      const cooledGeoJSON = toPoints(cooled, 'cooled')
      
      console.log('[FireMap] Mapa listo - actualizando fuentes')
      console.log('[FireMap] Active GeoJSON:', JSON.stringify({
        type: activeGeoJSON.type,
        featureCount: activeGeoJSON.features.length,
        firstFeature: activeGeoJSON.features[0]
      }))
      console.log('[FireMap] Cooled GeoJSON:', JSON.stringify({
        type: cooledGeoJSON.type,
        featureCount: cooledGeoJSON.features.length,
        firstFeature: cooledGeoJSON.features[0]
      }))
      
      // PRUEBA: Añadir punto hardcoded para verificar si MapLibre renderiza
      const testPoint = {
        type: 'FeatureCollection' as const,
        features: [{
          type: 'Feature' as const,
          id: 'test',
          properties: { kind: 'test' },
          geometry: { type: 'Point' as const, coordinates: [-0.28, 39.88] } // Centro del mapa
        }]
      }
      
      if (activeSource) {
        activeSource.setData(activeGeoJSON)
        console.log('[FireMap] Fuente active actualizada con', active.length, 'puntos')
      }
      if (cooledSource) {
        cooledSource.setData(cooledGeoJSON)
        console.log('[FireMap] Fuente cooled actualizada con', cooled.length, 'puntos')
      }
      
      // AÑADIR capa de prueba con SYMBOL (más compatible que circle)
      if (!map.getLayer('test-symbol')) {
        map.addSource('test-source', { type: 'geojson', data: testPoint })
        map.addLayer({
          id: 'test-symbol',
          type: 'symbol',
          source: 'test-source',
          layout: {
            'text-field': '🔴',
            'text-size': 24,
            'text-anchor': 'center',
            'text-offset': [0, 0],
          },
          paint: {
            'text-opacity': 1,
          }
        })
        console.log('🔴 [FireMap] Capa de prueba SYMBOL AÑADIDA - deberías ver emojis rojos')
      }
      
      // Forzar repaint inmediato
      map.triggerRepaint()
      console.log('[FireMap] triggerRepaint llamado')
      
      // Verificar que TODAS las capas existen y son visibles
      const allLayers = map.getStyle().layers?.map(l => l.id) || []
      console.log('[FireMap] Todas las capas:', allLayers)
      
      const layerIds: string[] = ['cooled-glow', 'active-halo', 'cooled-core', 'active-core', 'test-point']
      layerIds.forEach((id: string) => {
        const layerExists = map.getLayer(id)
        if (layerExists) {
          const currentVis = map.getLayoutProperty(id, 'visibility')
          console.log(`[FireMap] Capa ${id} visibilidad actual: ${currentVis}`)
          map.setLayoutProperty(id, 'visibility', 'visible')
          const newVis = map.getLayoutProperty(id, 'visibility')
          console.log(`[FireMap] Capa ${id} nueva visibilidad: ${newVis}`)
        } else {
          console.error(`[FireMap] Capa ${id} NO existe`)  
        }
      })
      
      onReadyRef.current()
    })

    map.on('error', (e) => {
      console.error('❌ [FireMap] ERROR del mapa:', e.error)
    })
    
    // Log de carga de tiles
    let tileCount = 0
    map.on('data', (e) => {
      if (e.dataType === 'source' && e.sourceId === 'carto') {
        tileCount++
        if (tileCount <= 3) {
          console.log(`[FireMap] Tile cargado #${tileCount}`, e.isSourceLoaded ? 'SOURCE LOADED' : '')
        }
      }
    })
    
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'carto' && e.isSourceLoaded) {
        console.log('✅ [FireMap] Mapa base CARTO completamente cargado')
      }
    })

    mapRef.current = map
    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) {
      console.log('[FireMap] Mapa no listo para actualizar datos', { 
        hasMap: !!map, 
        isReady: readyRef.current,
        activeCount: active.length,
        cooledCount: cooled.length 
      })
      return
    }
    
    console.log('[FireMap] Actualizando fuentes del mapa', {
      active: active.length,
      cooled: cooled.length
    })
    
    const activeSource = map.getSource('active') as GeoJSONSource | undefined
    const cooledSource = map.getSource('cooled') as GeoJSONSource | undefined
    
    if (!activeSource) {
      console.error('[FireMap] Fuente "active" no existe')
    } else {
      activeSource.setData(toPoints(active, 'active'))
    }
    
    if (!cooledSource) {
      console.error('[FireMap] Fuente "cooled" no existe')
    } else {
      cooledSource.setData(toPoints(cooled, 'cooled'))
    }
  }, [active, cooled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncTownMarkers(map, municipalities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalities, layers.confined, layers.evacuated])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const visibility = (on: boolean) => (on ? 'visible' : 'none')
    const setVis = (ids: string[], on: boolean) => {
      ids.forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility(on))
      })
    }
    setVis(['active-halo', 'active-core'], layers.active)
    setVis(['cooled-glow', 'cooled-core'], layers.cooled)
  }, [layers.active, layers.cooled])

  return <div ref={containerRef} className="map-canvas" />
}

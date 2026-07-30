# Espadà · Seguimiento

Web de seguimiento del incendio de la Serra d'Espadà / Vall d'Uixó (Castellón).

## Datos reales

- **Focos activos / sin detección reciente:** NASA FIRMS (VIIRS NOAA-20/21, Suomi-NPP y MODIS C6.1), filtrados al bounding box de la sierra.
- **Municipios confinados y evacuados:** comunicados Cecopi / Generalitat Valenciana (cobertura 27 jul 2026).
- **Coordenadas de núcleos:** OpenStreetMap Nominatim.

## Desarrollo

```bash
npm install
npm run sync:firms
npm run dev
```

- `npm run sync:firms` descarga FIRMS y regenera `public/data/fire.json`.
- En modo dev, **Actualizar focos** vuelve a pedir los CSV vía proxy Vite (`/api/firms` → NASA).
- Auto-refresh cada 5 minutos.

## Nota operativa

«Sin detección 24 h» significa que hubo calor satelital en días previos y ese píxel ya no aparece en el feed de 24 h. No sustituye el parte oficial de extinción de bomberos.

---

## 🧠 Contexto para IA / Agentes

### Arquitectura del Proyecto

**Stack tecnológico:**
- React 19.1 + TypeScript 5.8 + Vite 7.0
- MapLibre GL 6.0 (mapas interactivos)
- Node.js scripts para sincronización de datos

**Estructura de archivos clave:**
```
src/
  components/FireMap.tsx    # Mapa interactivo con marcadores de focos y municipios
  lib/firms.ts              # Lógica de procesamiento de datos FIRMS (parsers, filtros, deduplicación)
  types.ts                  # Tipos TypeScript (Detection, Municipality, FirePayload)
  App.tsx                   # Componente principal con estado y auto-refresh
  
public/data/
  fire.json                 # Dataset generado (focos + municipios) - REGENERABLE
  municipios.json           # Municipios afectados (actualización manual desde Cecopi)
  
scripts/
  sync-firms.mjs            # Script de sincronización: descarga CSVs de NASA FIRMS y genera fire.json
```

### Flujo de Datos

1. **Datos estáticos (municipios):**
   - Fuente: Comunicados oficiales Cecopi / Generalitat Valenciana
   - Archivo: `public/data/municipios.json`
   - Actualización: Manual cuando hay cambios en estados (confinado/evacuado)
   - Formato: `{ name, status: 'confined'|'evacuated', lat, lon, nota }`

2. **Datos dinámicos (focos):**
   - Fuente: NASA FIRMS API (https://firms.modaps.eosdis.nasa.gov/data/active_fire/)
   - Feeds activos:
     - NOAA-20 VIIRS C2 (24h)
     - NOAA-21 VIIRS C2 (24h)
     - Suomi-NPP VIIRS C2 (24h)
     - MODIS C6.1 (24h y 7d)
   - Proxy Vite: `/api/firms/*` → `https://firms.modaps.eosdis.nasa.gov/data/active_fire/*`
   - Bounding box de filtrado: `[-0.55, 39.7, -0.05, 40.05]` (Serra d'Espadà)
   - Deduplicación: Por coordenadas (3 decimales), fecha, hora (primeros 3 dígitos), satélite y fuente

3. **Generación de fire.json:**
   - Comando: `npm run sync:firms`
   - Script: `scripts/sync-firms.mjs`
   - Proceso:
     1. Descarga CSVs de NASA FIRMS (con fallback a archivos locales si falla la red)
     2. Filtra por bounding box
     3. Convierte rows a objetos `Detection`
     4. Deduplica detecciones
     5. Separa en `active` (< 24h) y `cooled` (24h-7d)
     6. Genera `public/data/fire.json` con estructura `FirePayload`

### Comportamiento en Tiempo Real

**Modo desarrollo (`npm run dev`):**
- Carga inicial: `fire.json` local
- Luego intenta fetch en vivo desde NASA FIRMS vía proxy
- Auto-refresh cada 90 segundos (REFRESH_MS = 90_000)
- Botón "Actualizar focos" fuerza refresh manual
- Si falla CORS o red: mantiene datos de `fire.json` como fallback

**Modo producción (`npm run build` + `npm run preview`):**
- Usa exclusivamente datos de `fire.json`
- Sin llamadas en vivo a NASA (CORS bloquea en producción)
- Para actualizar: ejecutar `npm run sync:firms` antes de build

### Estructura de Tipos (src/types.ts)

```typescript
Detection {
  lat, lon: number
  brightness: number | null      // Temperatura del píxel
  frp: number | null             // Fire Radiative Power (MW)
  acq_date: string               // YYYY-MM-DD
  acq_time: string               // HHMM (pad to 4 digits)
  satellite: string              // Ej: "N20", "N21", "SNPP", "Terra", "Aqua"
  confidence: string | number    // "low", "nominal", "high"
  daynight: string               // "D" o "N"
  source: "viirs" | "modis"
  feed?: string                  // ID del feed original
}

Municipality {
  name: string
  status: "confined" | "evacuated"
  lat, lon: number
  nota?: string
}

FirePayload {
  generatedAt: string            // ISO timestamp
  sources: { firms, municipalities, geocoding }
  incident: { name, started, hectares, perimeterKm, status, ... }
  bbox: [number, number, number, number]
  active: Detection[]            // Focos < 24h
  cooled: Detection[]            // Focos 24h-7d
  municipalities: Municipality[]
}
```

### Capas del Mapa (LayerKey)

- `active`: Focos activos (últimas 24h) - marcador naranja (#e4572e)
- `cooled`: Sin detección reciente (24h-7d) - marcador gris (#78716c)
- `confined`: Municipios confinados - botón azul
- `evacuated`: Municipios evacuados - botón rojo

### Configuración Importante

**Vite Proxy (vite.config.ts):**
```typescript
proxy: {
  '/api/firms': {
    target: 'https://firms.modaps.eosdis.nasa.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/firms/, '/data/active_fire')
  }
}
```

**Bounding Box (firms.ts, sync-firms.mjs):**
```javascript
const WEST = -0.55
const EAST = -0.05
const SOUTH = 39.7
const NORTH = 40.05
```

### Actualización de Municipios

Para actualizar los municipios afectados:
1. Consultar nota de prensa más reciente de Cecopi Generalitat Valenciana
2. Editar `public/data/municipios.json`
3. Mantener campos `_ultima_actualizacion`, `_total_confinados`, `_total_evacuados`
4. Cada municipio: `{ name, status, lat, lon, nota }`
5. Las coordenadas se pueden obtener de OpenStreetMap Nominatim

### Comandos Útiles

```bash
# Instalación inicial
npm install

# Sincronizar datos FIRMS desde NASA
npm run sync:firms

# Desarrollo local con hot-reload
npm run dev

# Build para producción
npm run build

# Preview de producción local
npm run preview
```

### Notas Técnicas

- **MapLibre worker:** El proxy redirige `/assets/maplibre-gl-worker.mjs` a `/assets/maplibre-gl-worker.js` para compatibilidad
- **Optimización:** `optimizeDeps.exclude: ['maplibre-gl']` evita problemas con dependencias nativas
- **Markers dinámicos:** Tamaño proporcional al FRP (Fire Radiative Power) para focos activos
- **Popup:** Muestra fecha/hora de adquisición formateada en español
- **ResizeObserver:** El mapa se adapta automáticamente a cambios de tamaño del contenedor

### Estado Actual (2026-07-30)

- **Incendio:** Serra d'Espadà / Vall d'Uixó, Castellón
- **Inicio:** ~25-26 julio 2026
- **Municipios evacuados:** 15 núcleos (~8500 personas)
- **Municipios confinados:** 0 (desconfinamientos parciales en curso)
- **Última actualización municipios:** 2026-07-29

### Recursos Externos

- NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/
- Cecopi Generalitat Valenciana: https://www.gva.es/es/inicio/-/contenido/cecopi-incendios
- OpenStreetMap Nominatim: https://nominatim.openstreetmap.org/

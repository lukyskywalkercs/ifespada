import { useEffect, useState } from 'react'
import './AirQualityPanel.css'

interface AirQualityData {
  pm25: number | null
  pm10: number | null
  aqi: number | null
  aqiCategory: string
  aqiColor: string
  temperature: number | null
  windSpeed: number | null
  windDir: string | null
  humidity: number | null
  lastUpdate: string | null
}

const AQI_CATEGORIES = [
  { max: 50, label: 'Bueno', color: '#00e400' },
  { max: 100, label: 'Moderado', color: '#ffff00' },
  { max: 150, label: 'No saludable (S.G.)', color: '#ff7e00' },
  { max: 200, label: 'No saludable', color: '#ff0000' },
  { max: 300, label: 'Muy no saludable', color: '#8f3f97' },
  { max: Infinity, label: 'Peligroso', color: '#7e0023' },
]

function getAQICategory(aqi: number) {
  return AQI_CATEGORIES.find((cat) => aqi <= cat.max) || AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
}

// Coordenadas Serra d'Espadà
const LAT = 39.88
const LON = -0.28

export function AirQualityPanel() {
  const [data, setData] = useState<AirQualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const fetchAirQuality = async () => {
      try {
        // Open-Meteo API (gratis, sin API key) - incluye calidad del aire y meteorología
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide&forecast_daily=temperature_2m_max,wind_speed_10m_max,relative_humidity_2m&timezone=auto`
        
        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar la calidad del aire')
        
        const json = await res.json()
        const current = json.current || {}
        const daily = json.daily || {}
        
        // Calcular AQI aproximado basado en PM2.5 (método EPA simplificado)
        const pm25 = current.pm2_5 ?? null
        const pm10 = current.pm10 ?? null
        
        let aqi: number | null = null
        if (pm25 !== null) {
          // Fórmula simplificada EPA AQI para PM2.5
          if (pm25 <= 12) aqi = Math.round((50 / 12) * pm25)
          else if (pm25 <= 35.4) aqi = Math.round(50 + ((100 - 50) / (35.4 - 12)) * (pm25 - 12))
          else if (pm25 <= 55.4) aqi = Math.round(100 + ((150 - 100) / (55.4 - 35.4)) * (pm25 - 35.4))
          else if (pm25 <= 150.4) aqi = Math.round(150 + ((200 - 150) / (150.4 - 55.4)) * (pm25 - 55.4))
          else aqi = Math.min(500, Math.round(200 + ((300 - 200) / (250.4 - 150.4)) * (pm25 - 150.4)))
        }
        
        const category = aqi ? getAQICategory(aqi) : null
        
        setData({
          pm25: pm25 !== null ? Math.round(pm25 * 10) / 10 : null,
          pm10: pm10 !== null ? Math.round(pm10 * 10) / 10 : null,
          aqi,
          aqiCategory: category?.label ?? 'N/A',
          aqiColor: category?.color ?? '#a8a29e',
          temperature: daily.temperature_2m_max?.[0] ?? null,
          windSpeed: daily.wind_speed_10m_max?.[0] ?? null,
          windDir: null, // Open-Meteo no devuelve dirección en esta endpoint
          humidity: daily.relative_humidity_2m?.[0] ?? null,
          lastUpdate: new Date().toISOString(),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error de carga')
      } finally {
        setLoading(false)
      }
    }

    fetchAirQuality()
    
    // Actualizar cada 10 minutos
    const interval = setInterval(fetchAirQuality, 600_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="air-quality-panel air-quality-panel--loading">
        <span className="air-quality-panel__spinner" />
      </div>
    )
  }

  if (error) {
    return null // Silencioso, no mostrar nada si falla
  }

  return (
    <div className={`air-quality-panel ${collapsed ? 'air-quality-panel--collapsed' : ''}`}>
      <button
        type="button"
        className="air-quality-panel__header"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir calidad del aire' : 'Contraer calidad del aire'}
      >
        <div className="air-quality-panel__title">
          <span className="air-quality-panel__icon">🌫️</span>
          <span>Calidad del Aire</span>
        </div>
        <span className="air-quality-panel__chevron">
          {collapsed ? '›' : '‹'}
        </span>
      </button>
      
      {!collapsed && data && (
        <div className="air-quality-panel__content">
          {/* AQI Principal */}
          <div className="air-quality-panel__aqi">
            <div 
              className="air-quality-panel__aqi-value"
              style={{ backgroundColor: data.aqiColor }}
            >
              {data.aqi ?? '—'}
            </div>
            <div className="air-quality-panel__aqi-category">
              {data.aqiCategory}
            </div>
          </div>
          
          {/* Partículas */}
          <div className="air-quality-panel__metrics">
            <div className="air-quality-panel__metric">
              <span className="air-quality-panel__metric-label">PM2.5</span>
              <span className="air-quality-panel__metric-value">
                {data.pm25 ?? '—'} <small>μg/m³</small>
              </span>
            </div>
            <div className="air-quality-panel__metric">
              <span className="air-quality-panel__metric-label">PM10</span>
              <span className="air-quality-panel__metric-value">
                {data.pm10 ?? '—'} <small>μg/m³</small>
              </span>
            </div>
          </div>
          
          {/* Separador */}
          <div className="air-quality-panel__divider" />
          
          {/* Meteorología */}
          <div className="air-quality-panel__weather">
            <div className="air-quality-panel__weather-title">
              <span>🌡️ Temperatura</span>
            </div>
            <div className="air-quality-panel__weather-metrics">
              <div className="air-quality-panel__metric">
                <span className="air-quality-panel__metric-value">
                  {data.temperature ?? '—'}°C
                </span>
              </div>
              {data.windSpeed !== null && (
                <div className="air-quality-panel__metric">
                  <span className="air-quality-panel__metric-label">Viento</span>
                  <span className="air-quality-panel__metric-value">
                    {data.windSpeed} <small>km/h</small>
                  </span>
                </div>
              )}
              {data.humidity !== null && (
                <div className="air-quality-panel__metric">
                  <span className="air-quality-panel__metric-label">Humedad</span>
                  <span className="air-quality-panel__metric-value">
                    {data.humidity}<small>%</small>
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Última actualización */}
          <div className="air-quality-panel__footer">
            <span>Actualizado {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</span>
          </div>
        </div>
      )}
    </div>
  )
}

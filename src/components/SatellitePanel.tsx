import { useState } from 'react'
import './SatellitePanel.css'

interface SatellitePanelProps {
  isSatellite: boolean
  onToggle: () => void
}

export function SatellitePanel({ isSatellite, onToggle }: SatellitePanelProps) {
  const [expanded, setExpanded] = useState(false)

  const handleClick = () => {
    onToggle()
    setExpanded(!expanded)
  }

  return (
    <div className={`satellite-panel ${expanded ? 'satellite-panel--expanded' : ''}`}>
      <button
        type="button"
        className="satellite-panel__header"
        onClick={handleClick}
        aria-expanded={expanded}
        aria-label={expanded ? 'Contraer información satelital' : 'Expandir información satelital'}
      >
        <div className="satellite-panel__title">
          <span className="satellite-panel__icon">🛰️</span>
          <span>{isSatellite ? 'Vista Infrarroja' : 'Vista Mapa'}</span>
        </div>
        <span className="satellite-panel__chevron">
          {expanded ? '‹' : '›'}
        </span>
      </button>
      
      {expanded && (
        <div className="satellite-panel__content">
          <p className="satellite-panel__desc">
            {isSatellite 
              ? 'Capa satelital de la NASA con realce infrarrojo para resaltar calor y vegetación.'
              : 'Mapa base CartoDB Voyager. Pulsa para activar la capa infrarroja.'}
          </p>
          <div className="satellite-panel__info">
            <div className="satellite-panel__metric">
              <span className="satellite-panel__metric-label">Satèl·lit</span>
              <span className="satellite-panel__metric-value">NASA Terra/Aqua</span>
            </div>
            <div className="satellite-panel__metric">
              <span className="satellite-panel__metric-label">Resolució</span>
              <span className="satellite-panel__metric-value">250m/píxel</span>
            </div>
            <div className="satellite-panel__metric">
              <span className="satellite-panel__metric-label">Actualització</span>
              <span className="satellite-panel__metric-value">1-2 vegades/dia</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

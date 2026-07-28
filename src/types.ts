export type TownStatus = 'confined' | 'evacuated'

export interface Detection {
  lat: number
  lon: number
  brightness: number | null
  frp: number | null
  acq_date: string
  acq_time: string
  satellite: string
  confidence: string | number
  daynight: string
  source: string
  feed?: string
}

export interface Municipality {
  name: string
  status: TownStatus
  lat: number
  lon: number
}

export interface FirePayload {
  generatedAt: string
  sources: {
    firms: string
    municipalities: string
    geocoding: string
  }
  incident: {
    name: string
    started: string
    hectares: number
    perimeterKm: number
    status: string
    confinedPeople: number
    evacuatedPeople: number
    aerialMeans: number
    groundCrew: number
  }
  bbox: [number, number, number, number]
  active: Detection[]
  cooled: Detection[]
  municipalities: Municipality[]
}

export type LayerKey = 'active' | 'cooled' | 'confined' | 'evacuated'

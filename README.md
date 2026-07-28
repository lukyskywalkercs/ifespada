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

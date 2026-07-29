/**
 * Scraper de noticias RSS para extraer municipios confinados/evacuados
 * Fuentes: Levante EMV, Las Provincias, Europa Press
 */

import https from 'https'

const RSS_URLS = [
  'https://www.levante-emv.com/rss/',
  'https://www.lasprovincias.es/rss/2.0/?section=/castellon',
]

// Municipios de la zona del incendio
const MUNICIPIOS_ZONA = [
  "La Vall d'Uixó", 'Almassora', 'Almenara', 'Betxí', 'Xilxes', 'Chilches',
  'Eslida', 'Aín', 'Azuébar', 'Castellnovo', 'Chóvar', 'Geldo', 'Higueras',
  'Jérica', 'Matet', 'Pavías', 'Sot de Ferrer', 'Torres Torres',
  'Algimia de Almonacid', 'Alfondeguilla', 'Suera', 'Vall de Almonacid',
  'Vila-real', 'Burriana', 'Nules', 'Moncofa', 'Artana', 'Tales', 
  'Ayódar', 'Fanzara', 'Onda', 'Ribesalbes', 'Alcora'
]

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; EspadàFireTracker/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      } 
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function parseRSS(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const titleMatch = itemXml.match(/<title>([^<]+)/)
    const descMatch = itemXml.match(/<description>([^<]+)/)
    const linkMatch = itemXml.match(/<link>([^<]+)/)
    const dateMatch = itemXml.match(/<pubDate>([^<]+)/)
    
    if (titleMatch) {
      items.push({
        title: titleMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : '',
        link: linkMatch ? linkMatch[1].trim() : '',
        pubDate: dateMatch ? new Date(dateMatch[1]) : new Date(),
      })
    }
  }
  
  return items
}

function extractMunicipios(text) {
  const found = []
  const textLower = text.toLowerCase()
  
  for (const mun of MUNICIPIOS_ZONA) {
    if (textLower.includes(mun.toLowerCase())) {
      if (!found.includes(mun)) found.push(mun)
    }
  }
  
  return found
}

function extractStatus(text) {
  const lower = text.toLowerCase()
  
  // Palabras clave para estado
  if (lower.includes('s\'alça') || lower.includes('levanta') || lower.includes('fin del confinamiento')) {
    return 'lifted'
  }
  if (lower.includes('confin') || lower.includes('confinament')) {
    return 'confined'
  }
  if (lower.includes('evacua') || lower.includes('desaloja')) {
    return 'evacuated'
  }
  
  return null
}

async function scrape() {
  console.log('\n📰 Scraping de noticias para municipios...')
  
  const resultados = {
    municipiosConfinados: [],
    municipiosEvacuados: [],
    fuentes: [],
  }
  
  let totalNoticias = 0
  
  for (const url of RSS_URLS) {
    try {
      console.log(`  Descargando ${url.includes('levante') ? 'Levante EMV' : 'Las Provincias'}...`)
      const xml = await fetchRSS(url)
      const items = parseRSS(xml)
      totalNoticias += items.length
      console.log(`    ${items.length} items en el feed`)
      
      // Filtrar últimas 72 horas y noticias relevantes
      const now = new Date()
      const relevantItems = items.filter(item => {
        const hoursDiff = (now - item.pubDate) / (1000 * 60 * 60)
        if (hoursDiff > 72) return false
        
        const fullText = (item.title + ' ' + item.description).toLowerCase()
        return fullText.includes('espadà') || 
               fullText.includes('espada') || 
               fullText.includes('vall d\'uixó') ||
               fullText.includes('incendi') || 
               fullText.includes('incendio')
      })
      
      console.log(`    ${relevantItems.length} noticias sobre el incendio`)
      
      for (const item of relevantItems) {
        const fullText = item.title + ' ' + item.description
        const municipios = extractMunicipios(fullText)
        const status = extractStatus(fullText)
        
        if (municipios.length > 0) {
          console.log(`    📍 ${item.title.substring(0, 60)}`)
          console.log(`       Municipios: ${municipios.join(', ')}`)
          console.log(`       Estado: ${status || 'desconocido'}`)
          
          // Por defecto, asumir confinado si hay menciones al incendio
          const finalStatus = status || 'confined'
          
          if (finalStatus === 'confined') {
            municipios.forEach(m => {
              if (!resultados.municipiosConfinados.includes(m)) {
                resultados.municipiosConfinados.push(m)
              }
            })
          } else if (finalStatus === 'evacuated') {
            municipios.forEach(m => {
              if (!resultados.municipiosEvacuados.includes(m)) {
                resultados.municipiosEvacuados.push(m)
              }
            })
          }
          
          resultados.fuentes.push({
            titulo: item.title,
            link: item.link,
            medio: url.includes('levante') ? 'Levante EMV' : 'Las Provincias',
            fecha: item.pubDate.toISOString(),
          })
        }
      }
    } catch (err) {
      console.error(`    ❌ Error con ${url}:`, err.message)
    }
  }
  
  console.log('\n✅ Resumen:')
  console.log(`   Total noticias analizadas: ${totalNoticias}`)
  console.log(`   Confinados: ${resultados.municipiosConfinados.length > 0 ? resultados.municipiosConfinados.join(', ') : 'Ninguno'}`)
  console.log(`   Evacuados: ${resultados.municipiosEvacuados.length > 0 ? resultados.municipiosEvacuados.join(', ') : 'Ninguno'}`)
  console.log(`   Fuentes: ${resultados.fuentes.length}`)
  
  return resultados
}

export { scrape }

// Ejecutar si es main
if (import.meta.url.replace('file:///', '').replace('file://', '') === process.argv[1]) {
  scrape()
    .then(r => {
      console.log('\n📋 JSON resultante:')
      console.log(JSON.stringify(r, null, 2))
    })
    .catch(err => {
      console.error('❌ Error:', err)
      process.exit(1)
    })
}

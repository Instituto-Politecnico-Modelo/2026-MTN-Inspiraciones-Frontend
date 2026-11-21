import { readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { log } from 'node:console'
import { argv } from 'node:process'
import { URL } from 'node:url'
import { gzipSync } from 'node:zlib'

// WFS GetFeature in EPSG:4326, xmlns geonode, for localidades_censales and jurisdicciones (cpr='02').
// Source: INDEC, Cartografía y códigos geográficos del Sistema Estadístico Nacional.
// Service: https://geonode.indec.gob.ar/geoserver/geonode/ows
const [localitiesFile, capitalFile] = argv.slice(2)
if (!localitiesFile || !capitalFile) {
  throw new Error('Uso: node scripts/prepare-localities.mjs <localidades.geojson> <caba.geojson>')
}

const [localities, capital] = await Promise.all([localitiesFile, capitalFile].map(async file => JSON.parse(await readFile(file, 'utf8'))))
if (localities.features.length !== localities.numberMatched || capital.features.length !== 1 || capital.features[0].properties.cpr !== '02') {
  throw new Error('Se requiere la capa completa de localidades censales y la jurisdicción 02 (CABA).')
}

// Simplificación Douglas–Peucker con un error máximo de 0,00005 grados (~6 m).
const toleranceSquared = 0.00005 ** 2
function segmentDistanceSquared([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx ** 2 + dy ** 2
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
}

function simplifyRing(ring) {
  const keep = [0, ring.length - 1]
  const pending = [[0, ring.length - 1]]
  while (pending.length) {
    const [start, end] = pending.pop()
    let furthest = -1
    let maxDistance = toleranceSquared
    for (let index = start + 1; index < end; index++) {
      const distance = segmentDistanceSquared(ring[index], ring[start], ring[end])
      if (distance > maxDistance) {
        maxDistance = distance
        furthest = index
      }
    }
    if (furthest !== -1) {
      keep.push(furthest)
      pending.push([start, furthest], [furthest, end])
    }
  }
  // Se conserva un anillo pequeño entero si la simplificación lo colapsaría.
  const points = keep.length < 4 ? ring : keep.sort((a, b) => a - b).map(index => ring[index])
  return points.slice(0, -1).flatMap(point => point.map(value => Number(value.toFixed(6))))
}

const features = [...capital.features, ...localities.features.filter(feature => feature.properties.cpr !== '02')]
const dataset = features.map(({ properties, geometry }) => {
  const polygons = geometry.coordinates.map(polygon => polygon.map(simplifyRing))
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const [outer] of polygons) {
    for (let index = 0; index < outer.length; index += 2) {
      west = Math.min(west, outer[index])
      east = Math.max(east, outer[index])
      south = Math.min(south, outer[index + 1])
      north = Math.max(north, outer[index + 1])
    }
  }
  return [properties.nam, west, south, east, north, polygons]
})
const output = JSON.stringify(dataset)
await writeFile(new URL('../src/data/localities-ar.json', import.meta.url), output)
log(`${dataset.length} localidades. ${Buffer.byteLength(output)} bytes. ${gzipSync(output).length} bytes con gzip.`)

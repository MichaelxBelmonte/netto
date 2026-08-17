import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BOUNDARIES_URL =
  'https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip'
const OUTPUT_PATH = fileURLToPath(
  new URL('../src/data/italy-provinces-2026.json', import.meta.url),
)

function run(command, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'netto-map-'))

try {
  const archivePath = join(temporaryDirectory, 'istat-boundaries.zip')
  const convertedPath = join(temporaryDirectory, 'provinces.geojson')
  const response = await fetch(BOUNDARIES_URL)

  if (!response.ok) {
    throw new Error(`ISTAT boundaries download failed: ${response.status}`)
  }

  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()))
  await run('unzip', [
    '-q',
    archivePath,
    'ProvCM01012026_g/*',
    '-d',
    temporaryDirectory,
  ])
  await run('npx', [
    '--yes',
    'mapshaper@0.7.53',
    join(
      temporaryDirectory,
      'ProvCM01012026_g',
      'ProvCM01012026_g_WGS84.shp',
    ),
    '-proj',
    'wgs84',
    '-simplify',
    'weighted',
    '8%',
    'keep-shapes',
    '-clean',
    '-o',
    'format=geojson',
    'precision=0.0001',
    convertedPath,
  ])

  const source = JSON.parse(await readFile(convertedPath, 'utf8'))
  const output = {
    type: 'FeatureCollection',
    features: source.features.map((feature) => ({
      type: 'Feature',
      properties: {
        r: feature.properties.COD_REG,
        p: feature.properties.SIGLA,
        n: feature.properties.DEN_UTS,
      },
      geometry: feature.geometry,
    })),
  }

  if (output.features.length !== 110) {
    throw new Error(`Expected 110 provincial areas, found ${output.features.length}`)
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(output) + '\n')
  console.log(`Wrote ${output.features.length} ISTAT areas to ${OUTPUT_PATH}`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}

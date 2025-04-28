// File: scripts/benchmark_local_vs_url.ts

import axios from 'axios'
import * as fs from 'fs'
import { promises as fsp } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { performance } from 'perf_hooks'
import { bufferCompare, hashCompare } from './utils'

interface LocalVsUrlBenchmarkResult {
  fileName: string
  sizeKB: number
  bufferTimeMs: number
  hashTimeMs: number
}

async function downloadToTemp(url: string): Promise<string> {
  const tempDir = path.join(__dirname, '../temp')
  await fsp.mkdir(tempDir, { recursive: true })

  const tempPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString().slice(2)}.bin`)
  const response = await axios.get(url, { responseType: 'stream' })
  const stream = fs.createWriteStream(tempPath)
  await pipeline(response.data, stream)

  return tempPath
}

async function benchmarkLocalVsUrl(localPath: string, remoteUrl: string): Promise<LocalVsUrlBenchmarkResult> {
  const tempRemotePath = await downloadToTemp(remoteUrl)

  const stat = await fsp.stat(localPath)
  const sizeKB = stat.size / 1024

  const t0 = performance.now()
  await bufferCompare(localPath, tempRemotePath)
  const t1 = performance.now()
  const bufferTimeMs = t1 - t0

  const t2 = performance.now()
  await hashCompare(localPath, tempRemotePath)
  const t3 = performance.now()
  const hashTimeMs = t3 - t2

  await fsp.unlink(tempRemotePath)

  return {
    fileName: path.basename(localPath),
    sizeKB,
    bufferTimeMs,
    hashTimeMs
  }
}

async function main() {
  const benchmarksDir = path.join(__dirname, '../benchmarks')
  await fsp.mkdir(benchmarksDir, { recursive: true })

  const tests = [
    {
      local: path.join(__dirname, '../assets/sample1.png'),
      url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png'
    },
    {
      local: path.join(__dirname, '../assets/sample2.jpg'),
      url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Wp-w4-big.jpg'
    }
  ]

  const results: LocalVsUrlBenchmarkResult[] = []

  for (const { local, url } of tests) {
    console.log(`Comparing local ${local} with remote ${url}`)
    const result = await benchmarkLocalVsUrl(local, url)
    results.push(result)
  }

  const today = new Date().toISOString().slice(0,10).replace(/-/g, '_')
  const csvPath = path.join(benchmarksDir, `local_vs_url_benchmark_${today}.csv`)

  const csvLines: string[] = ['file_name,size_kb,buffer_time_ms,hash_time_ms']
  for (const result of results) {
    csvLines.push(`${result.fileName},${result.sizeKB.toFixed(2)},${result.bufferTimeMs.toFixed(3)},${result.hashTimeMs.toFixed(3)}`)
  }

  await fsp.writeFile(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`✅ Local vs URL benchmark saved to ${csvPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

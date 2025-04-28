// File: scripts/benchmark_local_vs_url_head.ts

import axios from 'axios'
import * as fs from 'fs'
import { promises as fsp } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { performance } from 'perf_hooks'
import { bufferCompare, hashCompare } from './utils'
import { checkNodeVersion } from './utils'

async function downloadToTemp(url: string): Promise<string> {
  const tempDir = path.join(__dirname, '../temp')
  await fsp.mkdir(tempDir, { recursive: true })

  const tempPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString().slice(2)}.bin`)
  const response = await axios.get(url, { responseType: 'stream' })
  const stream = fs.createWriteStream(tempPath)
  await pipeline(response.data, stream)

  return tempPath
}

async function benchmarkLocalVsUrlHead(localPath: string, remoteUrl: string) {
    const stat = await fsp.stat(localPath)
    const localSize = stat.size
    let remoteSize = 0
    let sizeMatch = false
    let fullBufferTimeMs = 0
    let fullHashTimeMs = 0
  
    const t0 = performance.now()
  
    try {
      const headResponse = await axios.head(remoteUrl)
      remoteSize = Number(headResponse.headers['content-length'] || 0)
    } catch (err) {
      console.error(`❌ Failed HEAD request for ${remoteUrl}`, err)
    }
  
    if (localSize === remoteSize) {
      sizeMatch = true
    }
  
    const t1 = performance.now()
    const headCheckTimeMs = t1 - t0
  
    // ❗ Only download and compare if sizes DO NOT match
    if (!sizeMatch) {
      const tempRemotePath = await downloadToTemp(remoteUrl)
  
      const t2 = performance.now()
      await bufferCompare(localPath, tempRemotePath)
      const t3 = performance.now()
      fullBufferTimeMs = t3 - t2
  
      const t4 = performance.now()
      await hashCompare(localPath, tempRemotePath)
      const t5 = performance.now()
      fullHashTimeMs = t5 - t4
  
      await fsp.unlink(tempRemotePath)
    }
  
    return {
      fileName: path.basename(localPath),
      localSizeKB: (localSize / 1024).toFixed(2),
      remoteSizeKB: (remoteSize / 1024).toFixed(2),
      headCheckTimeMs: headCheckTimeMs.toFixed(3),
      fullBufferTimeMs: fullBufferTimeMs.toFixed(3),
      fullHashTimeMs: fullHashTimeMs.toFixed(3),
      sizeMatch
    }
  }  

async function main() {
  await checkNodeVersion()

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
    },
    {
        local: path.join(__dirname, '../assets/sample3.png'),
        url: 'https://www.wikipedia.org/portal/wikipedia.org/assets/img/Wikipedia-logo-v2@2x.png'
    }
  ]

  const csvLines: string[] = ['file_name,local_size_kb,remote_size_kb,head_check_time_ms,full_buffer_time_ms,full_hash_time_ms,size_match']

  for (const { local, url } of tests) {
    console.log(`Checking local ${local} vs remote ${url}`)
    const result = await benchmarkLocalVsUrlHead(local, url)

    csvLines.push(
      `${result.fileName},${result.localSizeKB},${result.remoteSizeKB},${result.headCheckTimeMs},${result.fullBufferTimeMs},${result.fullHashTimeMs},${result.sizeMatch}`
    )
  }

  const today = new Date().toISOString().slice(0,10).replace(/-/g, '_')
  const csvPath = path.join(benchmarksDir, `local_vs_url_head_benchmark_${today}.csv`)

  await fsp.writeFile(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`✅ Local vs URL HEAD benchmark saved to ${csvPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

import { performance } from 'perf_hooks'
import { promises as fsp, createWriteStream } from 'fs'
import path from 'path'
import axios from 'axios'

import {
  partialHashCompare,
  streamHashCompare,
  streamBufferCompare,
  downloadBufferCompare,
  downloadHashCompare,
  checkNodeVersion
} from './utils'

export type ComparisonStrategy =
  | 'etag'
  | 'content-length'
  | 'partial-hash'
  | 'stream-hash'
  | 'stream-buffer-compare'
  | 'download-buffer'
  | 'download-hash'

interface SizeInfo {
  label: string          // e.g. "1KB", "10MB"
  sizeKB: number         // for reporting
  remoteUrl: string      // URL to download or HEAD
  etag: string           // expected remote ETag (static truth)
  contentLength: number  // expected file size in bytes (static truth)
}

interface BenchmarkResult {
  method: string
  sizeKB: number
  timeMs: number
}

const REMOTE_BASE = 'https://raw.githubusercontent.com/evagoras/filesage-dev-tools/main/assets/text/'
const sizes: SizeInfo[] = [
  { label: '1KB', sizeKB: 1,    remoteUrl: `${REMOTE_BASE}file_1KB.txt`,   etag: '1b364e5d5c985c7faf03b25982a2f6231e16c0359124f68eebb9517a247884dc', contentLength: 1024 },
  { label: '10KB', sizeKB: 10,   remoteUrl: `${REMOTE_BASE}file_10KB.txt`,  etag: '38475a5e7431cb27a8bced440486d9075ad3b240bb3e89648a505ac70dd8d88f', contentLength: 1024 * 10 },
  { label: '50KB', sizeKB: 50,   remoteUrl: `${REMOTE_BASE}file_50KB.txt`,  etag: 'd8da2fae2fb3e223434ee11ea84d3868df8c9b008fd66071788f0381c327af2d', contentLength: 1024 * 50 },
  { label: '100KB', sizeKB: 100, remoteUrl: `${REMOTE_BASE}file_100KB.txt`, etag: 'b50ed00f6835e2075230ddb7a21364d487d207ff224c1ad41bf300e95983e0df', contentLength: 1024 * 100 },
  { label: '500KB', sizeKB: 500, remoteUrl: `${REMOTE_BASE}file_500KB.txt`, etag: '293b31baeb66cb61c4cd539ef7fcfeac88092205d28ea6ffe4cf977a755a19aa', contentLength: 1024 * 500 },
  { label: '1MB', sizeKB: 1024,  remoteUrl: `${REMOTE_BASE}file_1MB.txt`,   etag: '5ddb70a952d4ad438c1f1f738fc1285158d7ce8ac8aef2b0b7ecc182099eb6c9', contentLength: 1024 * 1024 },
  { label: '5MB', sizeKB: 5*1024, remoteUrl: `${REMOTE_BASE}file_5MB.txt`,  etag: '36291fb743ced5961b3db5cbd9aa010c187992257478438235da3d8625219673', contentLength: 1024 * 1024 * 5 },
  { label: '10MB', sizeKB: 10*1024, remoteUrl: `${REMOTE_BASE}file_10MB.txt`, etag: '8f2b8cf334298e84e96df92432334a544f263f21125b5c84313acc64a06d240a', contentLength: 1024 * 1024 * 10 },
  { label: '20MB', sizeKB: 20*1024, remoteUrl: `${REMOTE_BASE}file_20MB.txt`, etag: 'bbf67581f3a14f45fe89b092d5dae3b9d6e4214c6b645607c40e74cf854f95c3', contentLength: 1024 * 1024 * 20 },
  { label: '50MB', sizeKB: 50*1024, remoteUrl: `${REMOTE_BASE}file_50MB.txt`, etag: '1efe6b3a419c9c07b1f80202bf60f66f36d67d78cb1d7c1ca4e23b7b34ada70b', contentLength: 1024 * 1024 * 50 },
]

const LOCAL_BASE = path.resolve(__dirname, '../assets/text')
const TEMP_DIR = path.resolve(__dirname, '../temp')
const BENCHMARKS_DIR = path.resolve(__dirname, '../benchmarks')

async function downloadRemoteFile(url: string, destination: string): Promise<void> {
  const resp = await axios.get(url, { responseType: 'stream' })
  const writer = createWriteStream(destination)
  await new Promise<void>((resolve, reject) => {
    resp.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

async function measure<T>(fn: () => Promise<T>): Promise<number> {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

/**
 * Prepare remote files for comparisons.
 */
async function prepareFiles(): Promise<Map<string,string>> {
  await fsp.mkdir(TEMP_DIR, { recursive: true })
  const fileMap = new Map<string,string>()
  for (const info of sizes) {
    const tempPath = path.join(TEMP_DIR, `temp_${info.label}.txt`)
    await downloadRemoteFile(info.remoteUrl, tempPath)
    fileMap.set(info.label, tempPath)
  }
  return fileMap
}

/**
 * Benchmark each comparison strategy, including download+stream-compare.
 */
async function benchmark(info: SizeInfo, localPath: string, remotePath: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const { sizeKB, remoteUrl, etag, contentLength } = info

  // ETag: compare remote header ETag
  results.push({ method: 'etag', sizeKB, timeMs: await measure(async () => {
    const resp = await axios.head(remoteUrl)
    const headerRaw = resp.headers['etag'] ?? ''
    const headerEtag = headerRaw.replace(/^W\//,'').replace(/"/g,'')
    console.log(`[Remote ETag] ${info.label}: ${headerEtag}`)
    console.log(`[Expected ETag] ${info.label}: ${etag}`)
    if (headerEtag !== etag) throw new Error(`ETag mismatch for ${info.label}`)
  })})

  // Content-Length: raw header vs local
  results.push({ method: 'content-length', sizeKB, timeMs: await measure(async () => {
    const resp = await axios.head(remoteUrl, { headers: { 'Accept-Encoding': 'identity' } })
    const remoteLen = parseInt(resp.headers['content-length'] || '0', 10)
    const { size: localLen } = await fsp.stat(localPath)
    console.log(`[Remote Len] ${info.label}: ${remoteLen}, [Local Len]: ${localLen}`)
    if (remoteLen !== localLen) throw new Error(`Content-Length mismatch for ${info.label}`)
  })})

  // Partial-hash
  results.push({ method: 'partial-hash', sizeKB, timeMs: await measure(() => partialHashCompare(localPath, remoteUrl)) })

  // Stream-hash
  results.push({ method: 'stream-hash', sizeKB, timeMs: await measure(() => streamHashCompare(localPath, remoteUrl)) })

  // Stream-buffer-compare including download
  results.push({ method: 'stream-buffer-compare', sizeKB, timeMs: await measure(async () => {
    // redownload per-run to include network cost
    await downloadRemoteFile(remoteUrl, remotePath)
    await streamBufferCompare(localPath, remotePath)
  })})

  // Download-buffer
  results.push({ method: 'download-buffer', sizeKB, timeMs: await measure(() => downloadBufferCompare(localPath, remoteUrl)) })

  // Download-hash
  results.push({ method: 'download-hash', sizeKB, timeMs: await measure(() => downloadHashCompare(localPath, remoteUrl)) })

  return results
}

async function main(): Promise<void> {
  await checkNodeVersion()
  const fileMap = await prepareFiles()
  const allResults: BenchmarkResult[] = []
  for (const info of sizes) {
    const localPath = path.join(LOCAL_BASE, `file_${info.label}.txt`)
    const remotePath = fileMap.get(info.label)!
    const res = await benchmark(info, localPath, remotePath)
    allResults.push(...res)
  }
  // cleanup
  await Promise.all([...fileMap.values()].map(p => fsp.unlink(p).catch(console.error)))
  await fsp.mkdir(BENCHMARKS_DIR, { recursive: true })
  const csv = ['method,size_kb,time_ms', ...allResults.map(r => `${r.method},${r.sizeKB},${r.timeMs.toFixed(3)}`)]
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'_')
  const outFile = path.join(BENCHMARKS_DIR, `text_methods_benchmark_${today}.csv`)
  await fsp.writeFile(outFile, csv.join('\n'))
  console.log(`✅ Text methods benchmark saved to ${outFile}`)
}

main().catch(err => { console.error('❌ Benchmarking failed:', err); process.exit(1) })

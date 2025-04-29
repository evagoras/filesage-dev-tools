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

const REMOTE_BASE = 'https://raw.githubusercontent.com/evagoras/filesage-dev-tools/main/assets/binary/'
const sizes: SizeInfo[] = [
  { label: '1KB',  sizeKB: 1,    remoteUrl: `${REMOTE_BASE}file_1KB.bin`,  etag: '79e0a0933c741574fc0330fcad30ae523dcd0f7f266fb6aae9f45b8a96ebb83d',  contentLength: 1024 },
  { label: '10KB', sizeKB: 10,   remoteUrl: `${REMOTE_BASE}file_10KB.bin`, etag: '252a53e02d1c4e187a844ec6a7135ff02abb4ffb72153632e07acfc96b5d300d', contentLength: 10240 },
  { label: '50KB', sizeKB: 50,   remoteUrl: `${REMOTE_BASE}file_50KB.bin`, etag: '3c38421b355f03deb11b0472554c819f470ae5df91f6bb8919411762a55ad634', contentLength: 51200 },
  { label: '100KB', sizeKB: 100, remoteUrl: `${REMOTE_BASE}file_100KB.bin`, etag: 'ca1c2f07f9aa88a7aeef7ef6a6b8e54e95ceea3f890c56b3a6575bafc328de89', contentLength: 102400 },
  { label: '500KB', sizeKB: 500, remoteUrl: `${REMOTE_BASE}file_500KB.bin`, etag: '30b8ff3be79a3aebda85f888edde058c9736e35a5b80853d023cf50aaf3a5408', contentLength: 512000 },
  { label: '1MB',  sizeKB: 1024,  remoteUrl: `${REMOTE_BASE}file_1MB.bin`,  etag: 'f1d917bd6fdc55bddb3d7f1d9a381192750a4567d7e0e860af86b51bb14bb3ec',  contentLength: 1048576 },
  { label: '5MB',  sizeKB: 5 * 1024, remoteUrl: `${REMOTE_BASE}file_5MB.bin`,  etag: 'f9f4f0cfca27b4bd029b0c9fda5e92607fd21a4303c0d3f45a52940f9685a3e5', contentLength: 5242880 },
  { label: '10MB', sizeKB: 10 * 1024, remoteUrl: `${REMOTE_BASE}file_10MB.bin`, etag: '3449d94f48488a82a29e49fb7b56122a018046906922e450fc215f10c908ea18', contentLength: 10485760 },
  { label: '20MB', sizeKB: 20 * 1024, remoteUrl: `${REMOTE_BASE}file_20MB.bin`, etag: 'd041cbe675dcf176d547fcdb1e579f157e5fbf1f17ad9027b4ed91553b4db72d', contentLength: 20971520 },
  { label: '50MB', sizeKB: 50 * 1024, remoteUrl: `${REMOTE_BASE}file_50MB.bin`, etag: '25a0475a6b27938c2aceb841fa57550a66b3a433a417239441cff6d522319b08', contentLength: 52428800 }
]

const LOCAL_BASE = path.resolve(__dirname, '../assets/binary')
const TEMP_DIR = path.resolve(__dirname, '../temp')
const BENCHMARKS_DIR = path.resolve(__dirname, '../benchmarks')

async function downloadRemoteFile(url: string, dest: string): Promise<void> {
  const resp = await axios.get(url, { responseType: 'stream' })
  const writer = createWriteStream(dest)
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
 * Prepare remote files once (download into temp)
 */
async function prepareFiles(): Promise<Map<string, string>> {
  await fsp.mkdir(TEMP_DIR, { recursive: true })
  const fileMap = new Map<string, string>()
  for (const info of sizes) {
    const tmp = path.join(TEMP_DIR, `temp_${info.label}.bin`)
    await downloadRemoteFile(info.remoteUrl, tmp)
    fileMap.set(info.label, tmp)
  }
  return fileMap
}

/**
 * Run all comparison strategies, including download+stream-compare timing
 */
async function benchmark(info: SizeInfo, localPath: string, remotePath: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const { sizeKB, remoteUrl, etag, contentLength } = info

  // ETag: compare remote header
  results.push({ method: 'etag', sizeKB, timeMs: await measure(async () => {
    const resp = await axios.head(remoteUrl)
    const headerEtag = (resp.headers['etag'] || '').replace(/^W\//, '').replace(/"/g, '')
    if (headerEtag !== etag) throw new Error(`ETag mismatch for ${info.label}`)
  })})

  // Content-Length: compare local stat vs static truth
  results.push({ method: 'content-length', sizeKB, timeMs: await measure(async () => {
    const stat = await fsp.stat(localPath)
    if (stat.size !== contentLength) throw new Error(`Content-Length mismatch for ${info.label}`)
  })})

  // Partial-Hash via ranged GET
  results.push({ method: 'partial-hash', sizeKB, timeMs: await measure(() => partialHashCompare(localPath, remoteUrl)) })

  // Stream-Hash via GET
  results.push({ method: 'stream-hash', sizeKB, timeMs: await measure(() => streamHashCompare(localPath, remoteUrl)) })

  // Stream-Buffer-Compare including download cost
  results.push({ method: 'stream-buffer-compare', sizeKB, timeMs: await measure(async () => {
    await downloadRemoteFile(remoteUrl, remotePath)
    await streamBufferCompare(localPath, remotePath)
  })})

  // Download-Buffer
  results.push({ method: 'download-buffer', sizeKB, timeMs: await measure(() => downloadBufferCompare(localPath, remoteUrl)) })

  // Download-Hash
  results.push({ method: 'download-hash', sizeKB, timeMs: await measure(() => downloadHashCompare(localPath, remoteUrl)) })

  return results
}

async function main(): Promise<void> {
  await checkNodeVersion()
  const fileMap = await prepareFiles()
  const allResults: BenchmarkResult[] = []
  for (const info of sizes) {
    const localPath = path.join(LOCAL_BASE, `file_${info.label}.bin`)
    const remotePath = fileMap.get(info.label)!
    const res = await benchmark(info, localPath, remotePath)
    allResults.push(...res)
  }

  // clean up
  await Promise.all([...fileMap.values()].map(p => fsp.unlink(p).catch(console.error)))
  await fsp.mkdir(BENCHMARKS_DIR, { recursive: true })
  const csvLines = ['method,size_kb,time_ms',
    ...allResults.map(r => `${r.method},${r.sizeKB},${r.timeMs.toFixed(3)}`)
  ]
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'_')
  const outFile = path.join(BENCHMARKS_DIR, `binary_methods_benchmark_${today}.csv`)
  await fsp.writeFile(outFile, csvLines.join('\n'))

  console.log(`✅ Binary methods benchmark saved to ${outFile}`)
}

main().catch(err => { console.error('❌ Benchmarking failed:', err); process.exit(1) })

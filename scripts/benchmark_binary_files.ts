import { performance } from 'perf_hooks'
import { promises as fs } from 'fs'
import path from 'path'
import { bufferCompare, hashCompare } from './utils'

interface BinaryBenchmarkResult {
  sizeKB: number
  buffer_compare: number
  hash_compare: number
}

async function generateBinaryTestFile(filePath: string, sizeInKB: number) {
  const data = Buffer.alloc(sizeInKB * 1024, Math.floor(Math.random() * 256))
  await fs.writeFile(filePath, data)
}

async function benchmark(sizeKB: number): Promise<BinaryBenchmarkResult> {
  const file1 = path.join(__dirname, `binary_bench_1_${sizeKB}.dat`)
  const file2 = path.join(__dirname, `binary_bench_2_${sizeKB}.dat`)

  await generateBinaryTestFile(file1, sizeKB)
  await fs.copyFile(file1, file2)

  const times: Record<string, number> = {}

  {
    const t0 = performance.now()
    await bufferCompare(file1, file2)
    const t1 = performance.now()
    times['buffer_compare'] = t1 - t0
  }

  {
    const t0 = performance.now()
    await hashCompare(file1, file2)
    const t1 = performance.now()
    times['hash_compare'] = t1 - t0
  }

  await fs.unlink(file1)
  await fs.unlink(file2)

  return {
    sizeKB,
    buffer_compare: times['buffer_compare'],
    hash_compare: times['hash_compare']
  }
}

async function main() {
  const sizes = [1, 10, 50, 100, 500, 1000, 5000]
  const results: BinaryBenchmarkResult[] = []

  for (const size of sizes) {
    results.push(await benchmark(size))
  }

  const today = new Date().toISOString().slice(0,10).replace(/-/g, '_')
  const csvPath = path.join(__dirname, `../benchmarks/binary_file_benchmark_${today}.csv`)

  const csvLines = ['size_kb,buffer_time_ms,hash_time_ms']
  for (const result of results) {
    csvLines.push(`${result.sizeKB},${result.buffer_compare},${result.hash_compare}`)
  }

  await fs.writeFile(csvPath, csvLines.join('\n'))
  console.log(`✅ Binary benchmark saved to ${csvPath}`)
}

main()

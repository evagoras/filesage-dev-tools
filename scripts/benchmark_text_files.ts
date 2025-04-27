import { performance } from 'perf_hooks'
import { promises as fs } from 'fs'
import path from 'path'
import { bufferCompare, hashCompare } from './utils'

interface TextBenchmarkResult {
  sizeKB: number
  string_compare: number
  buffer_compare: number
  hash_compare: number
}

async function generateTextTestFile(filePath: string, sizeInKB: number) {
  const text = 'The quick brown fox jumps over the lazy dog. '
  const repetitions = Math.ceil((sizeInKB * 1024) / text.length)
  const data = text.repeat(repetitions)
  await fs.writeFile(filePath, data.slice(0, sizeInKB * 1024))
}

async function stringCompare(file1: string, file2: string): Promise<boolean> {
  const [data1, data2] = await Promise.all([
    fs.readFile(file1, 'utf8'),
    fs.readFile(file2, 'utf8')
  ])
  return data1 === data2
}

async function benchmark(sizeKB: number): Promise<TextBenchmarkResult> {
  const file1 = path.join(__dirname, `text_bench_1_${sizeKB}.txt`)
  const file2 = path.join(__dirname, `text_bench_2_${sizeKB}.txt`)

  await generateTextTestFile(file1, sizeKB)
  await fs.copyFile(file1, file2)

  const times: Record<string, number> = {}

  {
    const t0 = performance.now()
    await stringCompare(file1, file2)
    const t1 = performance.now()
    times['string_compare'] = t1 - t0
  }

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
    string_compare: times['string_compare'],
    buffer_compare: times['buffer_compare'],
    hash_compare: times['hash_compare']
  }
}

async function main() {
  const sizes = [1, 10, 50, 100, 500, 1000, 5000, 10000]
  const results: TextBenchmarkResult[] = []

  for (const size of sizes) {
    results.push(await benchmark(size))
  }

  const today = new Date().toISOString().slice(0,10).replace(/-/g, '_')
  const csvPath = path.join(__dirname, `../benchmarks/text_file_benchmark_${today}.csv`)

  const csvLines = ['size_kb,string_time_ms,buffer_time_ms,hash_time_ms']
  for (const result of results) {
    csvLines.push(`${result.sizeKB},${result.string_compare},${result.buffer_compare},${result.hash_compare}`)
  }

  await fs.writeFile(csvPath, csvLines.join('\n'))
  console.log(`✅ Text benchmark saved to ${csvPath}`)
}

main()

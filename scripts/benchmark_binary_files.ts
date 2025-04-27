import { performance } from 'perf_hooks'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

async function generateBinaryTestFile(filePath: string, sizeInKB: number) {
  const data = Buffer.alloc(sizeInKB * 1024, Math.floor(Math.random() * 256))
  await fs.writeFile(filePath, data)
}

async function bufferCompare(file1: string, file2: string) {
  const [buffer1, buffer2] = await Promise.all([
    fs.readFile(file1),
    fs.readFile(file2)
  ])
  return buffer1.equals(buffer2)
}

async function hashCompare(file1: string, file2: string) {
  const hashFile = async (path: string) => {
    const data = await fs.readFile(path)
    return createHash('sha256').update(data).digest('hex')
  }
  const [hash1, hash2] = await Promise.all([hashFile(file1), hashFile(file2)])
  return hash1 === hash2
}

async function benchmark(sizeKB: number) {
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
    ...times
  }
}

async function main() {
  const sizes = [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000] // 1KB to 50MB
  const results = []

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

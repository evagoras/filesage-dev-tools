import axios from 'axios'
import { promises as fs, createWriteStream, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { bufferCompare, hashCompare } from './utils'

async function downloadToTemp(url: string): Promise<string> {
  const tempDir = path.join(__dirname, '../temp')
  await fs.mkdir(tempDir, { recursive: true })

  const tempPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString().slice(2)}.bin`)

  const response = await axios.get(url, { responseType: 'stream' })
  const stream = createWriteStream(tempPath)

  await pipeline(response.data, stream)

  return tempPath
}

async function benchmarkLocalVsUrl(localPath: string, remoteUrl: string) {
  const tempRemotePath = await downloadToTemp(remoteUrl)

  const results: Record<string, number> = {}

  const t0 = performance.now()
  await bufferCompare(localPath, tempRemotePath)
  const t1 = performance.now()
  results['buffer_compare_ms'] = t1 - t0

  const t2 = performance.now()
  await hashCompare(localPath, tempRemotePath)
  const t3 = performance.now()
  results['hash_compare_ms'] = t3 - t2

  await fs.unlink(tempRemotePath) // Clean up downloaded temp file

  return results
}

async function main() {
  const tests = [
    {
      local: path.resolve(__dirname, '../assets/sample1.png'),
      url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png'
    },
    {
      local: path.resolve(__dirname, '../assets/sample2.jpg'),
      url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Wp-w4-big.jpg'
    }
  ]

  const csvLines: string[] = []
  csvLines.push('file_name,buffer_compare_ms,hash_compare_ms')

  for (const test of tests) {
    console.log(`Comparing local ${test.local} with remote ${test.url}`)
    const result = await benchmarkLocalVsUrl(test.local, test.url)

    const fileName = path.basename(test.local)
    csvLines.push(`${fileName},${result.buffer_compare_ms.toFixed(3)},${result.hash_compare_ms.toFixed(3)}`)
  }

  const outputDir = path.join(__dirname, '../benchmarks')
  mkdirSync(outputDir, { recursive: true })

  const csvPath = path.join(outputDir, `local_vs_url_benchmark_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}.csv`)
  writeFileSync(csvPath, csvLines.join('\n'), 'utf-8')

  console.log(`Benchmark completed. Results saved to ${csvPath}`)
}

main()

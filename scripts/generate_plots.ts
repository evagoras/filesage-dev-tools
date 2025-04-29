import { checkNodeVersion } from './utils'
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import { ChartConfiguration } from 'chart.js'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import path from 'path'
// @ts-ignore
import csv from 'csv-parser'

const width = 800
const height = 600
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' })

const today = new Date().toISOString().split('T')[0].replace(/-/g, '_')

async function readCSV(filepath: string): Promise<any[]> {
  const results: any[] = []

  return new Promise((resolve, reject) => {
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

function groupDataByMethod(data: any[]): Record<string, { sizeKB: number; timeMs: number }[]> {
  const grouped: Record<string, { sizeKB: number; timeMs: number }[]> = {}

  for (const entry of data) {
    const method = entry.method
    const sizeKB = Number(entry.size_kb)
    const timeMs = Number(entry.time_ms)

    if (!grouped[method]) {
      grouped[method] = []
    }

    grouped[method].push({ sizeKB, timeMs })
  }

  return grouped
}

async function plotBenchmark(data: any[], title: string, outputFilename: string) {
  const grouped = groupDataByMethod(data)

  const sizeLabels = [...new Set(data.map(d => Number(d.size_kb)))].sort((a, b) => a - b)

  const datasets = Object.entries(grouped).map(([method, entries]) => {
    const timeSeries = sizeLabels.map(size => {
      const found = entries.find(e => e.sizeKB === size)
      return found ? found.timeMs : null
    })

    return {
      label: method,
      data: timeSeries,
      fill: false,
      borderColor: getColorForMethod(method),
      backgroundColor: getColorForMethod(method)
    }
  })

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: sizeLabels,
      datasets
    },
    options: {
      plugins: { title: { display: true, text: title } },
      scales: {
        x: { title: { display: true, text: 'File Size (KB)' } },
        y: { title: { display: true, text: 'Time (ms)' } }
      }
    }
  }

  const buffer = await chartJSNodeCanvas.renderToBuffer(config)
  await fsp.mkdir('plots', { recursive: true })
  await fsp.writeFile(`plots/${outputFilename}_${today}.png`, buffer)
}

function getColorForMethod(method: string): string {
  const map: Record<string, string> = {
    'string-compare': 'blue',
    'buffer-compare': 'green',
    'hash-compare': 'red',
    'etag': 'purple',
    'content-length': 'orange',
    'partial-hash': 'teal',
    'stream-hash': 'brown',
    'stream-buffer-compare': 'magenta',
    'download-buffer': 'cyan',
    'download-hash': 'pink'
  }
  return map[method] || 'gray'
}

async function main() {
  await checkNodeVersion()

  const benchmarksPath = path.join(__dirname, '../benchmarks')
  const files = await fsp.readdir(benchmarksPath)

  const textBenchmark = files.find(f => f.startsWith('text_methods_benchmark'))
  const binaryBenchmark = files.find(f => f.startsWith('binary_methods_benchmark'))

  if (textBenchmark) {
    const data = await readCSV(path.join(benchmarksPath, textBenchmark))
    await plotBenchmark(data, 'Performance on Text Files', 'text_files_comparison')
  } else {
    console.warn('⚠️ No text benchmark file found.')
  }

  if (binaryBenchmark) {
    const data = await readCSV(path.join(benchmarksPath, binaryBenchmark))
    await plotBenchmark(data, 'Performance on Binary Files', 'binary_files_comparison')
  } else {
    console.warn('⚠️ No binary benchmark file found.')
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

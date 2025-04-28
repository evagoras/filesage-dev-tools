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

async function plotTextFiles(data: any[]) {
  const sizeKB = data.map(d => Number(d.size_kb))
  const stringTime = data.map(d => Number(d.string_time_ms))
  const bufferTime = data.map(d => Number(d.buffer_time_ms))
  const hashTime = data.map(d => Number(d.hash_time_ms))

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: sizeKB,
      datasets: [
        { label: 'String Compare', data: stringTime, fill: false, borderColor: 'blue', backgroundColor: 'blue' },
        { label: 'Buffer Compare', data: bufferTime, fill: false, borderColor: 'green', backgroundColor: 'green' },
        { label: 'Hash Compare', data: hashTime, fill: false, borderColor: 'red', backgroundColor: 'red' },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Performance on Text Files' } },
      scales: {
        x: { title: { display: true, text: 'File Size (KB)' } },
        y: { title: { display: true, text: 'Time (ms)' } },
      },
    },
  }

  const buffer = await chartJSNodeCanvas.renderToBuffer(config)
  await fsp.writeFile(`plots/text_files_comparison_${today}.png`, buffer)
}

async function plotBinaryFiles(data: any[]) {
  const sizeKB = data.map(d => Number(d.size_kb))
  const bufferTime = data.map(d => Number(d.buffer_time_ms))
  const hashTime = data.map(d => Number(d.hash_time_ms))

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: sizeKB,
      datasets: [
        { label: 'Buffer Compare', data: bufferTime, fill: false, borderColor: 'green', backgroundColor: 'green' },
        { label: 'Hash Compare', data: hashTime, fill: false, borderColor: 'red', backgroundColor: 'red' },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Performance on Binary Files' } },
      scales: {
        x: { title: { display: true, text: 'File Size (KB)' } },
        y: { title: { display: true, text: 'Time (ms)' } },
      },
    },
  }

  const buffer = await chartJSNodeCanvas.renderToBuffer(config)
  await fsp.writeFile(`plots/binary_files_comparison_${today}.png`, buffer)
}

async function plotLocalVsUrlFiles(data: any[]) {
  const sizeKB = data.map(d => Number(d.size_kb))
  const bufferTime = data.map(d => Number(d.buffer_time_ms))
  const hashTime = data.map(d => Number(d.hash_time_ms))

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: sizeKB,
      datasets: [
        { label: 'Buffer Compare', data: bufferTime, fill: false, borderColor: 'green', backgroundColor: 'green' },
        { label: 'Hash Compare', data: hashTime, fill: false, borderColor: 'red', backgroundColor: 'red' },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Performance on Local vs URL Files (Full Download)' } },
      scales: {
        x: { title: { display: true, text: 'File Size (KB)' } },
        y: { title: { display: true, text: 'Time (ms)' } },
      },
    },
  }

  const buffer = await chartJSNodeCanvas.renderToBuffer(config)
  await fsp.writeFile(`plots/local_vs_url_comparison_${today}.png`, buffer)
}

async function plotLocalVsUrlHeadFiles(data: any[]) {
  const sizeKB = data.map(d => Number(d.local_size_kb))
  const headTime = data.map(d => Number(d.head_check_time_ms))
  const bufferTime = data.map(d => Number(d.full_buffer_time_ms))
  const hashTime = data.map(d => Number(d.full_hash_time_ms))

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: sizeKB,
      datasets: [
        { label: 'HEAD Check Only', data: headTime, fill: false, borderColor: 'purple', backgroundColor: 'purple' },
        { label: 'Full Buffer Compare', data: bufferTime, fill: false, borderColor: 'green', backgroundColor: 'green' },
        { label: 'Full Hash Compare', data: hashTime, fill: false, borderColor: 'red', backgroundColor: 'red' },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Performance on Local vs URL Files (HEAD Check)' } },
      scales: {
        x: { title: { display: true, text: 'File Size (KB)' } },
        y: { title: { display: true, text: 'Time (ms)' } },
      },
    },
  }

  const buffer = await chartJSNodeCanvas.renderToBuffer(config)
  await fsp.writeFile(`plots/local_vs_url_head_comparison_${today}.png`, buffer)
}

async function main() {
  await checkNodeVersion()

  const benchmarksPath = path.join(__dirname, '../benchmarks')

  const files = await fsp.readdir(benchmarksPath)

  const textFile = files.find((f: string) => f.startsWith('text_file_benchmark'))
  const binaryFile = files.find((f: string) => f.startsWith('binary_file_benchmark'))
  const localVsUrlFile = files.find((f: string) => f.startsWith('local_vs_url_benchmark'))
  const localVsUrlHeadFile = files.find((f: string) => f.startsWith('local_vs_url_head_benchmark'))

  if (textFile) {
    const data = await readCSV(path.join(benchmarksPath, textFile))
    await plotTextFiles(data)
  }

  if (binaryFile) {
    const data = await readCSV(path.join(benchmarksPath, binaryFile))
    await plotBinaryFiles(data)
  }

  if (localVsUrlFile) {
    const data = await readCSV(path.join(benchmarksPath, localVsUrlFile))
    await plotLocalVsUrlFiles(data)
  }

  if (localVsUrlHeadFile) {
    const data = await readCSV(path.join(benchmarksPath, localVsUrlHeadFile))
    await plotLocalVsUrlHeadFiles(data)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

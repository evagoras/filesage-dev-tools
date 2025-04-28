import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'

const sizes = [
  { label: '1KB', bytes: 1 * 1024 },
  { label: '10KB', bytes: 10 * 1024 },
  { label: '50KB', bytes: 50 * 1024 },
  { label: '100KB', bytes: 100 * 1024 },
  { label: '500KB', bytes: 500 * 1024 },
  { label: '1MB', bytes: 1 * 1024 * 1024 },
  { label: '5MB', bytes: 5 * 1024 * 1024 },
  { label: '10MB', bytes: 10 * 1024 * 1024 },
  { label: '20MB', bytes: 20 * 1024 * 1024 },
  { label: '50MB', bytes: 50 * 1024 * 1024 }
]

const baseAssetsFolder = path.resolve(__dirname, '..', 'assets')
const textFolder = path.join(baseAssetsFolder, 'text')
const binaryFolder = path.join(baseAssetsFolder, 'binary')

// Helper to generate random alphanumeric string of a specific length
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  let result = ''

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}

async function createFiles() {
  // Make sure the assets/text and assets/binary folders exist
  for (const folder of [textFolder, binaryFolder]) {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
  }

  for (const size of sizes) {
    console.log(`Creating files for ${size.label}...`)

    const chunkSize = 1024 * 1024 // 1MB per chunk

    // Text file
    const textFilename = path.join(textFolder, `file_${size.label}.txt`)
    const textStream = fs.createWriteStream(textFilename)

    let textBytesWritten = 0
    while (textBytesWritten < size.bytes) {
      const remaining = size.bytes - textBytesWritten
      const currentChunkSize = Math.min(chunkSize, remaining)
      const randomText = generateRandomString(currentChunkSize)
      textStream.write(randomText)
      textBytesWritten += currentChunkSize
    }

    await new Promise(resolve => textStream.end(resolve))
    console.log(`  Created ${textFilename}`)

    // Binary file
    const binFilename = path.join(binaryFolder, `file_${size.label}.bin`)
    const binStream = fs.createWriteStream(binFilename)

    let binBytesWritten = 0
    while (binBytesWritten < size.bytes) {
      const remaining = size.bytes - binBytesWritten
      const currentChunkSize = Math.min(chunkSize, remaining)
      const randomBuffer = randomBytes(currentChunkSize)
      binStream.write(randomBuffer)
      binBytesWritten += currentChunkSize
    }

    await new Promise(resolve => binStream.end(resolve))
    console.log(`  Created ${binFilename}`)
  }
}

createFiles().catch(console.error)

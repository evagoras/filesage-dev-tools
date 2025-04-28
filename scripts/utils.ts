import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

export async function bufferCompare(file1: string, file2: string): Promise<boolean> {
  const [buffer1, buffer2] = await Promise.all([
    fs.readFile(file1),
    fs.readFile(file2)
  ])
  return buffer1.equals(buffer2)
}

export async function hashCompare(file1: string, file2: string): Promise<boolean> {
  const hashFile = async (path: string) => {
    const data = await fs.readFile(path)
    return createHash('sha256').update(data).digest('hex')
  }
  const [hash1, hash2] = await Promise.all([
    hashFile(file1),
    hashFile(file2)
  ])
  return hash1 === hash2
}

export async function checkNodeVersion() {
  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json')
    const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonRaw)

    if (!packageJson.engines || !packageJson.engines.node) {
      console.warn('⚠️ No "engines.node" field found in package.json — skipping Node.js version check.')
      return
    }

    const required = packageJson.engines.node
    const requiredMajor = parseInt(required.match(/\d+/)?.[0] || '0', 10)

    const [currentMajor] = process.versions.node.split('.').map(Number)

    if (currentMajor < requiredMajor) {
      console.error(`❌ Node.js ${requiredMajor}+ is required. Current version: ${process.version}`)
      process.exit(1)
    }
  } catch (error) {
    console.warn('⚠️ Could not check Node.js version automatically.', error)
  }
}

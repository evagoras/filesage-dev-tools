import { promises as fs } from 'fs'
import { createHash } from 'crypto'

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

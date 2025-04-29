import * as fs from 'fs'
import { promises as fsp } from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import axios from 'axios'
import { createReadStream } from 'fs'

export async function bufferCompare(file1: string, file2: string): Promise<boolean> {
  const [buffer1, buffer2] = await Promise.all([
    fsp.readFile(file1),
    fsp.readFile(file2)
  ])
  return buffer1.equals(buffer2)
}

export async function hashCompare(file1: string, file2: string): Promise<boolean> {
  const [hash1, hash2] = await Promise.all([
    hashFile(file1),
    hashFile(file2)
  ])
  return hash1 === hash2
}

export async function stringCompare(file1: string, file2: string): Promise<boolean> {
  const [str1, str2] = await Promise.all([
    fsp.readFile(file1, 'utf8'),
    fsp.readFile(file2, 'utf8')
  ])
  return str1 === str2
}

export async function streamBufferCompare(file1: string, file2: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const highWaterMark = 64 * 1024
    const s1 = createReadStream(file1, { highWaterMark })
    const s2 = createReadStream(file2, { highWaterMark })

    const q1: Buffer[] = []
    const q2: Buffer[] = []
    let ended1 = false, ended2 = false

    function tryCompare() {
      while (q1.length && q2.length) {
        const b1 = q1.shift()!
        const b2 = q2.shift()!
        if (!b1.equals(b2)) {
          cleanup()
          return resolve(false)
        }
      }
      if (ended1 && ended2) {
        cleanup()
        return resolve(q1.length === 0 && q2.length === 0)
      }
    }

    function onData1(chunk: string | Buffer) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      q1.push(buf)
      tryCompare()
    }
    function onData2(chunk: string | Buffer) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      q2.push(buf)
      tryCompare()
    }
    function onEnd1() { ended1 = true; tryCompare() }
    function onEnd2() { ended2 = true; tryCompare() }
    function onError(err: Error) { cleanup(); reject(err) }

    function cleanup() {
      s1.destroy()
      s2.destroy()
      s1.off('data', onData1)
      s2.off('data', onData2)
      s1.off('end', onEnd1)
      s2.off('end', onEnd2)
      s1.off('error', onError)
      s2.off('error', onError)
    }

    s1.on('data', onData1)
    s2.on('data', onData2)
    s1.once('end', onEnd1)
    s2.once('end', onEnd2)
    s1.once('error', onError)
    s2.once('error', onError)
  })
}

// partial-hash: hash first and last PARTIAL_SIZE bytes of each file
export async function partialHashCompare(filePath: string, remoteUrl: string): Promise<boolean> {
  const PARTIAL_SIZE = 64 * 1024
  // Read local head/tail
  const fd = await fsp.open(filePath, 'r')
  const { size } = await fd.stat()
  const headBuf = Buffer.alloc(Math.min(PARTIAL_SIZE, size))
  await fd.read(headBuf, 0, headBuf.length, 0)
  const tailOffset = Math.max(0, size - PARTIAL_SIZE)
  const tailBuf = Buffer.alloc(Math.min(PARTIAL_SIZE, size))
  await fd.read(tailBuf, 0, tailBuf.length, tailOffset)
  await fd.close()
  const localHash = createHash('sha256').update(headBuf).update(tailBuf).digest('hex')

  // Fetch remote head/tail with no compression
  const headResp = await axios.get(remoteUrl, {
    responseType: 'arraybuffer',
    headers: { Range: `bytes=0-${PARTIAL_SIZE - 1}`, 'Accept-Encoding': 'identity' }
  })
  const headArr = Buffer.from(headResp.data as ArrayBuffer)
  const totalLen = parseInt(headResp.headers['content-range']?.split('/')[1] || '0', 10)
  const startTail = Math.max(0, totalLen - PARTIAL_SIZE)
  const tailResp = await axios.get(remoteUrl, {
    responseType: 'arraybuffer',
    headers: { Range: `bytes=${startTail}-${totalLen - 1}`, 'Accept-Encoding': 'identity' }
  })
  const tailArr = Buffer.from(tailResp.data as ArrayBuffer)
  const remoteHash = createHash('sha256').update(headArr).update(tailArr).digest('hex')

  return localHash === remoteHash
}

// full stream-hash for both local and remote, no compression
export async function streamHashCompare(localPath: string, remoteUrl: string): Promise<boolean> {
  const [localDigest, remoteDigest] = await Promise.all([
    getStreamHash(localPath),
    getRemoteHash(remoteUrl)
  ])
  return localDigest === remoteDigest
}

async function getStreamHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .once('end', () => resolve(hash.digest('hex')))
      .once('error', reject)
  })
}

async function getRemoteHash(remoteUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    axios.get(remoteUrl, { responseType: 'stream', headers: { 'Accept-Encoding': 'identity' } })
      .then(resp => {
        const rs = resp.data as NodeJS.ReadableStream
        rs.on('data', chunk => hash.update(chunk as Buffer))
        rs.once('end', () => resolve(hash.digest('hex')))
        rs.once('error', reject)
      })
      .catch(reject)
  })
}

export async function downloadBufferCompare(localPath: string, remoteUrl: string): Promise<boolean> {
  const [localBuf, remoteResp] = await Promise.all([
    fsp.readFile(localPath),
    axios.get(remoteUrl, { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'identity' } })
  ])
  const remoteBuf = Buffer.from(remoteResp.data as ArrayBuffer)
  return localBuf.equals(remoteBuf)
}

export async function downloadHashCompare(localPath: string, remoteUrl: string): Promise<boolean> {
  const [localHash, remoteResp] = await Promise.all([
    hashFile(localPath),
    axios.get(remoteUrl, { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'identity' } })
  ])
  const remoteHash = createHash('sha256')
    .update(Buffer.from(remoteResp.data as ArrayBuffer))
    .digest('hex')
  return localHash === remoteHash
}

export async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const resp = await axios.get(url, { responseType: 'stream', headers: { 'Accept-Encoding': 'identity' } })
  const writer = fs.createWriteStream(destinationPath)
  return new Promise((resolve, reject) => {
    resp.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fsp.readFile(filePath)
  return createHash('sha256').update(data).digest('hex')
}

export async function checkNodeVersion(): Promise<void> {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json')
    const pkgRaw = await fsp.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(pkgRaw)
    const engines = pkg.engines?.node
    if (!engines) {
      console.warn('⚠️ No "engines.node" in package.json; skipping version check.')
      return
    }
    const required = parseInt(engines.match(/\d+/)?.[0] || '0', 10)
    const current = parseInt(process.versions.node.split('.')[0], 10)
    if (current < required) {
      console.error(`❌ Node ${required}+ required, but running ${process.version}`)
      process.exit(1)
    }
  } catch (err) {
    console.warn('⚠️ Could not verify Node version:', err)
  }
}

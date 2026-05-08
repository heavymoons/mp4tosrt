import http, { IncomingMessage, ServerResponse } from 'http'
import { promises as fs, createReadStream } from 'fs'
import { extname } from 'path'
import type { Pipeline } from './pipeline'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus'
}

function mimeFor(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

let server: http.Server | undefined
let serverPort = 0

export function getMediaServerPort(): number {
  return serverPort
}

export function getMediaUrlForJob(jobId: string): string {
  return `http://127.0.0.1:${serverPort}/job/${encodeURIComponent(jobId)}`
}

async function handleRequest(
  pipeline: Pipeline,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`)
    const match = url.pathname.match(/^\/job\/(.+)$/)
    if (!match) {
      res.writeHead(404).end('not a job url')
      return
    }
    const jobId = decodeURIComponent(match[1]!)
    const job = pipeline.getJob(jobId)
    if (!job) {
      res.writeHead(404).end(`job ${jobId} not found`)
      return
    }

    const filePath = job.inputPath
    const stat = await fs.stat(filePath)
    const total = stat.size
    const mimeType = mimeFor(filePath)

    const range = req.headers.range
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/)
      if (m) {
        const start = parseInt(m[1]!, 10)
        const end = m[2] ? parseInt(m[2], 10) : total - 1
        if (start >= total || end >= total || start > end) {
          res
            .writeHead(416, { 'Content-Range': `bytes */${total}` })
            .end()
          return
        }
        const length = end - start + 1
        res.writeHead(206, {
          'Content-Type': mimeType,
          'Content-Length': String(length),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache'
        })
        createReadStream(filePath, { start, end }).pipe(res)
        return
      }
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    })
    createReadStream(filePath).pipe(res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[media server]', msg)
    if (!res.headersSent) res.writeHead(500)
    res.end(msg)
  }
}

export async function startMediaServer(pipeline: Pipeline): Promise<number> {
  if (server) return serverPort
  server = http.createServer((req, res) => {
    void handleRequest(pipeline, req, res)
  })
  return await new Promise<number>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        serverPort = addr.port
        console.log(`[media server] listening on http://127.0.0.1:${serverPort}`)
        resolve(serverPort)
      } else {
        reject(new Error('failed to get media server port'))
      }
    })
  })
}

export function stopMediaServer(): void {
  if (server) {
    server.close()
    server = undefined
    serverPort = 0
  }
}

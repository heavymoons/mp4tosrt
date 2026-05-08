import { protocol } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import { extname } from 'path'
import type { Pipeline } from './pipeline'

export const VIDEO_SCHEME = 'mp4tosrt-video'

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

async function readChunk(filePath: string, start: number, end: number): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const stream = createReadStream(filePath, { start, end })
    stream.on('data', chunk => chunks.push(chunk as Buffer))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/**
 * mp4tosrt-video://job/<jobId> 形式の URL を受け取り、ジョブの inputPath
 * を Range リクエスト対応で配信する。Range で要求された範囲を Buffer に
 * 読み込んで一括レスポンスする実装。Web Stream への変換を経ないので
 * packaged 環境での互換性が高い。
 */
export function registerVideoProtocol(pipeline: Pipeline): void {
  protocol.handle(VIDEO_SCHEME, async request => {
    try {
      const url = new URL(request.url)
      let jobId = ''
      if (url.pathname && url.pathname !== '/') {
        jobId = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      } else if (url.host) {
        jobId = decodeURIComponent(url.host)
      }

      console.log(`[video protocol] request url=${request.url} jobId=${jobId}`)

      if (!jobId) {
        console.warn('[video protocol] empty jobId')
        return new Response('jobId required', { status: 400 })
      }
      const job = pipeline.getJob(jobId)
      if (!job) {
        console.warn(`[video protocol] job not found: ${jobId}`)
        return new Response(`job ${jobId} not found`, { status: 404 })
      }

      const filePath = job.inputPath
      const stat = await fs.stat(filePath)
      const total = stat.size
      const mimeType = mimeFor(filePath)

      const rangeHeader = request.headers.get('range')
      let start = 0
      let end = total - 1
      let status = 200
      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          start = parseInt(match[1]!, 10)
          end = match[2] ? parseInt(match[2], 10) : total - 1
          if (start >= total || end >= total || start > end) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${total}` }
            })
          }
          status = 206
          headers['Content-Range'] = `bytes ${start}-${end}/${total}`
        }
      }

      const length = end - start + 1
      headers['Content-Length'] = String(length)

      console.log(
        `[video protocol] serving ${filePath} (${mimeType}, ${start}-${end}/${total}, status ${status})`
      )

      const buffer = await readChunk(filePath, start, end)
      return new Response(buffer, { status, headers })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[video protocol]', msg)
      return new Response(msg, { status: 500 })
    }
  })
}

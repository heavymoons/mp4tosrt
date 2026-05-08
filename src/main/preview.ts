import { protocol } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import { Readable } from 'stream'
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

/**
 * mp4tosrt-video://job/<jobId> 形式の URL を受け取り、ジョブの inputPath
 * を Range リクエスト対応で配信する。HTML5 <video> の seek / streaming に
 * 対応するため、fs.createReadStream + 手動 Range ヘッダ処理を使用。
 */
export function registerVideoProtocol(pipeline: Pipeline): void {
  protocol.handle(VIDEO_SCHEME, async request => {
    try {
      const url = new URL(request.url)
      // pathname は host を含まないので、host 部分にあたる "job" を捨てて
      // url.pathname だけ使う場合は注意。今は host=job を前提とせず、
      // hostname または pathname に jobId が入る両ケースを許容する。
      let jobId = ''
      // url.host は scheme://HOST/path の HOST 部分
      // mp4tosrt-video://job/<id> の場合、host="job", pathname="/<id>"
      // mp4tosrt-video://<id> の場合、host="<id>", pathname="/" or ""
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
      console.log(`[video protocol] serving ${filePath} (${total} bytes, ${mimeType})`)

      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1]!, 10)
          const end = match[2] ? parseInt(match[2], 10) : total - 1
          if (start >= total || end >= total || start > end) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${total}` }
            })
          }
          const length = end - start + 1
          const stream = createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream) as ReadableStream, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(length),
              'Content-Range': `bytes ${start}-${end}/${total}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }

      const stream = createReadStream(filePath)
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache'
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[video protocol]', msg)
      return new Response(msg, { status: 500 })
    }
  })
}

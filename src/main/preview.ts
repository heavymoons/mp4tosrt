import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import type { Pipeline } from './pipeline'

export const VIDEO_SCHEME = 'mp4tosrt-video'

/**
 * mp4tosrt-video://job/<jobId> 形式の URL を受け取り、ジョブの inputPath
 * を file:// 経由でストリーミング配信する。レンダラに直接 file パスを
 * 渡さないことで、任意のローカルファイル参照を防ぐ。
 */
export function registerVideoProtocol(pipeline: Pipeline): void {
  protocol.handle(VIDEO_SCHEME, async request => {
    try {
      const url = new URL(request.url)
      // pathname は "/<jobId>"
      const jobId = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!jobId) {
        return new Response('jobId required', { status: 400 })
      }
      const job = pipeline.getJob(jobId)
      if (!job) {
        return new Response(`job ${jobId} not found`, { status: 404 })
      }
      const fileUrl = pathToFileURL(job.inputPath).toString()
      return await net.fetch(fileUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return new Response(msg, { status: 500 })
    }
  })
}

import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { basename, extname } from 'path'
import { pathToFileURL } from 'url'
import { createHash } from 'crypto'
import { parseSrt, type SrtCue } from './srt'

type ProbeResult = {
  durationSec: number
  startTimeSec: number
  width: number
  height: number
  fpsNum: number
  fpsDen: number
  audioChannels: number
  audioSampleRate: number
  // Source timecode の総フレーム数 (TC fps = round(fpsNum/fpsDen) 基準)。
  // ffprobe の tmcd トラック (stream_tags=timecode) 由来。
  // FCPX が asset.start として期待する値と一致させる必要がある。
  sourceTcFrames: number
}

function runFfprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', args)
    let out = ''
    p.stdout.on('data', d => { out += d.toString() })
    p.on('error', reject)
    p.on('close', code => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`))
        return
      }
      resolve(out)
    })
  })
}

function parseTimecodeToFrames(tc: string, tcFps: number): number {
  // HH:MM:SS:FF (NDF) または HH:MM:SS;FF (DF)。
  // DJI 含む大半のカメラは NDF 出力なので DF 補正は省略 (FCPX もそう扱う)。
  const m = tc.match(/^(\d+):(\d+):(\d+)[:;](\d+)$/)
  if (!m) return 0
  const hh = parseInt(m[1]!, 10)
  const mm = parseInt(m[2]!, 10)
  const ss = parseInt(m[3]!, 10)
  const ff = parseInt(m[4]!, 10)
  return hh * 3600 * tcFps + mm * 60 * tcFps + ss * tcFps + ff
}

async function ffprobe(videoPath: string): Promise<ProbeResult> {
  const videoArgs = [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,duration,start_time:format=duration',
    '-of', 'default=nw=1',
    videoPath
  ]
  const audioArgs = [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=channels,sample_rate',
    '-of', 'default=nw=1',
    videoPath
  ]
  // 全ストリーム + format からタイムコードを探す (DJI は data ストリームの tmcd に入る)。
  const tcArgs = [
    '-v', 'error',
    '-show_entries', 'stream_tags=timecode:format_tags=timecode',
    '-of', 'default=nw=1',
    videoPath
  ]
  const [videoOut, audioOut, tcOut] = await Promise.all([
    runFfprobe(videoArgs),
    runFfprobe(audioArgs).catch(() => ''),
    runFfprobe(tcArgs).catch(() => '')
  ])

  let width = 1920
  let height = 1080
  let fpsNum = 30000
  let fpsDen = 1001
  let duration = 0
  let formatDuration = 0
  let startTime = 0
  for (const line of videoOut.split('\n')) {
    const m = line.match(/^([\w_]+)=(.+)$/)
    if (!m) continue
    const k = m[1]!
    const v = m[2]!.trim()
    if (k === 'width') width = parseInt(v, 10) || width
    if (k === 'height') height = parseInt(v, 10) || height
    if (k === 'duration') {
      const d = parseFloat(v)
      if (Number.isFinite(d)) duration = d
    }
    if (k === 'start_time') {
      const st = parseFloat(v)
      if (Number.isFinite(st) && st > 0) startTime = st
    }
    if (k === 'r_frame_rate') {
      const [num, den] = v.split('/').map(s => parseInt(s, 10))
      if (num && den) {
        fpsNum = num
        fpsDen = den
      }
    }
  }
  const fdMatch = videoOut.match(/^duration=([\d.]+)$/m)
  if (fdMatch) {
    const fd = parseFloat(fdMatch[1]!)
    if (Number.isFinite(fd) && fd > duration) formatDuration = fd
  }

  let audioChannels = 2
  let audioSampleRate = 48000
  for (const line of audioOut.split('\n')) {
    const m = line.match(/^([\w_]+)=(.+)$/)
    if (!m) continue
    const k = m[1]!
    const v = m[2]!.trim()
    if (k === 'channels') audioChannels = parseInt(v, 10) || audioChannels
    if (k === 'sample_rate') audioSampleRate = parseInt(v, 10) || audioSampleRate
  }

  // tmcd / format の timecode タグから最初の有効な値を拾う。
  let timecode = ''
  for (const line of tcOut.split('\n')) {
    const m = line.match(/^(?:TAG:)?timecode=(.+)$/)
    if (m) {
      const v = m[1]!.trim()
      if (v) { timecode = v; break }
    }
  }
  const tcFps = Math.max(1, Math.round(fpsNum / Math.max(1, fpsDen)))
  const sourceTcFrames = timecode ? parseTimecodeToFrames(timecode, tcFps) : 0

  return {
    durationSec: formatDuration || duration,
    startTimeSec: startTime,
    width,
    height,
    fpsNum,
    fpsDen,
    audioChannels,
    audioSampleRate,
    sourceTcFrames
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function srtTimeToSeconds(t: string): number {
  const m = t.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/)
  if (!m) return 0
  return (
    parseInt(m[1]!, 10) * 3600 +
    parseInt(m[2]!, 10) * 60 +
    parseInt(m[3]!, 10) +
    parseInt(m[4]!, 10) / 1000
  )
}

// FCPXML times must be rational and ideally aligned to the video's frame
// duration. Express as `(frames * fpsDen) / fpsNum s`.
function secondsToFcpTime(seconds: number, fpsNum: number, fpsDen: number): string {
  if (seconds <= 0) return '0s'
  const frames = Math.round((seconds * fpsNum) / fpsDen)
  if (frames === 0) return '0s'
  return `${frames * fpsDen}/${fpsNum}s`
}

function buildCaption(
  cue: SrtCue,
  index: number,
  fpsNum: number,
  fpsDen: number,
  sourceStartSec: number
): string {
  const cueStart = srtTimeToSeconds(cue.start)
  const cueEnd = srtTimeToSeconds(cue.end)
  const minDur = fpsDen / fpsNum
  const dur = Math.max(cueEnd - cueStart, minDur)
  const text = escapeXml(cue.text.replace(/\s*\n\s*/g, ' ').trim())
  if (!text) return ''
  const styleId = `ts${index}`
  // caption.offset は親 (asset-clip) のローカル時間 = asset-clip.start からの相対ではなく、
  // FCPX のキャプションでは asset の source TC 上の絶対位置で表現する (FCPX export 観察結果)。
  const offsetInSource = sourceStartSec + cueStart
  const captionName = text.length > 50 ? text.slice(0, 50) : text
  return `              <caption lane="1" offset="${secondsToFcpTime(offsetInSource, fpsNum, fpsDen)}" name="${captionName}" start="3600s" duration="${secondsToFcpTime(dur, fpsNum, fpsDen)}" role="SRT?captionFormat=SRT.ja">
                <text placement="bottom">
                  <text-style ref="${styleId}">${text}</text-style>
                </text>
                <text-style-def id="${styleId}">
                  <text-style font=".AppleSystemUIFont" fontSize="13" fontFace="Regular" fontColor="1 1 1 1" backgroundColor="0 0 0 1"/>
                </text-style-def>
              </caption>
`
}

export async function generateFcpxml(
  videoPath: string,
  srtPath: string,
  outputPath: string,
  log: (s: string) => void
): Promise<void> {
  log('[fcpxml] probing video metadata')
  const probe = await ffprobe(videoPath)
  log(
    `[fcpxml] video: ${probe.width}x${probe.height}, ` +
      `${probe.fpsNum}/${probe.fpsDen}fps, ${probe.durationSec.toFixed(2)}s, ` +
      `start_time=${probe.startTimeSec.toFixed(3)}s, ` +
      `audio=${probe.audioChannels}ch ${probe.audioSampleRate}Hz, ` +
      `sourceTcFrames=${probe.sourceTcFrames}`
  )

  log('[fcpxml] reading SRT')
  const srtText = await fs.readFile(srtPath, 'utf-8')
  const cues = parseSrt(srtText)

  const videoUrl = pathToFileURL(videoPath).toString()
  const videoName = basename(videoPath, extname(videoPath))
  const frameDuration = `${probe.fpsDen}/${probe.fpsNum}s`
  const totalDur = secondsToFcpTime(probe.durationSec, probe.fpsNum, probe.fpsDen)
  // FCPX が <asset> と実ファイルを結びつけるのに必要な 16 バイト hex ID。
  // ファイルパスから決定論的に生成（同じファイルなら毎回同じ値）。
  const uid = createHash('md5').update(videoPath).digest('hex').toUpperCase()
  // sequence/@audioRate は enum (32k / 44.1k / 48k / 88.2k / 96k / 176.4k / 192k)。
  // asset/@audioRate は整数 (48000 等) なので分けて出力する。
  const seqAudioRate = (() => {
    const rate = probe.audioSampleRate
    const map: Record<number, string> = {
      32000: '32k',
      44100: '44.1k',
      48000: '48k',
      88200: '88.2k',
      96000: '96k',
      176400: '176.4k',
      192000: '192k'
    }
    return map[rate] ?? '48k'
  })()

  // source TC: DJI 等の tmcd トラックの値。FCPX はファイルから直接読むので、
  // XML 側もこの値を asset.start / asset-clip.start に使わないと
  // 「対応するメディアがない」と判定される。tmcd が無いファイルは 0 になる。
  const sourceStart = probe.sourceTcFrames > 0
    ? `${probe.sourceTcFrames * probe.fpsDen}/${probe.fpsNum}s`
    : '0s'
  const sourceStartSec = (probe.sourceTcFrames * probe.fpsDen) / probe.fpsNum

  let captionsXml = ''
  let i = 0
  for (const cue of cues) {
    const c = buildCaption(cue, ++i, probe.fpsNum, probe.fpsDen, sourceStartSec)
    if (c) captionsXml += c
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1" frameDuration="${frameDuration}" width="${probe.width}" height="${probe.height}" colorSpace="1-1-1 (Rec. 709)"/>
    <asset id="r2" name="${escapeXml(videoName)}" uid="${uid}" start="${sourceStart}" duration="${totalDur}" hasVideo="1" format="r1" hasAudio="1" videoSources="1" audioSources="1" audioChannels="${probe.audioChannels}" audioRate="${probe.audioSampleRate}">
      <media-rep kind="original-media" sig="${uid}" src="${escapeXml(videoUrl)}"/>
    </asset>
  </resources>
  <library>
    <event name="mp4tosrt">
      <project name="${escapeXml(videoName)}">
        <sequence format="r1" duration="${totalDur}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="${seqAudioRate}">
          <spine>
            <asset-clip ref="r2" offset="0s" name="${escapeXml(videoName)}" start="${sourceStart}" duration="${totalDur}" tcFormat="NDF" audioRole="dialogue">
${captionsXml}            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`

  await fs.writeFile(outputPath, xml, 'utf-8')
  log(`[fcpxml] wrote ${cues.length} captions to ${outputPath}`)
}

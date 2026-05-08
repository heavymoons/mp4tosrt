# mp4tosrt

A macOS app (Apple Silicon only) that generates **SRT subtitles** from video files automatically.

It combines `ffmpeg` and `mlx-whisper` (a Whisper implementation optimized for Apple Silicon), runs multiple files in parallel, optionally corrects Japanese transcription errors with a local LLM, and can mux subtitles back into MP4 without re-encoding. Useful for video editors drafting on-screen captions and YouTubers preparing subtitle uploads.

> 🇯🇵 日本語版の詳細は [README.md](README.md) を参照してください（用語辞書のテンプレート、ハルシネーション抑制パターン、LLM 校正のチューニング指針などフル収録）。

## Features

### Transcription
- Video → SRT subtitle generation (multilingual Whisper speech recognition)
- Parallel processing of multiple files (separate concurrency knobs for ffmpeg and mlx-whisper)
- Audio filter chain (loudness normalization, highpass, denoise, etc.)
- Tunable Whisper parameters (no-speech / logprob thresholds via GUI sliders)

### Correction
- Term-dictionary substitution (proper-noun rewrites, maintained as a `.txt` file)
- Local LLM correction (privacy-preserving, runs entirely on Apple Silicon)
- Shared prompt + per-job extra prompt (passes context to the LLM)
- Term dictionary can also be injected into the LLM prompt

### Output / Rerun
- Embed subtitles into MP4 (`.subbed.mp4` next to the source, no re-encode)
- Final Cut Pro `.fcpxml` output (video + caption bundle that follows clip moves)
- Rerun **only** the LLM correction step (try different prompts, no Whisper redo)
- Rerun **only** the MP4 embed step (hand-edit `.corrected.srt` then re-embed)

### UX
- Jobs persist across app restarts (queued / awaiting-prompt jobs are restored)
- All settings auto-save and restore
- Live log per job
- In-app manual (this document, openable from the top-right button)

## Requirements

| | Required | Recommended |
|---|---|---|
| CPU | Apple Silicon (M1 / M2 / M3 / M4) | M2 Pro or later |
| macOS | 13 (Ventura)+ | 14 (Sonoma)+ |
| RAM | 8 GB | **16 GB+** (effectively required if using LLM correction) |
| Free storage | 5 GB | 10–15 GB (20 GB if you want to try multiple models) |
| Network | Initial model download (a few GB) | — |

⚠️ **Intel Mac / Linux / Windows are not supported** (mlx-whisper is Apple-Silicon-only).

## Install

### 1. Download the app

Get the latest `mp4tosrt-x.x.x-arm64.dmg` from [GitHub Releases](https://github.com/heavymoons/mp4tosrt/releases). Double-click the `.dmg` and drag `mp4tosrt.app` into **Applications**.

### 2. Strip the quarantine attribute (one-time, since the app is unsigned)

```sh
xattr -dr com.apple.quarantine /Applications/mp4tosrt.app
```

Otherwise macOS will refuse to launch the app with "the developer cannot be verified".

### 3. Install the dependencies

```sh
# Homebrew (skip if you already have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# ffmpeg
brew install ffmpeg

# mlx-whisper (via pipx so it gets its own Python venv)
brew install pipx
pipx ensurepath
pipx install mlx-whisper
```

Restart your terminal after `pipx ensurepath` so the updated `PATH` takes effect. Then launch mp4tosrt — the **Environment check** panel at the top must be green before you can drop files.

## Basic usage

1. Pick an output folder (or leave it empty — it'll prompt the first time you add a file).
2. Drag video files into the drop zone (or use **Choose files…**).
3. Each file becomes a job. Wait for it to finish; the SRT is written next to the video by default name `<video>.srt`.

### Per-job actions

| Button | Effect |
|---|---|
| **Preview** | Inline video player (handy when reviewing transcribed cues) |
| **Show original** / **Show SRT** | Reveal the file in Finder |
| **Embed subtitles into MP4** | Re-embed `.corrected.srt` (or `.srt`) into a `.subbed.mp4` without touching the original |
| **+ Extra prompt** | Per-job prompt appended to the LLM correction system prompt |
| **Log** / **Full log** | Live tail (UI) or full log file |
| **Rerun LLM correction** | Re-run the correction step with the current prompt; Whisper output is reused |

## Settings (essentials)

| Setting | Notes |
|---|---|
| Output folder | Where SRTs are written |
| Also output `.subbed.mp4` | Embeds subtitles into a copy of the video (no re-encode) |
| Also output `.fcpxml` | Final Cut Pro project bundle (video + captions as one clip) |
| Whisper model | Default is `whisper-large-v3-turbo` (balanced). For Japanese-heavy content try `kaiinui/kotoba-whisper-v2.0-mlx` |
| Language | Auto-detect by default; set explicitly if you know the language |
| ffmpeg / mlx-whisper concurrency | Increase carefully — mlx-whisper is GPU-memory hungry |

Advanced settings (audio filters, no-speech / logprob thresholds, hallucination suppression, term dictionary, LLM correction config) are tucked behind **Show advanced…**.

## LLM correction (optional)

Local Japanese correction with Qwen3.5 (4B / 9B) via [node-llama-cpp]. Setup:

1. Open **Show advanced…** → scroll to **Post-processing — LLM correction**.
2. Tick **Enable LLM correction** and pick a model preset.
3. Click **Download** (~2.5 GB for 4B Q4, ~5.5 GB for 9B Q4). Models live under `~/Library/Application Support/mp4tosrt/models/`.
4. Provide a **Shared prompt** (context for all jobs) and per-job **Extra prompt** (about the specific video).
5. The corrected output is saved as `<video>.corrected.srt`.

The LLM correction is best-effort. For mission-critical subtitles, treat its output as a draft and review it.

## Output files

For an input `interview.mp4`:

| File | When |
|---|---|
| `interview.srt` | Always |
| `interview.corrected.srt` | If LLM correction is enabled |
| `interview.subbed.mp4` | If "Also output .subbed.mp4" is on (uses the corrected SRT when available) |
| `interview.fcpxml` | If "Also output .fcpxml" is on. Drag-and-drop into FCPX as a video+captions bundle |

The original video is never modified.

## Tips

1. Use `kaiinui/kotoba-whisper-v2.0-mlx` for Japanese (large-v3 base, beats vanilla on Japanese benchmarks).
2. If volumes vary wildly between speakers, enable the **Compressor** filter.
3. Repeating mistranscriptions of the same word? Add it to the **term dictionary**.
4. Long recordings with cascading errors? Disable **Use previous cues as context**.
5. Hallucinated phrases like "Thanks for watching" in silent regions are caught by **Hallucination suppression** (on by default).

## License

MIT.

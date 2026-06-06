# mp4tosrt

Transcribe MP4 videos in **Japanese and many other languages**, auto-correct the output with a **term dictionary and AI prompts (a local LLM)**, then export to **SRT subtitles / subtitled MP4 / Final Cut Pro `.fcpxml`** — all from a single drag-and-drop. **Completely free**. **Apple Silicon Mac only.**

> 🇯🇵 日本語版の詳細は [README.md](README.md) を参照してください（用語辞書のテンプレート、ハルシネーション抑制パターン、LLM 校正のチューニング指針などフル収録）。

Internally it combines `ffmpeg` with **VibeVoice-ASR** (Microsoft, via mlx-audio) or `mlx-whisper` (a Whisper implementation optimized for Apple Silicon), runs multiple files in parallel, corrects transcription errors with a local LLM (on by default), and can mux subtitles back into MP4 without re-encoding. Useful for video editors drafting on-screen captions and YouTubers preparing subtitle uploads.

## Features

### Transcription
- Video → SRT subtitle generation (VibeVoice-ASR or mlx-whisper, multilingual)
- Parallel processing of multiple files (separate concurrency knobs for ffmpeg and the transcription engine)
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
| RAM | 8 GB | **16 GB+** (required for the default Gemma 4 12B LLM correction) |
| Free storage | 5 GB | 15–20 GB (LLM model + Whisper models) |
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
```

Install the transcription engine that matches your chosen setting:

**VibeVoice-ASR (new default, via mlx-audio):**

```sh
brew install pipx
pipx ensurepath
pipx install mlx-audio
```

**mlx-whisper (fallback / stable):**

```sh
brew install pipx
pipx ensurepath
pipx install mlx-whisper
```

> `brew install pipx` and `pipx ensurepath` are only needed once — skip them if already done.

Restart your terminal after `pipx ensurepath` so the updated `PATH` takes effect. Then launch mp4tosrt — the **Environment check** panel at the top confirms that `ffmpeg` and your chosen engine (`mlx_audio` or `mlx_whisper`) are both green before you can drop files.

## Basic usage

1. Pick an output folder (or leave it empty — it'll prompt the first time you add a file).
2. Drag video files into the drop zone (or use **Choose files…**).
3. Each job progresses through: **Converting audio → Transcribing → LLM correction → Done**.

   > **First run only:** the default Gemma 4 12B model (~7.3 GB) is downloaded automatically. This may take several minutes to tens of minutes depending on your connection.

4. When done, the SRT (and `.corrected.srt`) appear in the output folder.

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
| Transcription engine | **VibeVoice-ASR** (default) or **mlx-whisper** (stable fallback). See below. |
| Whisper model | When using mlx-whisper. Default is `whisper-large-v3-turbo` (balanced). For Japanese try `kaiinui/kotoba-whisper-v2.0-mlx` |
| Language | Auto-detect by default; set explicitly if you know the language |
| ffmpeg / transcription concurrency | Increase carefully — the transcription engine is GPU-memory hungry |

Advanced settings (audio filters, no-speech / logprob thresholds, hallucination suppression, term dictionary, LLM correction config) are tucked behind **Show advanced…**.

### Transcription engine: VibeVoice-ASR vs mlx-whisper

| Engine | Role | Notes |
|---|---|---|
| **VibeVoice-ASR** (default) | Latest / highest accuracy | Microsoft model via mlx-audio. Speaker diarisation and timestamps. Dramatically better quality in the author's own testing. |
| **mlx-whisper** (fallback) | Stable | The original engine. Mature and reliable. |

> ⚠️ **VibeVoice-ASR is a cutting-edge stack and may break with future updates.** Switch to mlx-whisper if you need guaranteed stability.

#### VibeVoice-ASR: first-run model download

On first use, the model is downloaded automatically from Hugging Face. A progress bar is shown in the app. You can also trigger the download in advance from the settings screen.

| Quantisation | Size | Notes |
|---|---|---|
| 4-bit (default) | ~5.7 GB | Best speed/quality balance |
| bf16 | ~16.7 GB | Full precision |

Download takes several minutes depending on your connection speed.

#### VibeVoice-ASR: 59-minute limit

⚠️ **VibeVoice-ASR processes at most 59 minutes of audio.** Any audio beyond that is silently truncated (a warning is displayed). Split videos longer than 60 minutes before dropping them.

## LLM correction (on by default)

Local correction via [node-llama-cpp] — **enabled by default**. No extra installation required; the library is bundled in the app.

**Default model:** Gemma 4 12B Q4_K_M (~7.3 GB, 16 GB+ RAM recommended). The model is downloaded automatically on the first job run. Subsequent runs reuse the cached model.

**Stable fallback:** Qwen3.5 (4B Q4 ≈ 2.5 GB, 9B Q4 ≈ 5.5 GB). Switch in **Show advanced…** → **Post-processing — LLM correction** if you prefer a smaller or more proven option.

**To disable LLM correction:** uncheck **Enable LLM correction** in the same settings section.

Other options in that section:
- **Shared prompt** — context passed to the LLM for every job (e.g. channel name, recurring terminology).
- **Extra prompt** (per-job button) — video-specific context. By default, jobs run LLM correction automatically even without an extra prompt (`requirePrompt` is off).
- **Inject term dictionary into LLM prompt** — adds your substitution rules to the LLM's system prompt for context-aware correction.
- The corrected output is saved as `<video>.corrected.srt`; the original `.srt` is never modified.

> ⚠️ **Gemma 4 is a cutting-edge model and may behave differently after updates.** Use Qwen3.5 if you prefer a stable, proven option.

The LLM correction is best-effort. For mission-critical subtitles, treat its output as a draft and review it.

## Output files

For an input `interview.mp4`:

| File | When |
|---|---|
| `interview.srt` | Always |
| `interview.corrected.srt` | If LLM correction is enabled (**on by default**; disable in settings if unwanted) |
| `interview.subbed.mp4` | If "Also output .subbed.mp4" is on (uses the corrected SRT when available) |
| `interview.fcpxml` | If "Also output .fcpxml" is on. Drag-and-drop into FCPX as a video+captions bundle |

The original video is never modified.

## Tips

1. **Use VibeVoice-ASR** (default) for best accuracy — the author's testing showed dramatically better results than mlx-whisper.
2. With mlx-whisper, use `kaiinui/kotoba-whisper-v2.0-mlx` for Japanese (large-v3 base, beats the vanilla model on Japanese benchmarks).
3. **LLM correction is on by default** — `.corrected.srt` is generated automatically after each job. The first job triggers an automatic ~7.3 GB model download; be patient. To skip LLM correction, turn it off in settings.
4. If volumes vary wildly between speakers, enable the **Compressor** filter.
5. Repeating mistranscriptions of the same word? Add it to the **term dictionary**.
6. Long recordings with cascading errors? Disable **Use previous cues as context**.
7. Hallucinated phrases like "Thanks for watching" in silent regions are caught by **Hallucination suppression** (on by default).

## Troubleshooting

### `mlx_audio` shows "not installed"

Run `pipx install mlx-audio`, restart your terminal (or run `pipx ensurepath`), then restart the app. The app looks for the command in:

- `/opt/homebrew/bin`
- `/usr/local/bin`
- `~/.local/bin`
- `~/Library/Python/3.11/bin` through `3.13/bin`

### `mlx_whisper` shows "not installed"

Same as above but for `pipx install mlx-whisper`.

## License

MIT.

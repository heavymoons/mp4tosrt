# INSTALL — mp4tosrt (Apple Silicon Mac)

> 日本語: [INSTALL.md](INSTALL.md)

mp4tosrt ships as a packaged app (`.dmg`). You don't build it yourself — just install the
**external tools it calls (ffmpeg and a transcription engine)**, then launch the app.

## 0. Prerequisites

- **Apple Silicon (arm64) / macOS 13+**. Intel Macs are not supported.
- **~15 GB free disk** recommended for the first-run model downloads (VibeVoice ~5.7 GB + Gemma 4 ~7.3 GB).

## 1. Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the printed instructions to add brew to your PATH (Apple Silicon: `/opt/homebrew/bin`).

## 2. ffmpeg

```bash
brew install ffmpeg
```

## 3. Transcription engine (pipx + mlx-audio)

The default engine, **VibeVoice-ASR**, needs `mlx-audio` (installed into its own pipx venv).

```bash
brew install pipx
pipx ensurepath
# then close and reopen the terminal (so the PATH update takes effect)
pipx install mlx-audio

# if you also want the fallback engine mlx-whisper:
pipx install mlx-whisper
```

## 4. The app (download from GitHub → copy to Applications → allow it)

1. Download the latest `.dmg` from [Releases](https://github.com/heavymoons/mp4tosrt/releases).
2. Open the `.dmg` and **copy `mp4tosrt` into your Applications folder**.
3. **Allow it (important)**: the build is ad-hoc signed, so Gatekeeper blocks it the first time. Use one of:
   - **right-click `mp4tosrt.app` → Open** → confirm "Open" in the dialog
   - if that fails, **System Settings → Privacy & Security → "Open Anyway"**
   - or run `xattr -dr com.apple.quarantine /Applications/mp4tosrt.app` in Terminal, then launch

   Once allowed, it opens normally afterwards.

## 5. First run

- In the app's **Environment check** panel at the top, `ffmpeg` and `mlx_audio` must be green (if red, re-check the install steps / reopen your terminal).
- The first transcription **auto-downloads the VibeVoice model (~5.7 GB)** from Hugging Face (a few minutes, with progress). Because LLM correction is on by default, **Gemma 4 (~7.3 GB) also downloads on first use**. You can also pre-download from Settings.
- VibeVoice caps audio at **59 min** (excess is truncated).

## Lighter setup (stable fallback stack)

VibeVoice-ASR / Gemma 4 are high-quality but a bleeding-edge, still-unstable stack. If you prefer stability, switch to the **mlx-whisper + Qwen** fallback:

- In step 3, also `pipx install mlx-whisper`
- In Settings, switch the engine to `mlx-whisper` and the LLM to `Qwen` (or turn LLM correction off)

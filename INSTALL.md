# INSTALL — mp4tosrt のインストール（Apple Silicon Mac）

> English: [INSTALL.en.md](INSTALL.en.md)

mp4tosrt はパッケージ配布（`.dmg`）です。アプリ自体のビルドは不要で、アプリが内部から
呼び出す**外部ツール（ffmpeg と文字起こしエンジン）**を入れてからアプリを起動するだけです。

## 0. 前提

- **Apple Silicon (arm64) / macOS 13 以降**。Intel Mac は非対応。
- モデルの初回ダウンロードに **15GB 以上**の空きを推奨（VibeVoice 約5.7GB + Gemma 4 約7.3GB）。

## 1. Homebrew（未導入なら）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

表示される指示に従って PATH を通す（Apple Silicon は `/opt/homebrew/bin`）。

## 2. ffmpeg

```bash
brew install ffmpeg
```

## 3. 文字起こしエンジン（pipx + mlx-audio）

既定エンジンの **VibeVoice-ASR** には `mlx-audio` が必要。pipx で専用の Python venv に入れる。

```bash
brew install pipx
pipx ensurepath
# ↑この後ターミナルを一度閉じて開き直す（PATH 反映のため）
pipx install mlx-audio

# 予備エンジンの mlx-whisper も使うなら:
pipx install mlx-whisper
```

## 4. アプリ本体（GitHub からDL → Applications へコピー → 権限設定）

1. [Releases](https://github.com/heavymoons/mp4tosrt/releases) から最新の `.dmg`（または `.zip`）をダウンロード。
2. `.dmg` を開いて `mp4tosrt` を **Applications フォルダにコピー（ドラッグ）**。`.zip` の場合は展開して `mp4tosrt.app` を Applications にコピー。
3. **権限設定（重要）**: ad-hoc 署名のため初回は Gatekeeper にブロックされる。次のいずれかで許可する:
   - `mp4tosrt.app` を **右クリック →「開く」** → 確認ダイアログで「開く」
   - 開けない場合は **システム設定 → プライバシーとセキュリティ →「このまま開く」**
   - またはターミナルで `xattr -dr com.apple.quarantine /Applications/mp4tosrt.app` を実行してから起動

   一度許可すれば、次回以降は通常どおり起動できる。

## 5. 初回起動

- アプリ上部の **「環境チェック」** で `ffmpeg` と `mlx_audio` が緑になっていること（赤ならインストール手順を見直す／ターミナル再起動）。
- 最初の書き起こしで **VibeVoice モデル（約5.7GB）が Hugging Face から自動ダウンロード**される（数分・進捗表示）。LLM 校正が既定 ON のため **Gemma 4（約7.3GB）も初回に自動ダウンロード**される。設定画面から事前ダウンロードも可能。
- VibeVoice は**音声 59 分が上限**（超過分は切り捨て）。

## 軽く済ませたい場合（安定版・予備スタック）

VibeVoice-ASR / Gemma 4 は高性能だが最新・不安定なスタック。安定重視なら予備の **mlx-whisper + Qwen** に切り替えられる。

- 手順3で `pipx install mlx-whisper` も入れる
- アプリ設定でエンジンを `mlx-whisper`、LLM を `Qwen`（または LLM 校正 OFF）に切り替える

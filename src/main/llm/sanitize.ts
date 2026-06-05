// Gemma 4 出力の整形ユーティリティ。
// Electron / app に依存しない純粋モジュール（単体テスト可能にするため、ここに electron 等を import しない）。

// Gemma 4 (gilad/gemma4 ブランチ + llama.cpp b9524) の出力は、本文の前に
// 思考チャネル `<|channel>thought ... <channel|>` が付与されることがある。
// その思考ブロックだけを限定的に剥がす。本文中に偶然 `<channel|>` 類似が
// 現れても誤って削らないよう、「先頭が thought channel のときだけ」処理する。

const THOUGHT_OPEN = '<|channel>thought'
const CHANNEL_CLOSE = '<channel|>'

/**
 * 出力が（先頭空白を除き）thought channel で始まる場合のみ、最初の
 * `<channel|>` までを除去して trim する。それ以外は本文をそのまま返す。
 */
export function sanitizeGemma4Output(text: string): string {
  // 先頭の空白だけを飛ばして判定する（leading whitespace は無視）。
  const leadingWsMatch = /^\s*/.exec(text)
  const start = leadingWsMatch ? leadingWsMatch[0].length : 0

  if (!text.startsWith(THOUGHT_OPEN, start)) {
    // 先頭が thought channel でない通常出力。本文を壊さないため無加工で返す。
    return text
  }

  const closeIdx = text.indexOf(CHANNEL_CLOSE, start)
  if (closeIdx === -1) {
    // thought で始まるのに閉じタグが無い壊れた出力。安全側として無加工で返す。
    return text
  }

  return text.slice(closeIdx + CHANNEL_CLOSE.length).trim()
}

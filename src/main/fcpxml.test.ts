import { describe, it, expect } from 'vitest'
import { resolveMaxCharsPerLine, wrapText, charWidth, strWidth } from './fcpxml'
import type { FcpxmlSubtitleStyle } from '../shared/types'

// wrapText / charWidth / strWidth は本体 (fcpxml.ts) から直接 import してテストする。
// （以前はテスト用に複製していたが、本体とロジックが乖離してバグを見逃すため廃止）

describe('charWidth / strWidth', () => {
  it('半角文字は 0.5', () => {
    expect(charWidth('a')).toBe(0.5)
    expect(charWidth(' ')).toBe(0.5)
    expect(charWidth('~')).toBe(0.5)
  })

  it('全角文字は 1', () => {
    expect(charWidth('あ')).toBe(1)
    expect(charWidth('漢')).toBe(1)
    expect(charWidth('！')).toBe(1) // 全角感嘆符
  })

  it('strWidth の合計', () => {
    // 'abc' = 0.5*3 = 1.5
    expect(strWidth('abc')).toBe(1.5)
    // 'あいう' = 1*3 = 3
    expect(strWidth('あいう')).toBe(3)
    // 'あbc' = 1 + 0.5 + 0.5 = 2
    expect(strWidth('あbc')).toBe(2)
  })
})

describe('wrapText', () => {
  it('maxPerLine <= 0 ならそのまま返す', () => {
    const s = 'あいうえおかきくけこ'
    expect(wrapText(s, 0)).toBe(s)
    expect(wrapText(s, -1)).toBe(s)
  })

  it('幅がしきい値以内ならそのまま返す', () => {
    const s = 'あいう' // 幅3
    expect(wrapText(s, 24)).toBe(s)
  })

  it('句読点で分割される（全角24文字で折り返し）', () => {
    const s = 'あいうえおかきくけこさし、たちつてとなにぬねのは。'
    const result = wrapText(s, 24)
    expect(result).toContain('\n')
    for (const line of result.split('\n')) {
      expect(strWidth(line)).toBeLessThanOrEqual(24)
    }
  })

  it('句読点無し長文はハード改行される', () => {
    const s = 'あいうえおかきくけこさしたちつてとなにぬねのはひふへほまみ' // 30文字
    const result = wrapText(s, 24)
    expect(result).toContain('\n')
    const lines = result.split('\n')
    for (const line of lines) {
      expect(strWidth(line)).toBeLessThanOrEqual(24)
    }
    // 元のテキストが結合されて復元できる（スペースなし日本語）
    expect(lines.join('')).toBe(s)
  })

  it('半角スペース区切りの英語語句が折り返される', () => {
    const s = 'abcdef ghijkl mnopqr stuvwx'
    const result = wrapText(s, 10)
    expect(result).toContain('\n')
    for (const line of result.split('\n')) {
      expect(strWidth(line)).toBeLessThanOrEqual(10)
      // 行頭・行末にスペースは残らない
      expect(line).not.toMatch(/^ | $/)
    }
  })

  it('単語間の半角スペースは保持される（Hello world を結合しない）', () => {
    // 1行に収まる場合はスペースがそのまま残る
    expect(wrapText('Hello world', 24)).toBe('Hello world')
    // 折り返しても各行内の語間スペースは保持される
    const r = wrapText('alpha bravo charlie delta echo', 12)
    expect(r.split('\n')[0]).toBe('alpha bravo charlie')
    expect(r).toContain(' ')
  })

  it('空文字はそのまま返す', () => {
    expect(wrapText('', 24)).toBe('')
  })

  it('幅がしきい値以内の日本語はそのまま（改行なし）', () => {
    const s = 'あいうえおかきくけこさしたちつてとなにぬねのは' // 23文字（幅23 ≤ 24）
    expect(wrapText(s, 24)).toBe(s)
  })

  it('3行以上の折り返しが許容される（行数上限なし）', () => {
    const s = 'あいうえおかきくけこさし、たちつてとなにぬねの、はひふへほまみむめも。'
    const result = wrapText(s, 14)
    const lines = result.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    for (const line of lines) {
      expect(strWidth(line)).toBeLessThanOrEqual(14)
    }
  })
})

// テスト用ベーススタイル (wrapAutoFit=true のデフォルト)
function makeStyle(overrides: Partial<FcpxmlSubtitleStyle> = {}): FcpxmlSubtitleStyle {
  return {
    mode: 'title',
    alignment: 'center',
    verticalAnchor: 'bottom',
    font: '.AppleSystemUIFont',
    fontSize: 60,
    maxCharsPerLine: 24,
    wrapAutoFit: true,
    wrapAutoFitRatio: 0.9,
    ...overrides
  }
}

describe('resolveMaxCharsPerLine', () => {
  it('wrapAutoFit=true: floor(1920/60*0.9) = 28', () => {
    const style = makeStyle({ fontSize: 60, wrapAutoFitRatio: 0.9 })
    expect(resolveMaxCharsPerLine(1920, 60, style)).toBe(28)
  })

  it('wrapAutoFit=true: フォントサイズが大きいほど文字数が減る', () => {
    const style60 = makeStyle({ fontSize: 60, wrapAutoFitRatio: 0.9 })
    const style120 = makeStyle({ fontSize: 120, wrapAutoFitRatio: 0.9 })
    const chars60 = resolveMaxCharsPerLine(1920, 60, style60)
    const chars120 = resolveMaxCharsPerLine(1920, 120, style120)
    expect(chars120).toBeLessThan(chars60)
    // floor(1920/120*0.9) = floor(14.4) = 14
    expect(chars120).toBe(14)
  })

  it('wrapAutoFit=false: maxCharsPerLine をそのまま返す', () => {
    const style = makeStyle({ wrapAutoFit: false, maxCharsPerLine: 30 })
    expect(resolveMaxCharsPerLine(1920, 60, style)).toBe(30)
  })

  it('wrapAutoFit=false: maxCharsPerLine=0 はそのまま 0 (折返し無効)', () => {
    const style = makeStyle({ wrapAutoFit: false, maxCharsPerLine: 0 })
    expect(resolveMaxCharsPerLine(1920, 60, style)).toBe(0)
  })

  it('極小フォントサイズでも最低 1 を返す (fontSize=0 ガード)', () => {
    const style = makeStyle({ wrapAutoFitRatio: 0.9 })
    expect(resolveMaxCharsPerLine(1920, 0, style)).toBeGreaterThanOrEqual(1)
  })

  it('動画幅が極小でも最低 1 を返す', () => {
    const style = makeStyle({ fontSize: 9999, wrapAutoFitRatio: 0.9 })
    expect(resolveMaxCharsPerLine(1, 9999, style)).toBe(1)
  })
})

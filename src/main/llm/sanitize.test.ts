import { describe, it, expect } from 'vitest'
import { sanitizeGemma4Output } from './sanitize'

describe('sanitizeGemma4Output', () => {
  it('(a) 先頭の thought channel を除去して本文だけ返す', () => {
    const input = '<|channel>thought\n（考え中…）\n<channel|>[1] 本文'
    expect(sanitizeGemma4Output(input)).toBe('[1] 本文')
  })

  it('(b) thinking が無い通常出力は無変更', () => {
    const input = '[1] 本文\n[2] 次'
    expect(sanitizeGemma4Output(input)).toBe(input)
  })

  it('(c) 本文中に <channel|> 類似があっても先頭が thought channel でなければ誤除去しない', () => {
    const input = '[1] コードは a<channel|>b です'
    expect(sanitizeGemma4Output(input)).toBe(input)
  })

  it('先頭に空白があっても thought channel を剥がせる', () => {
    const input = '  <|channel>thought\nひとりごと\n<channel|>  本文です'
    expect(sanitizeGemma4Output(input)).toBe('本文です')
  })

  it('thought で始まるが閉じタグが無い壊れた出力は無加工で返す', () => {
    const input = '<|channel>thought ずっと考えている'
    expect(sanitizeGemma4Output(input)).toBe(input)
  })
})

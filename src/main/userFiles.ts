import { app } from 'electron'
import { promises as fs } from 'fs'
import { join, resolve, sep } from 'path'

export type UserFileKind = 'dict' | 'hallucinations'

const FILE_NAMES: Record<UserFileKind, string> = {
  dict: 'dictionary.txt',
  hallucinations: 'hallucinations.txt'
}

const SEEDS: Record<UserFileKind, string> = {
  dict: `# 用語辞書 (誤変換 -> 正解)
# 1行1ルール、タブ区切り
# # で始まる行はコメント
#
# 例 (行頭の # を外して有効化):
# タカイチ\t高市
# ヘビームーンズ\theavymoons
`,
  hallucinations: `# ハルシネーション抑制リスト (内蔵パターンへの追加)
# 1行1パターン、# で始まる行はコメント
# キュー全体のテキストがパターンと一致したキューを削除します
#
# 例 (行頭の # を外して有効化):
# ごめん
# おやすみ
# うん
`
}

export function defaultFilePath(kind: UserFileKind): string {
  return join(app.getPath('userData'), FILE_NAMES[kind])
}

export async function ensureDefaultFile(kind: UserFileKind): Promise<string> {
  const path = defaultFilePath(kind)
  try {
    await fs.access(path)
  } catch {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(path, SEEDS[kind], 'utf-8')
  }
  return path
}

export async function ensureAllDefaultFiles(): Promise<void> {
  await ensureDefaultFile('dict')
  await ensureDefaultFile('hallucinations')
}

export async function readUserFile(path: string): Promise<string> {
  return await fs.readFile(path, 'utf-8')
}

export async function writeUserFile(path: string, content: string): Promise<void> {
  const tmp = path + '.tmp'
  await fs.writeFile(tmp, content, 'utf-8')
  await fs.rename(tmp, path)
}

export function isDefaultPath(kind: UserFileKind, path: string | undefined): boolean {
  if (!path) return false
  return path === defaultFilePath(kind)
}

// セッション中にダイアログで承認されたパスを記録するための allowlist。
// userData 配下以外のパスは、ダイアログで明示的に選ばれたものだけ read/write を許可する。
const dialogAllowedPaths = new Set<string>()

export function registerDialogPath(path: string): void {
  dialogAllowedPaths.add(resolve(path))
}

export function isPathAllowed(path: string): boolean {
  const abs = resolve(path)
  // userData 配下なら無条件で許可
  const userData = resolve(app.getPath('userData'))
  if (abs === userData || abs.startsWith(userData + sep)) return true
  // ダイアログで承認済みのパスなら許可
  if (dialogAllowedPaths.has(abs)) return true
  return false
}

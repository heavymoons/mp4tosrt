#!/usr/bin/env node
// ============================================================================
// 暫定ブリッジ: Gemma 4 12B 対応のため、node-llama-cpp のメンテナ未マージブランチ
// (withcatai/node-llama-cpp の gilad/gemma4, 固定SHA 5201176, PR #591) を自前ビルドし、
// llama.cpp b9524 をソースビルドして、アプリの node_modules/node-llama-cpp/ に
// 最小コピーで差し替える。upstream PR #591 がマージ＆リリースされたら本スクリプトは撤去し、
// クリーンな npm 依存 (node-llama-cpp) に戻すこと。
//
// macOS arm64 / Metal 専用。冪等 (再実行しても同じ結果)。
// 重い処理 (clone + npm install + llama.cpp ソースビルド ≒ 数 GB / 数分〜十数分)。
// ============================================================================

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---- 設定 (再現性のため固定) -----------------------------------------------
const REPO_URL = 'https://github.com/withcatai/node-llama-cpp.git'
const BRANCH = 'gilad/gemma4'
const PINNED_SHA = '5201176'
const LLAMA_RELEASE = 'b9524'
const MACOS_DEPLOYMENT_TARGET = '13.0'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(__dirname, '..')
const APP_NLC = join(APP_ROOT, 'node_modules', 'node-llama-cpp')
const APP_SCOPED = join(APP_ROOT, 'node_modules', '@node-llama-cpp')

const BUILD_DIR = join(tmpdir(), 'mp4tosrt-llama-build')
const CLONE_DIR = join(BUILD_DIR, 'node-llama-cpp')

// ---- ユーティリティ ---------------------------------------------------------
function log(msg) {
  console.log(`[setup:llama] ${msg}`)
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}${opts.cwd ? `  (cwd: ${opts.cwd})` : ''}`)
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

function fail(msg) {
  throw new Error(`[setup:llama] ${msg}`)
}

// ---- 1. ブランチを固定SHAで clone -------------------------------------------
function cloneRepo() {
  if (!existsSync(APP_NLC)) {
    fail(
      `アプリの node_modules/node-llama-cpp が見つかりません (${APP_NLC})。` +
      '先に npm install を実行してください。'
    )
  }

  mkdirSync(BUILD_DIR, { recursive: true })

  if (existsSync(CLONE_DIR)) {
    log(`既存の clone を削除して作り直します: ${CLONE_DIR}`)
    rmSync(CLONE_DIR, { recursive: true, force: true })
  }

  // --depth 1 だと任意 SHA を checkout できないため、ブランチを浅めに取得してから
  // 固定 SHA に checkout して再現性を担保する。
  log(`clone ${REPO_URL} (${BRANCH}) を取得します...`)
  run('git', ['clone', '-b', BRANCH, '--depth', '50', REPO_URL, CLONE_DIR])
  // SHA が浅い履歴に無い場合に備えて fetch も試みる。
  try {
    run('git', ['fetch', '--depth', '50', 'origin', BRANCH], { cwd: CLONE_DIR })
  } catch {
    log('fetch をスキップ (clone 済み履歴で checkout を試行)')
  }
  log(`固定 SHA ${PINNED_SHA} を checkout します`)
  run('git', ['checkout', PINNED_SHA], { cwd: CLONE_DIR })

  // checkout した HEAD が固定 SHA で始まることを確認 (再現性ガード)。
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: CLONE_DIR })
    .toString()
    .trim()
  if (!head.startsWith(PINNED_SHA)) {
    fail(`checkout した HEAD (${head}) が固定 SHA (${PINNED_SHA}) と一致しません。`)
  }
  log(`checkout 完了: HEAD=${head}`)
}

// ---- 2. clone を install & build (dist 生成) --------------------------------
function buildClone() {
  log('clone の依存をインストールします (CI=true npm install)...')
  run('npm', ['install'], { cwd: CLONE_DIR, env: { ...process.env, CI: 'true' } })
  log('clone をビルドします (npm run build)...')
  run('npm', ['run', 'build'], { cwd: CLONE_DIR, env: { ...process.env, CI: 'true' } })

  const cliPath = join(CLONE_DIR, 'dist', 'cli', 'cli.js')
  if (!existsSync(cliPath)) {
    fail(`ビルド後に CLI が見つかりません: ${cliPath}`)
  }
}

// ---- 3. llama.cpp b9524 をソースビルド --------------------------------------
function buildLlamaSource() {
  // `source download` に --cmakeOptions フラグは存在しない。CMake option は
  // NODE_LLAMA_CPP_CMAKE_OPTION_* 環境変数から拾われる。macOS deployment target を
  // 13.0 に固定して、macOS 13 でロード可能な addon を作る。
  const env = {
    ...process.env,
    NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_OSX_DEPLOYMENT_TARGET: MACOS_DEPLOYMENT_TARGET,
    MACOSX_DEPLOYMENT_TARGET: MACOS_DEPLOYMENT_TARGET
  }
  log(`llama.cpp ${LLAMA_RELEASE} をソースビルドします (deployment target ${MACOS_DEPLOYMENT_TARGET})...`)
  run(
    'node',
    ['./dist/cli/cli.js', 'source', 'download', '--release', LLAMA_RELEASE, '--noUsageExample'],
    { cwd: CLONE_DIR, env }
  )
}

// ---- 4. lastBuild.json から実 build フォルダ名を解決 ------------------------
function resolveBuildFolderName() {
  const lastBuildPath = join(CLONE_DIR, 'llama', 'lastBuild.json')
  if (!existsSync(lastBuildPath)) {
    fail(`llama/lastBuild.json が見つかりません: ${lastBuildPath}。ソースビルドが失敗した可能性。`)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(lastBuildPath, 'utf-8'))
  } catch (e) {
    fail(`lastBuild.json のパースに失敗: ${e instanceof Error ? e.message : String(e)}`)
  }
  const folderName = parsed?.folderName
  if (!folderName || typeof folderName !== 'string') {
    fail(`lastBuild.json に folderName がありません: ${JSON.stringify(parsed)}`)
  }
  // custom cmake option を付けると build フォルダ名に option hash が付くため、
  // mac-arm64-metal-release-b9524 のような固定名にはせず lastBuild.json から解決する。
  log(`build フォルダ名を解決しました: ${folderName}`)
  return folderName
}

// ---- 5. アプリの node_modules/node-llama-cpp へ最小コピー -------------------
function copyToApp(folderName) {
  const localBuildSrc = join(CLONE_DIR, 'llama', 'localBuilds', folderName)
  if (!existsSync(localBuildSrc)) {
    fail(`localBuild フォルダが見つかりません: ${localBuildSrc}`)
  }

  // runtime に必要なものだけを上書きコピーする (.git や llama.cpp ソースは含めない)。
  const items = [
    ['dist', join(CLONE_DIR, 'dist'), join(APP_NLC, 'dist')],
    ['templates/packed', join(CLONE_DIR, 'templates', 'packed'), join(APP_NLC, 'templates', 'packed')],
    ['bins', join(CLONE_DIR, 'bins'), join(APP_NLC, 'bins')],
    ['package.json', join(CLONE_DIR, 'package.json'), join(APP_NLC, 'package.json')],
    ['llama/lastBuild.json', join(CLONE_DIR, 'llama', 'lastBuild.json'), join(APP_NLC, 'llama', 'lastBuild.json')],
    ['llama/localBuilds/' + folderName, localBuildSrc, join(APP_NLC, 'llama', 'localBuilds', folderName)]
  ]

  for (const [label, src, dest] of items) {
    if (!existsSync(src)) {
      // bins や templates/packed はビルド構成によって無いことがあるため warn 止まり。
      if (label === 'bins' || label === 'templates/packed') {
        log(`(警告) コピー元が存在しないためスキップ: ${label} (${src})`)
        continue
      }
      fail(`コピー元が存在しません: ${label} (${src})`)
    }
    log(`コピー: ${label}`)
    mkdirSync(dirname(dest), { recursive: true })
    // 既存を上書きするため、ディレクトリは一旦消してからコピーして残骸を残さない。
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    cpSync(src, dest, { recursive: true })
  }
}

// ---- 6. 3.18.1 prebuilt (@node-llama-cpp/*) を削除 --------------------------
function removeStalePrebuilt() {
  if (existsSync(APP_SCOPED)) {
    log(`stale prebuilt を削除します (3.18.1=b8390, Gemma 4 非対応): ${APP_SCOPED}`)
    rmSync(APP_SCOPED, { recursive: true, force: true })
  } else {
    log('@node-llama-cpp/* は存在しません (削除不要)')
  }
}

// ---- main -------------------------------------------------------------------
function main() {
  log('=== Gemma 4 llama.cpp セットアップ開始 (暫定ブリッジ) ===')
  log(`ビルドディレクトリ: ${BUILD_DIR}`)
  cloneRepo()
  buildClone()
  buildLlamaSource()
  const folderName = resolveBuildFolderName()
  copyToApp(folderName)
  removeStalePrebuilt()
  log('=== セットアップ完了 ===')
  log('node_modules/node-llama-cpp に gilad/gemma4 + llama.cpp b9524 を差し替えました。')
}

try {
  main()
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}

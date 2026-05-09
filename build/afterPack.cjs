const { execSync } = require('child_process')
const { copyFileSync, existsSync } = require('fs')
const { join } = require('path')

module.exports = async function (context) {
  const target = context.appOutDir
  console.log(`[afterPack] cleaning xattrs from ${target}`)
  try {
    execSync(`xattr -cr "${target}"`, { stdio: 'inherit' })
    console.log(`[afterPack] xattr clean done`)
  } catch (e) {
    console.warn(`[afterPack] xattr clean failed: ${e.message}`)
  }

  // README / LICENSE を .app の **横** (appOutDir 直下) にコピーする。
  // package.json の extraFiles を使うと macOS だと .app/Contents/ 配下に
  // 入ってしまい codesign が拒否するため、afterPack で外側に置く方式。
  // DMG (dmg.contents 参照) も ZIP (appOutDir まるごとアーカイブ) も拾える。
  const projectDir = context.packager.projectDir
  const sidecars = ['README.md', 'README.en.md', 'LICENSE']
  for (const name of sidecars) {
    const src = join(projectDir, name)
    if (!existsSync(src)) {
      console.warn(`[afterPack] sidecar missing: ${src}`)
      continue
    }
    const dst = join(target, name)
    try {
      copyFileSync(src, dst)
      console.log(`[afterPack] copied ${name} → ${dst}`)
    } catch (e) {
      console.warn(`[afterPack] copy ${name} failed: ${e.message}`)
    }
  }
}

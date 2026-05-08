const { execSync } = require('child_process')

module.exports = async function (context) {
  const target = context.appOutDir
  console.log(`[afterPack] cleaning xattrs from ${target}`)
  try {
    execSync(`xattr -cr "${target}"`, { stdio: 'inherit' })
    console.log(`[afterPack] xattr clean done`)
  } catch (e) {
    console.warn(`[afterPack] xattr clean failed: ${e.message}`)
  }
}

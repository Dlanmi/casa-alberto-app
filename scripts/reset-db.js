const fs = require('fs')
const path = require('path')
const os = require('os')

const APP_NAME = 'casa-alberto-app'

function userDataDir() {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_NAME)
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return path.join(appData, APP_NAME)
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(xdg, APP_NAME)
}

const dir = userDataDir()
const targets = ['casa-alberto.db', 'casa-alberto.db-wal', 'casa-alberto.db-shm']
let removed = 0
for (const name of targets) {
  const file = path.join(dir, name)
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true })
    removed++
    console.log(`removed ${file}`)
  }
}
if (removed === 0) {
  console.log(`no db files found in ${dir}`)
}

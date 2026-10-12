const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const localConfigRoot = path.join(projectRoot, '.local');

function getLocalConfigPath(relativePath, legacyPaths = []) {
  const destination = path.join(localConfigRoot, relativePath);
  if (fs.existsSync(destination)) return destination;

  const legacySource = legacyPaths.find((candidate) => fs.existsSync(candidate));
  if (legacySource) {
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(legacySource, destination, fs.constants.COPYFILE_EXCL);
      console.info(`[local-config] Configurazione locale migrata: ${relativePath}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.warn(`[local-config] Migrazione non riuscita (${relativePath}):`, error.message);
      }
    }
  }

  return destination;
}

module.exports = { getLocalConfigPath, localConfigRoot };

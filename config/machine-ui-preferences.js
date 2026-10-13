const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// The caller supplies a .local path belonging to this installation, never cloud state.
function createMachineUiPreferencesStore(filePath) {
  const read = () => {
    try {
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { primaryTheme: saved.primaryTheme === 'day' ? 'day' : 'night' };
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      return { primaryTheme: 'night' };
    }
  };
  const save = (primaryTheme) => {
    if (!['day', 'night'].includes(primaryTheme)) {
      throw Object.assign(new Error('Modalità non valida: scegli giorno o notte.'), { status: 400 });
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify({ primaryTheme }, null, 2)}\n`, { flag: 'wx' });
      fs.renameSync(temporary, filePath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return read();
  };
  return { read, save };
}

module.exports = { createMachineUiPreferencesStore };

// Script Node.js per sincronizzare CSV -> JSON
// Utilizzo: node sync-brani.js

const { syncBraniJson, EXTRA_CSV_NAME } = require('./brani-utils');

console.log('Sincronizzazione brani CSV -> JSON');

try {
  const { stats, jsonPath } = syncBraniJson();

  console.log('Sincronizzazione completata');
  console.log(`Brani caricati: ${stats.total}`);
  console.log(` - CSV principale: ${stats.baseCount}`);
  console.log(` - CSV aggiuntivo (${EXTRA_CSV_NAME}): ${stats.extraCount}`);

  if (stats.skippedInvalid > 0) {
    console.log(` - Righe incomplete ignorate: ${stats.skippedInvalid}`);
  }

  if (stats.skippedDuplicates > 0) {
    console.log(` - Duplicati ignorati: ${stats.skippedDuplicates}`);
  }

  console.log(`File: ${jsonPath}`);
} catch (error) {
  console.error('Errore:', error.message);
  process.exit(1);
}

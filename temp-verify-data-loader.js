const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('Bordero/js/data-loader.js', 'utf8');
const context = {
  console,
  logger: { info(){}, warn(){}, error(){} },
  excelSync: { syncFromExcel: async () => false },
  Storage: { get(){ return null; }, set(){} },
  Network: { fetchCSV: async () => '' },
  CSVParser: { parse: () => [] },
  DateUtils: { now: () => Date.now() },
  BORDERO_CONFIG: { CACHE_KEY_BRANI: 'cache', CSV_BRANI: 'brani.csv' }
};
vm.createContext(context);
vm.runInContext(code, context);
const DataLoader = context.DataLoader;
const loader = new DataLoader();
const input = [{ titolo: 'A' }, { titolo: '   ' }, { titolo: '' }, { id: 1 }];
const result = loader.normalizeBraniList(input);
if (result.length !== 1) {
  console.error('TEST FAILED', result.length, result);
  process.exit(1);
}
console.log('TEST PASSED', result.length);

const fs = require('fs');
const path = require('path');

const targets = [
  'USERFORM/js/pagina04-actions.js',
  'USERFORM/pages/PAGINA04.html',
  'public/ScriptPDF1.html',
  'pdf/viewers/ScriptPDF1.html',
  'verify_code_quality.ps1'
];

const bannedPatterns = [
  /server-manager\.js/gi,
  /localhost:8765/gi,
  /pdf-server\.js/gi,
  /localhost:3000/gi,
  /legacy\s+8765/gi,
  /legacy\s+port/gi,
  /btn-open-pdf-legacy/gi
];

let failed = false;

for (const rel of targets) {
  const full = path.join(__dirname, '..', rel);
  const text = fs.readFileSync(full, 'utf8');

  for (const pattern of bannedPatterns) {
    if (pattern.test(text)) {
      console.error(`Legacy runtime reference found in ${rel}: ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS: active runtime files no longer reference legacy server-manager/pdf-server architecture.');

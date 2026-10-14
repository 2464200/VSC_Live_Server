const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-print-layout-'));
app.setPath('userData', path.join(scratch, 'profile'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const html = fs.readFileSync(path.join(root, 'Bordero/pages/coreografie-stampa.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('<head>', `<head><base href="${pathToFileURL(path.join(root, 'Bordero/pages/')).href}">`);
  const preview = path.join(scratch, 'preview.html');
  fs.writeFileSync(preview, html);
  const win = new BrowserWindow({ width: 1200, height: 900, show: false, webPreferences: { offscreen: true } });
  await win.loadFile(preview);
  const source = fs.readFileSync(path.join(root, 'Bordero/pages/coreografie-stampa.js'), 'utf8')
    .replace(/document\.addEventListener\('DOMContentLoaded',[\s\S]*$/, 'window.PrintPage = CoreografieStampaPage;');
  await win.webContents.executeJavaScript(source + `
    const page = Object.create(window.PrintPage.prototype);
    // Two pages exercise both repeated headings and empty filler rows.
    page.standardRowsPerPage = 2;
    page.brani = Array.from({length:3}, (_,i) => ({
      id:String(i+1), titolo:'Alfa '+i, info_livello:'SUPER AVANZATO 1+2',
      course_week:'42, 53', info_coreo_1:'COPPIA', info_coreo_2:'CERCHIO'
    }));
    page.settings = {
      includeCover:false, levelFilters:[], letterFilter:'ALL',
      columnLabels:['MATTINA','POMERIGGIO','SERA','DJ SET']
    };
    document.querySelector('.screen-shell').hidden = true;
    window.checkColumnAlignment = () => {
      const failures=[];
      const compare=(heading,cell,context) => {
        const a=heading.getBoundingClientRect(), b=cell.getBoundingClientRect();
        const difference=Math.max(Math.abs(a.x-b.x),Math.abs(a.width-b.width));
        if(difference>.2) failures.push({...context,difference:+difference.toFixed(2)});
      };
      for(let mask=0;mask<16;mask++) for(let events=1;events<=4;events++) {
        Object.assign(page.settings,{
          includeLevel:!!(mask&1),includeWeek:!!(mask&2),
          includeInfoCoreo1:!!(mask&4),includeInfoCoreo2:!!(mask&8),eventMode:events
        });
        page.render();
        for(const [sheet,section] of [...document.querySelectorAll('.letter-section')].entries()) {
          const heading=section.querySelector('.coreography-column-headings');
          for(const row of section.querySelectorAll('.coreography-entry')) {
            const context={mask,events,sheet,empty:row.classList.contains('empty-entry')};
            if(heading.children.length!==row.children.length) {
              failures.push({...context,error:'column count'});
              continue;
            }
            for(let column=0;column<heading.children.length;column++) {
              compare(heading.children[column],row.children[column],{...context,column});
            }
            const labels=heading.querySelector('.event-columns').children;
            const cells=row.querySelector('.event-columns').children;
            for(let event=0;event<labels.length;event++) compare(labels[event],cells[event],{...context,event});
          }
        }
      }
      return failures;
    };
    true;
  `);
  const failures = [];
  win.webContents.debugger.attach('1.3');
  for (const mode of [
    { media: 'screen', width: 1200 },
    { media: 'screen', width: 600 },
    { media: 'print', width: 1200 }
  ]) {
    win.setContentSize(mode.width, 900);
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: mode.media });
    const result = await win.webContents.executeJavaScript('checkColumnAlignment();');
    failures.push(...result.map(item => ({ ...mode, ...item })));
  }
  win.webContents.debugger.detach();
  console.log(JSON.stringify({ configurations: 192, failures: failures.length, examples: failures.slice(0, 10) }));
  win.destroy();
  app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });

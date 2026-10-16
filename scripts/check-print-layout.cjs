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
      id:String(i+1), titolo:'Alfa '+i+' - Una coreografia dal nome molto lungo da leggere interamente '+ 'Senzaspazi'.repeat(6),
      info_livello:'SUPER AVANZATO 1+2', course_week:'1, 12, 25, 42, 53',
      info_coreo_1:'COPPIA - descrizione completa su più righe', info_coreo_2:'CERCHIO - informazioni aggiuntive'
    }));
    page.settings = {
      includeCover:false, levelFilters:[], letterFilter:'ALL',
      columnLabels:['MATTINA','POMERIGGIO','SERA','DJ SET']
    };
    window.checkPersistence = () => {
      page.settingsStorageKey='bordero_print_layout_test';
      page.persistSettingsBound=()=>page.persistSettings();
      page.djNames=['DJ A','DJ B'];
      page.serata={evento:'Evento predefinito',luogo:'Luogo predefinito',data:'2026-10-17'};
      const saved={eventName:'',place:'',date:'',eventMode:4,djs:['DJ B'],columnLabels:['','','SERA','DJ SET'],includeCover:false,includeLevel:false,includeWeek:true,includeInfoCoreo1:true,numberPages:true,levelFilters:['SUPER AVANZATO 1+2'],letterFilter:'A'};
      localStorage.setItem(page.settingsStorageKey,JSON.stringify(saved));
      const restore=() => {
        page.persistedSettings=page.loadPersistedSettings();
        page.populateSettings();
        page.renderLetterOptions();
        page.renderLevelOptions();
        page.renderColumnSettings();
      };
      restore();
      page.setupListeners();
      const failures=[];
      let settings=page.readSettings();
      if(settings.eventName!=='' || settings.place!=='' || settings.date!=='' || settings.columnLabels[0]!=='' || settings.includeCover!==false || settings.includeLevel!==false || settings.eventMode!==4 || settings.djs!=='DJ B' || settings.letterFilter!=='A' || settings.levelFilters[0]!=='SUPER AVANZATO 1+2') failures.push({error:'restoring saved preferences'});
      const name=document.getElementById('event-name');
      name.value='Nuova scelta';
      name.dispatchEvent(new Event('input',{bubbles:true}));
      const level=document.getElementById('include-level');
      level.checked=true;
      level.dispatchEvent(new Event('change',{bubbles:true}));
      restore();
      settings=page.readSettings();
      if(settings.eventName!=='Nuova scelta' || !settings.includeLevel || settings.includeCover!==false || settings.place!=='') failures.push({error:'replacing saved preferences',settings});
      if(document.querySelectorAll('.letter-section').length) failures.push({error:'restore generated preview'});
      localStorage.removeItem(page.settingsStorageKey);
      return failures;
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
          const bounds=section.getBoundingClientRect();
          if(Math.abs(bounds.width-210*96/25.4)>1 || bounds.height>297*96/25.4) {
            failures.push({mask,events,sheet,error:'A4 bounds',width:bounds.width,height:bounds.height});
          }
          const cellsToRead=section.querySelectorAll('.coreography-title,.coreography-level,.coreography-week,.coreography-info-coreo,.coreography-column-headings > span,.event-column-heading');
          for(const cell of cellsToRead) {
            const style=getComputedStyle(cell);
            if(cell.scrollWidth>cell.clientWidth+1 || cell.scrollHeight>cell.clientHeight+1 || parseFloat(style.fontSize)<8.5) {
              failures.push({mask,events,sheet,error:'unreadable cell',className:cell.className,text:cell.textContent});
            }
          }
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
    window.checkLongPages = () => {
      const originalRows=page.brani;
      const originalSettings={...page.settings};
      page.standardRowsPerPage=36;
      page.settings.numberPages=true;
      page.settings.duplex=true;
      page.brani=Array.from({length:75},(_,i)=>({...originalRows[i%3],id:String(i+1),titolo:'Alfa '+i+' - '+originalRows[i%3].titolo}));
      page.render();
      const failures=[];
      const rows=[...document.querySelectorAll('.coreography-entry:not(.empty-entry)')];
      if(rows.length!==75 || rows.some((row,i)=>row.querySelector('.coreography-id').textContent!==String(i+1))) {
        failures.push({error:'missing or reordered rows'});
      }
      for(const [index,section] of [...document.querySelectorAll('.letter-section')].entries()) {
        if(section.getBoundingClientRect().height>297*96/25.4) failures.push({error:'page overflow',index});
        if(section.querySelector('.page-number').textContent!=='Pagina '+(index+1)) failures.push({error:'page numbering',index});
      }
      page.brani=originalRows;
      page.settings=originalSettings;
      page.standardRowsPerPage=2;
      return failures;
    };
    true;
  `);
  const failures = await win.webContents.executeJavaScript('checkPersistence();');
  let pdfPages = 0;
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
    const longPages = await win.webContents.executeJavaScript('checkLongPages();');
    failures.push(...longPages.map(item => ({ ...mode, ...item })));
    if (mode.media === 'print') {
      const expected = await win.webContents.executeJavaScript("document.querySelectorAll('.letter-section').length");
      const pdf = await win.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
      pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
      if (pdfPages !== expected) failures.push({ error: 'PDF page count', expected, actual: pdfPages });
    }
  }
  win.webContents.debugger.detach();
  console.log(JSON.stringify({ configurations: 192, pdfPages, failures: failures.length, examples: failures.slice(0, 10) }));
  win.destroy();
  app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });

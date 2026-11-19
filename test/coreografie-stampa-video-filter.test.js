const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPrintPage(courseState = null, courseArchive = null) {
  const printDocument = { style: { setProperty() {} }, classList: { toggle() {} }, innerHTML: '' };
  const printStatus = { textContent: '' };
  const context = {
    window: {
      isVideoOnlyBrano: () => false,
      choreoProgramStore: { getState: () => courseState },
      ...(courseArchive ? { courseArchives: courseArchive } : {})
    },
    document: {
      addEventListener() {},
      getElementById(id) { return id === 'print-document' ? printDocument : printStatus; }
    },
    console
  };
  vm.createContext(context);
  const source = fs.readFileSync('Bordero/pages/coreografie-stampa.js', 'utf8')
    .replace(/document\.addEventListener\('DOMContentLoaded',[\s\S]*$/, 'globalThis.CoreografieStampaPage = CoreografieStampaPage;');
  vm.runInContext(source, context);
  const page = Object.create(context.CoreografieStampaPage.prototype);
  page.renderedDocument = printDocument;
  return page;
}

test('stampa coreografie excludes video positions 600-606 and keeps normal songs', () => {
  const page = loadPrintPage();
  const videos = Array.from({ length: 7 }, (_, index) => ({
    id: String(600 + index),
    titolo: `VIDEO ${index}`
  }));
  const groups = page.groupByInitial([
    { id: '599', titolo: 'Brano valido' },
    ...videos,
    { id: '607', titolo: 'Coreografia valida' }
  ]);
  const printed = Object.values(groups).flat();

  assert.deepEqual(printed.map((item) => item.id).sort(), ['599', '607']);
});

test('stampa coreografie recognizes excluded video titles after renumbering', () => {
  const page = loadPrintPage();
  assert.equal(page.isExcludedFromPrint({ id: '900', titolo: 'ESIBIZIONE DUE TORRI - Black Coffee' }), true);
  assert.equal(page.isExcludedFromPrint({ id: '901', titolo: 'NEW VIDEO PROMO CORSI 2026' }), true);
  assert.equal(page.isExcludedFromPrint({ id: '902', titolo: 'Normale coreografia' }), false);
});

test('stampa coreografie retains week 53 from the active curriculum', () => {
  const page = loadPrintPage({ activeSeason: '2026-2027', seasons: {
    '2026-2027': { records: [
      { branoId: '001', week: 1 }, { branoId: '001', week: 53 }, { branoId: '001', week: 54 }
    ] }
  } });
  page.brani = [{ id: '001', titolo: 'Coreografia' }];
  page.applyCourseWeeksToBrani();
  assert.equal(page.brani[0].course_week, '1, 53');
});

test('week print orders sort weeks numerically descending, preserve level order and omit unassigned choreography', () => {
  const page = loadPrintPage();
  const brani = [
    { id: '1', titolo: 'Bravo', info_livello: 'BASE', course_weeks: [10] },
    { id: '2', titolo: 'Alfa', info_livello: 'BASE', course_weeks: [2] },
    { id: '3', titolo: 'Charlie', info_livello: 'INTERMEDIO', course_weeks: [2] },
    { id: '4', titolo: 'Non assegnata', info_livello: 'BASE', course_weeks: [] },
    { id: '5', titolo: 'Solo spazi', info_livello: 'BASE', course_weeks: ['   '] }
  ];
  const assigned = page.filterBraniWithCourseWeek(brani);
  const levelFirst = page.groupByLevelThenWeek(assigned);
  const weekFirst = page.groupByWeekThenLevel(assigned);

  assert.deepEqual(Object.keys(levelFirst), ['BASE', 'INTERMEDIO']);
  assert.deepEqual(Object.keys(levelFirst.BASE), ['Settimana 10', 'Settimana 2']);
  assert.deepEqual(Object.keys(weekFirst), ['Settimana 10', 'Settimana 2']);
  assert.deepEqual(Object.keys(weekFirst['Settimana 2']), ['BASE', 'INTERMEDIO']);
  assert.equal(Array.from(weekFirst['Settimana 2'].BASE, (item) => item.titolo).join(','), 'Alfa');
  assert.equal(page.filterBraniWithCourseWeek(brani.slice(3)).length, 0);

  page.settings = { printOrder: 'week-level', numberPages: false, columnLabels: ['Evento'], eventMode: 1 };
  const longList = Array.from({ length: 100 }, (_, index) => ({
    id: String(index + 1), titolo: `Brano ${index + 1}`, info_livello: 'BASE', course_weeks: [2]
  }));
  const longSection = page.renderHierarchicalGroup('Settimana 2', page.groupByWeekThenLevel(longList)['Settimana 2']);
  assert.equal((longSection.match(/class="coreography-entry"/g) || []).length, 100);
  assert.match(longSection, /Settimana 2/);
});

test('repeated choreography prints once at its latest week and keeps all weeks in the week column', () => {
  const page = loadPrintPage({ activeSeason: '2026-2027', seasons: {
    '2026-2027': { records: [
      { branoId: '001', level: 'BASE', week: 38 },
      { branoId: '001', level: 'BASE', week: 39 }
    ] }
  } });
  page.brani = [{ id: '001', titolo: 'BACK TO THE START', info_livello: 'BASE' }];
  page.applyCourseWeeksToBrani();
  const assigned = page.filterBraniWithCourseWeek(page.brani);
  const levelFirst = page.groupByLevelThenWeek(assigned);
  const weekFirst = page.groupByWeekThenLevel(assigned);

  assert.deepEqual(Object.keys(levelFirst.BASE), ['Settimana 39']);
  assert.deepEqual(Object.keys(weekFirst), ['Settimana 39']);
  assert.equal(levelFirst.BASE['Settimana 39'][0].course_week_for_print, '38,39');
  page.settings = { printOrder: 'level-week', includeCover: false, levelFilters: [], letterFilter: 'ALL', includeWeek: true, includeLevel: false, includeInfoCoreo1: false, includeInfoCoreo2: false, columnLabels: ['Evento'], eventMode: 1 };
  page.render();
  const output = page.renderedDocument.innerHTML;
  assert.match(output, /Settimana 39/);
  assert.match(output, /class="coreography-week">38,39<\/div>/);
  assert.equal((output.match(/class="coreography-entry"/g) || []).length, 1);
  page.settings.printOrder = 'week-level';
  page.render();
  const reverseOutput = page.renderedDocument.innerHTML;
  assert.match(reverseOutput, /<h2>Settimana 39<\/h2>/);
  assert.match(reverseOutput, /<h3 class="print-subgroup-heading">BASE<\/h3>/);
  assert.match(reverseOutput, /class="coreography-week">38,39<\/div>/);
  assert.equal((reverseOutput.match(/class="coreography-entry"/g) || []).length, 1);
});

test('print grouping reads repeated teaching weeks from the selected course archive by level', () => {
  const archive = {
    getActive: () => 'external',
    getRecords: () => [
      { branoId: '502', title: 'BACK TO THE START', season: '2026/2027', course: 'BASE Bergamo', level: 'BASE', week: 38, activity: 'COREOGRAFIA SPIEGATA' },
      { branoId: '502', title: 'BACK TO THE START', season: '2026/2027', course: 'BASE Curno', level: 'BASE', week: 39, activity: 'COREOGRAFIA SPIEGATA' },
      { branoId: '502', title: 'BACK TO THE START', season: '2026/2027', course: 'Intermedio', level: 'INTERMEDIO', week: 35, activity: 'COREOGRAFIA SPIEGATA' }
    ]
  };
  const page = loadPrintPage({ activeSeason: '2026-2027', seasons: { '2026-2027': { label: '2026/2027', records: [] } } }, archive);
  page.brani = [{ id: '502', titolo: 'BACK TO THE START', info_livello: 'BASE' }];
  page.applyCourseWeeksToBrani();
  const base = page.filterBraniWithCourseWeek(page.brani);
  const levels = page.groupByLevelThenWeek(base);

  assert.deepEqual(Object.keys(levels.BASE), ['Settimana 39']);
  assert.equal(levels.BASE['Settimana 39'][0].course_week_for_print, '38,39');
  assert.equal(Object.keys(levels).length, 1);
  page.settings = { printOrder: 'level-week', includeCover: false, levelFilters: [], letterFilter: 'ALL', includeWeek: true, includeLevel: false, includeInfoCoreo1: false, includeInfoCoreo2: false, columnLabels: ['Evento'], eventMode: 1 };
  page.render();
  let output = page.renderedDocument.innerHTML;
  assert.match(output, /<h2>BASE<\/h2>/);
  assert.match(output, /<h3 class="print-subgroup-heading">Settimana 39<\/h3>/);
  assert.match(output, /class="coreography-week">38,39<\/div>/);
  assert.equal((output.match(/class="coreography-entry"/g) || []).length, 1);

  page.settings.printOrder = 'week-level';
  page.render();
  output = page.renderedDocument.innerHTML;
  assert.match(output, /<h2>Settimana 39<\/h2>/);
  assert.match(output, /<h3 class="print-subgroup-heading">BASE<\/h3>/);
  assert.match(output, /class="coreography-week">38,39<\/div>/);
  assert.equal((output.match(/class="coreography-entry"/g) || []).length, 1);
});

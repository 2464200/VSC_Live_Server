/* Archivi dei programmi corsi. I dati esterni sono copie locali: questo modulo
 * non scrive mai sulla fonte Google. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.courseArchives = api;
    if (root.addEventListener) root.addEventListener('storage', (event) => {
      if (event.key === api.PREF_KEY) root.dispatchEvent(new root.CustomEvent('bordero:course-archive-changed', { detail: { archive: api.getActive() } }));
      if (event.key === api.STORAGE_KEY) root.dispatchEvent(new root.CustomEvent('bordero:course-archive-updated'));
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const STORAGE_KEY = 'bordero_course_archives_v1';
  const PREF_KEY = 'bordero_course_archive_active_v1';
  const ACTIVE_MIGRATION_KEY = 'bordero_course_archive_active_migrated_v1';
  const EXTERNAL_EXEC_URL = 'https://docs.google.com/spreadsheets/d/1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY/export?format=csv&gid=2136651580';
  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const headerKey = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    branoId: ['branoid', 'idcoreografia', 'idbrano', 'idchoreography', 'choreographyid'],
    title: ['titolo', 'coreografia', 'brano', 'title', 'choreography'],
    week: ['settimana', 'week', 'sett'], course: ['sedecorso', 'corso', 'course', 'classe'],
    level: ['livellocorso', 'livello', 'level'], choreoLevel: ['livellocoreografia', 'choreographylevel'],
    activity: ['tipoattivita', 'activity', 'tipo'], instructor: ['insegnante', 'insegnanti', 'istruttore', 'teacher', 'instructor', 'dancetrainer'],
    season: ['annoaccademico', 'stagione', 'season', 'ciclo'],
    date: ['datalezione', 'lessondate', 'date'], registeredAt: ['dataregistrazione', 'registrationdate'], sourceId: ['recordid', 'sourceid', 'idrecord', 'uuid']
  };
  const findColumn = (headers, names) => headers.findIndex((h) => names.includes(headerKey(h)));
  const parseCsv = (input) => {
    const first = String(input).split(/\r?\n/, 1)[0] || '';
    const delimiter = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = []; let cell = ''; let quoted = false;
    const source = String(input).replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
      const c = source[i];
      if (c === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = !quoted;
      else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && source[i + 1] === '\n') i += 1;
        row.push(cell); if (row.some((v) => clean(v))) rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    row.push(cell); if (row.some((v) => clean(v))) rows.push(row);
    if (quoted) throw new Error('CSV non valido: virgolette non bilanciate.');
    if (rows.length < 2) throw new Error('Il CSV deve contenere intestazioni e almeno una riga.');
    return rows;
  };
  const fingerprint = (record) => [record.branoId, record.season, record.course, record.level, record.choreoLevel, record.activity, record.week, record.weekLabel, record.date, record.registeredAt, record.title, record.instructor]
    .map((value) => clean(value)).join('\u001f');
  const stableId = (value) => {
    let hash = 14695981039346656037n;
    const prime = 1099511628211n;
    const mask = (1n << 64n) - 1n;
    for (let i = 0; i < value.length; i += 1) { hash ^= BigInt(value.charCodeAt(i)); hash = (hash * prime) & mask; }
    return `ext-${hash.toString(16).padStart(16, '0')}`;
  };
  function deriveAcademicSeason(weekLabel) {
    const dates = [...String(weekLabel || '').matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)];
    let startYear; let startMonth;
    if (dates.length >= 2) {
      const first = dates[0]; const last = dates.at(-1);
      const endYear = Number(last[3] || first[3]);
      if (!Number.isFinite(endYear)) return '';
      const endMonth = Number(last[2]);
      startMonth = Number(first[2]);
      startYear = Number(first[3] || (startMonth > endMonth ? endYear - 1 : endYear));
    } else return '';
    const academicStart = startMonth >= 9 ? startYear : startYear - 1;
    return `${academicStart}/${academicStart + 1}`;
  }
  function validateCsv(csv) {
    const rows = parseCsv(csv); const headers = rows[0].map(clean);
    const safeHeaders = headers.filter((header) => !/(password|passcode|parola|secret|codice)/i.test(headerKey(header)));
    const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, findColumn(headers, names)]));
    if (columns.branoId < 0 && columns.title < 0) throw new Error('Manca una colonna ID o titolo/coreografia.');
    if (columns.week < 0) throw new Error('Manca la colonna settimana/week.');
    const valid = []; const rejected = []; const seen = new Set(); const seenSourceIds = new Set();
    rows.slice(1).forEach((cells, index) => {
      const raw = Object.fromEntries(headers.flatMap((header, i) => safeHeaders.includes(header) ? [[header, cells[i] ?? '']] : []));
      const val = (key) => columns[key] < 0 ? '' : clean(cells[columns[key]]);
      const branoId = val('branoId'); const title = val('title'); const weekText = val('week');
      const weekMatch = weekText.match(/^\s*(\d{1,2})(?:\s|$|-)/);
      const week = /^\d{1,2}$/.test(weekText) ? Number(weekText) : weekMatch ? Number(weekMatch[1]) : NaN;
      if ((!branoId && !title) || !Number.isInteger(week) || week < 1 || week > 53) {
        rejected.push({ row: index + 2, reason: !branoId && !title ? 'ID e titolo assenti' : 'settimana non valida (atteso 1–53)', raw }); return;
      }
      const weekYears = weekText.match(/\d{4}/g) || [];
      const explicitSeason = val('season');
      const academicSeason = explicitSeason || deriveAcademicSeason(weekText);
      const record = { branoId, title, week, weekLabel: weekText, periodYear: weekYears.at(-1) || '', course: val('course'), level: val('level'), choreoLevel: val('choreoLevel'), activity: val('activity'), season: academicSeason, seasonSource: explicitSeason ? 'source' : academicSeason ? 'derived-september-august' : '', instructor: val('instructor'), date: val('date'), registeredAt: val('registeredAt'), sourceId: val('sourceId'), source: 'external', raw };
      const key = fingerprint(record);
      if (seen.has(key) || (record.sourceId && seenSourceIds.has(record.sourceId))) { rejected.push({ row: index + 2, reason: 'duplicato nel file', raw, duplicate: true }); return; }
      seen.add(key); record.id = record.sourceId ? `source-${record.sourceId}` : stableId(key); valid.push(record);
      if (record.sourceId) seenSourceIds.add(record.sourceId);
    });
    const titleIds = new Map();
    valid.forEach((r) => { const key = clean(r.title).toLocaleLowerCase('it'); if (key) { if (!titleIds.has(key)) titleIds.set(key, new Set()); titleIds.get(key).add(r.branoId); } });
    const ambiguous = valid.flatMap((r) => {
      const reasons = [];
      if (!r.branoId) reasons.push('ID coreografia assente; possibile associazione solo per titolo esatto e univoco');
      if (!r.season) reasons.push(r.periodYear ? `anno ${r.periodYear} presente, stagione accademica da confermare` : 'periodo accademico assente');
      if (!r.level) reasons.push('livello del corso assente');
      if (!r.course) reasons.push('sede/corso assente');
      if (clean(r.title) && titleIds.get(clean(r.title).toLocaleLowerCase('it'))?.size > 1) reasons.push('titolo uguale associato a ID diversi');
      return reasons.length ? [{ id: r.id, title: r.title, branoId: r.branoId, reason: reasons.join('; ') }] : [];
    });
    return { headers, valid, rejected, ambiguous, total: rows.length - 1 };
  }
  function externalPayloadToCsv(payload) {
    const source = String(payload || '').trim();
    if (/^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(source)) {
      throw new Error('La fonte ha restituito una pagina HTML invece dei dati del registro. Verifica che il foglio sia accessibile a chiunque abbia il link e che il link punti alla scheda Registrazioni.');
    }
    if (!source.startsWith('{') && !source.startsWith('[')) return source;
    let parsed;
    try { parsed = JSON.parse(source); } catch { throw new Error('La risposta JSON della fonte esterna non è valida.'); }
    let rows = Array.isArray(parsed) ? parsed : parsed?.records || parsed?.Registrazioni || parsed?.rows || parsed?.values;
    if (!Array.isArray(rows) || !rows.length) throw new Error('Risposta JSON senza righe Registrazioni riconoscibili.');
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    if (Array.isArray(rows[0])) {
      const safeIndexes = rows[0].map((header, index) => ({ header: String(header), index })).filter(({ header }) => !/(password|passcode|parola|secret|codice)/i.test(headerKey(header)));
      if (!safeIndexes.length) throw new Error('La risposta JSON non contiene colonne importabili.');
      return rows.map((row) => safeIndexes.map(({ index }) => quote(row[index])).join(',')).join('\n');
    }
    if (!rows[0] || typeof rows[0] !== 'object') throw new Error('Formato delle righe JSON non supportato.');
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((header) => !/(password|passcode|parola|secret|codice)/i.test(headerKey(header)));
    if (!headers.length) throw new Error('La risposta JSON non contiene colonne importabili.');
    return [headers.map(quote).join(','), ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\n');
  }
  function manualRecords(state) {
    const season = state?.seasons?.[state.activeSeason];
    return (season?.records || []).map((r, i) => ({ id: `manual-${clean(r.id) || i}`, branoId: clean(r.branoId), title: clean(r.trackTitle), week: Number(r.week), course: clean(r.course), level: clean(r.level), season: clean(season.label || season.id), sourceId: clean(r.id), source: 'manual', raw: clone(r) }));
  }
  function compareExternalSnapshot(previous = [], incoming = []) {
    const oldRecords = new Map(previous.map((record) => [clean(record.id), record]));
    const newRecords = new Map(incoming.map((record) => [clean(record.id), record]));
    const added = [...newRecords.keys()].filter((id) => !oldRecords.has(id));
    const removed = [...oldRecords.keys()].filter((id) => !newRecords.has(id));
    const changed = [...newRecords.keys()].filter((id) => oldRecords.has(id) && fingerprint(oldRecords.get(id)) !== fingerprint(newRecords.get(id)));
    return { added, removed, changed };
  }
  function contextKey(r) { return [r.branoId, r.season, r.course, r.level, r.week].map(clean).join('\u001f'); }
  function comparisonKey(r) {
    const title = clean(r.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('it');
    // Il titolo normalizzato può suggerire il confronto quando il Registro non
    // fornisce un ID coreografia; il risultato resta ambiguo finché non verificato.
    const identity = title ? `title:${title}` : clean(r.branoId) ? `id:${clean(r.branoId)}` : `record:${clean(r.id)}`;
    // Periodo, corso e settimana restano campi da confrontare: se differiscono
    // vengono mostrati come conflitto, mentre più lezioni diventano ambigue.
    return [identity, clean(r.level)].join('\u001f');
  }
  function compare(manual, external) {
    const m = new Map(); const e = new Map();
    manual.forEach((r) => { const k = comparisonKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    external.forEach((r) => { const k = comparisonKey(r); if (!e.has(k)) e.set(k, []); e.get(k).push(r); });
    const keys = new Set([...m.keys(), ...e.keys()]); const rows = [];
    keys.forEach((key) => {
      const left = m.get(key) || []; const right = e.get(key) || [];
      if (left.length > 1 || right.length > 1) {
        const all = [...left, ...right];
        const contexts = all.map(contextKey);
        const exactDuplicate = contexts.some((context, index) => contexts.indexOf(context) !== index);
        rows.push({ status: exactDuplicate ? 'duplicate' : 'ambiguous', manual: left, external: right, reason: exactDuplicate ? 'più record hanno lo stesso contesto' : 'possibili corsi distinti o più corrispondenze per titolo' });
      }
      else if (!left.length) rows.push({ status: 'external-only', manual: [], external: right });
      else if (!right.length) rows.push({ status: 'manual-only', manual: left, external: [] });
      else {
        const fields = ['branoId', 'title', 'course', 'level', 'week', 'season', 'instructor', 'date', 'registeredAt', 'activity', 'choreoLevel'];
        const differences = fields.filter((field) => clean(left[0][field]) !== clean(right[0][field]));
        const lacksIdentityOrContext = !right[0].branoId || [...left, ...right].some((r) => !r.season || !r.course || !r.level);
        if (lacksIdentityOrContext) rows.push({ status: 'ambiguous', manual: left, external: right, differences, reason: 'associazione suggerita da ID/titolo e contesto; richiede conferma manuale' });
        else if (differences.length) rows.push({ status: 'different', manual: left, external: right, differences, reason: `differenze nei campi: ${differences.join(', ')}` });
        else rows.push({ status: 'same', manual: left, external: right, differences: [] });
      }
    });
    rows.forEach((row, index) => { row.key = `${stableId(`${index}|${comparisonKey(row.manual[0] || row.external[0] || {})}`)}-${index}`; });
    return rows;
  }
  function merge(manual, external, previous, resolutions = {}) {
    const rows = compare(manual, external);
    const conflicts = rows.filter((row) => {
      if (!['different', 'duplicate', 'ambiguous'].includes(row.status)) return false;
      const resolution = resolutions[row.key];
      if (!resolution || !['manual', 'external', 'both', 'fields'].includes(resolution.mode)) return true;
      if (resolution.mode === 'fields' && (row.manual.length !== 1 || row.external.length !== 1)) return true;
      if (resolution.mode === 'fields') {
        const invalidField = (row.differences || []).some((field) => !['manual', 'external', 'custom'].includes(resolution.fields?.[field]) || (resolution.fields[field] === 'custom' && !Object.hasOwn(resolution.custom || {}, field)));
        const customWeek = resolution.fields?.week === 'custom' ? Number(resolution.custom?.week) : null;
        return invalidField || (customWeek !== null && (!Number.isInteger(customWeek) || customWeek < 1 || customWeek > 53));
      }
      return false;
    });
    if (conflicts.length) return { ok: false, conflicts, rows };
    const records = [];
    const add = (record, provenance = [record.source]) => {
      const copy = clone(record);
      copy.id = `unified-${stableId(`${record.source || 'record'}|${record.sourceId || record.id}|${fingerprint(copy)}`)}`;
      copy.source = 'unified';
      copy.provenance = [...new Set(provenance.filter(Boolean))];
      copy.sourceReferences = { sourceId: record.sourceId || record.id, source: record.source };
      records.push(copy);
    };
    const picks = {};
    for (const row of rows) {
      if (row.status === 'manual-only') { row.manual.forEach((record) => add(record)); continue; }
      if (row.status === 'external-only') { row.external.forEach((record) => add(record)); continue; }
      if (row.status === 'same') {
        const record = clone(row.manual[0]);
        record.rawSources = { manual: clone(row.manual[0].raw || {}), external: clone(row.external[0].raw || {}) };
        add(record, ['manual', 'external']);
        records.at(-1).sourceReferences = { manual: row.manual[0].sourceId || row.manual[0].id, external: row.external[0].sourceId || row.external[0].id };
        continue;
      }
      const resolution = resolutions[row.key]; picks[row.key] = clone(resolution);
      if (resolution.mode === 'manual') { row.manual.forEach((record) => add(record)); continue; }
      if (resolution.mode === 'external') { row.external.forEach((record) => add(record)); continue; }
      if (resolution.mode === 'both') { [...row.manual, ...row.external].forEach((record) => add(record)); continue; }
      const manualRecord = row.manual[0]; const externalRecord = row.external[0];
      const combined = clone(manualRecord);
      const fields = ['branoId', 'title', 'course', 'level', 'week', 'season', 'instructor', 'date', 'registeredAt', 'activity', 'choreoLevel'];
      for (const field of fields) {
        const choice = resolution.fields?.[field];
        if (choice === 'external') combined[field] = externalRecord[field] ?? '';
        else if (choice === 'custom') combined[field] = field === 'week' ? Number(resolution.custom[field]) : resolution.custom[field];
        else if (choice === 'manual') combined[field] = manualRecord[field] ?? '';
      }
      combined.rawSources = { manual: clone(manualRecord.raw || {}), external: clone(externalRecord.raw || {}) };
      combined.sourceReferences = { manual: manualRecord.sourceId || manualRecord.id, external: externalRecord.sourceId || externalRecord.id };
      combined.id = `unified-${stableId(`${row.key}|${fingerprint(combined)}`)}`;
      combined.source = 'unified'; combined.provenance = ['manual', 'external'];
      records.push(combined);
    }
    return { ok: true, records, picks, previous: previous || null, rows };
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"external":null,"unified":null,"history":[],"manualBackups":[]}'); }
    catch { return { external: null, unified: null, history: [], manualBackups: [] }; }
  }
  function getActive() {
    try {
      const selected = localStorage.getItem(PREF_KEY);
      const imported = read().external;
      if (!localStorage.getItem(ACTIVE_MIGRATION_KEY)) {
        localStorage.setItem(ACTIVE_MIGRATION_KEY, '1');
        if (imported?.records?.length && (!selected || (selected === 'manual' && /google|apps script/i.test(imported.origin || '')))) {
          localStorage.setItem(PREF_KEY, 'external');
          return 'external';
        }
      }
      if (selected) return selected;
      return imported?.records?.length ? 'external' : 'manual';
    } catch { return 'manual'; }
  }
  function setActive(value) {
    if (!['manual', 'external', 'unified'].includes(value)) throw new Error('Archivio non riconosciuto.');
    localStorage.setItem(PREF_KEY, value); window.dispatchEvent(new CustomEvent('bordero:course-archive-changed', { detail: { archive: value } }));
  }
  function persistExternal(imported) {
    if (!imported.valid.length) throw new Error('Nessun record valido: l’ultima acquisizione resta invariata.');
    const state = read(); const timestamp = new Date().toISOString();
    const snapshot = { records: imported.valid, origin: imported.origin || 'CSV importato dall’operatore; fonte Google non verificata', acquiredAt: timestamp, status: 'imported', total: imported.total, rejected: imported.rejected, ambiguous: imported.ambiguous, delta: imported.delta || { added: [], removed: [], changed: [] } };
    state.history = [...(state.history || []), ...(state.external ? [{ savedAt: timestamp, external: state.external, unified: state.unified }] : [])].slice(-5);
    state.operations = [...(state.operations || []), { action: 'external-import', at: timestamp, records: imported.valid.length, rejected: imported.rejected.length, removed: snapshot.delta.removed.length, changed: snapshot.delta.changed.length, origin: snapshot.origin }].slice(-50);
    state.external = snapshot; localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setActive('external');
    localStorage.setItem(ACTIVE_MIGRATION_KEY, '1');
    window.dispatchEvent(new CustomEvent('bordero:course-archive-updated')); return snapshot;
  }
  function persistUnified(records, picks = {}) {
    const state = read(); const timestamp = new Date().toISOString();
    state.history = [...(state.history || []), ...(state.unified ? [{ savedAt: timestamp, external: state.external, unified: state.unified }] : [])].slice(-5);
    state.operations = [...(state.operations || []), { action: 'unified-save', at: timestamp, records: records.length }].slice(-50);
    state.unified = { records, picks, origin: 'Fusione locale Manuale + Esterno', acquiredAt: timestamp, status: 'saved' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); window.dispatchEvent(new CustomEvent('bordero:course-archive-updated')); return state.unified;
  }
  function backupManualSeason(season) {
    if (!season || !/^\d{4}-\d{4}$/.test(season.id || '')) throw new Error('Stagione manuale non valida: backup annullato.');
    const state = read(); const timestamp = new Date().toISOString();
    state.manualBackups = [...(state.manualBackups || []), { savedAt: timestamp, season: clone(season) }].slice(-5);
    state.operations = [...(state.operations || []), { action: 'manual-season-backup', at: timestamp, seasonId: season.id, records: season.records?.length || 0 }].slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('bordero:course-archive-updated'));
    return state.manualBackups.at(-1);
  }
  function restoreHistory(index) {
    const state = read(); const snapshot = state.history?.[Number(index)];
    if (!snapshot) throw new Error('Versione precedente non disponibile.');
    const current = { savedAt: new Date().toISOString(), external: state.external, unified: state.unified };
    state.external = snapshot.external || null;
    state.unified = snapshot.unified || null;
    state.history.splice(Number(index), 1);
    state.history.push(current);
    state.history = state.history.slice(-5);
    state.operations = [...(state.operations || []), { action: 'archive-restore', at: current.savedAt, versionAt: snapshot.savedAt }].slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('bordero:course-archive-updated'));
    return state;
  }
  function getRecords(archive, manualState) {
    if (archive === 'external') return read().external?.records || [];
    if (archive === 'unified') return read().unified?.records || [];
    return manualRecords(manualState);
  }
  async function readExternal() {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(EXTERNAL_EXEC_URL, { method: 'GET', mode: 'cors', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json,text/csv' } });
      if (!response.ok) throw new Error(`Fonte esterna non disponibile (HTTP ${response.status}).`);
      const text = await response.text();
      if (!text.trim()) throw new Error('La fonte esterna ha restituito una risposta vuota.');
      return text;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Timeout durante la lettura della fonte esterna.');
      throw new Error(`Lettura remota non verificabile: ${error.message}`);
    } finally { clearTimeout(timer); }
  }
  return { STORAGE_KEY, PREF_KEY, validateCsv, externalPayloadToCsv, manualRecords, compareExternalSnapshot, compare, merge, read, getActive, setActive, persistExternal, persistUnified, backupManualSeason, restoreHistory, getRecords, readExternal };
});

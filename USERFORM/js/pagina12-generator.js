(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CountrySetlistGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LEVELS = [
    { key: 'BASE', label: 'BASE' },
    { key: 'INTERMEDIO', label: 'INTERMEDIO' },
    { key: 'AVANZATO_1', label: 'AVANZATO 1' },
    { key: 'AVANZATO_2', label: 'AVANZATO 2' },
    { key: 'SUPERAVANZATO_1', label: 'SUPER AVANZATO 1' },
    { key: 'SUPERAVANZATO_2', label: 'SUPER AVANZATO 2' }
  ];
  const LEVEL_BY_KEY = Object.fromEntries(LEVELS.map((level, index) => [level.key, { ...level, priority: index + 1 }]));
  const OTHER_LEVEL_PATTERN = /^(ALTRE COREO|COREOGRAFIA|SUPER AVANZATO 3)$/;

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/SUPER(?=AVANZATO)/g, 'SUPER ')
      .replace(/SUPER\s*ADV/g, 'SUPER AVANZATO')
      .replace(/ADV(?=\s*\d)/g, 'AVANZATO')
      .replace(/([A-Z])(\d)/g, '$1 $2')
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeLevel(value) {
    const text = normalizeText(value);
    if (!text) return [];
    if (/\bBASE\b/.test(text)) return ['BASE'];
    if (/\bINTERMEDI(?:O|CO)\b/.test(text)) return ['INTERMEDIO'];

    const isSuper = /\bSUPER\b/.test(text);
    const isAdvanced = /\bAVANZATO\b/.test(text);
    if (!isAdvanced) return [];

    const hasOne = /\b1\b/.test(text);
    const hasTwo = /\b2\b/.test(text);
    if (isSuper) {
      if (hasOne && hasTwo) return ['SUPERAVANZATO_1', 'SUPERAVANZATO_2'];
      if (hasOne) return ['SUPERAVANZATO_1'];
      if (hasTwo) return ['SUPERAVANZATO_2'];
      return [];
    }
    if (hasOne && hasTwo) return ['AVANZATO_1', 'AVANZATO_2'];
    if (hasOne) return ['AVANZATO_1'];
    if (hasTwo) return ['AVANZATO_2'];
    return [];
  }

  function parseDuration(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value <= 0) return null;
      return Math.round(value > 100000 ? value / 1000 : value);
    }

    const text = String(value ?? '').trim();
    if (!text) return null;
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      const seconds = Number(text);
      return seconds > 0 ? Math.round(seconds > 100000 ? seconds / 1000 : seconds) : null;
    }

    const parts = text.split(':');
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      const minutes = Number(parts[0]);
      const seconds = Number(parts[1]);
      return seconds < 60 && (minutes > 0 || seconds > 0) ? minutes * 60 + seconds : null;
    }
    if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
      const [hours, minutes, seconds] = parts.map(Number);
      return minutes < 60 && seconds < 60 && (hours > 0 || minutes > 0 || seconds > 0)
        ? hours * 3600 + minutes * 60 + seconds
        : null;
    }
    return null;
  }

  function parseEventTime(value) {
    const match = String(value ?? '').trim().match(/^(\d{1,3}):([0-5]\d)$/);
    if (!match) return null;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60;
    return seconds > 0 ? seconds : null;
  }

  function formatDuration(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  function parseCsv(csv) {
    const text = String(csv ?? '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    if (rows.length < 2) return [];

    const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).map((values) => {
      const normalizedValues = values.slice();
      if (normalizedValues.length < headers.length) {
        while (normalizedValues.length < headers.length) normalizedValues.push('');
      } else if (normalizedValues.length > headers.length) {
        const lastIndex = headers.length - 1;
        normalizedValues[lastIndex] = normalizedValues.slice(lastIndex).join(',');
        normalizedValues.length = headers.length;
      }
      return Object.fromEntries(headers.map((header, index) => [header, (normalizedValues[index] || '').trim()]));
    });
  }

  function getField(record, ...names) {
    for (const name of names) {
      const value = record[name];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function getTrackIdentity(record) {
    const id = getField(record, 'id', 'ID');
    if (id) return `id:${id.toLocaleLowerCase('it-IT')}`;
    const parts = [record.coreografia, record.brano, record.autore]
      .map((value) => normalizeText(value))
      .filter(Boolean);
    return parts.length ? `fallback:${parts.join('|')}` : '';
  }

  function buildCatalog(csvOrRows) {
    const rows = Array.isArray(csvOrRows) ? csvOrRows : parseCsv(csvOrRows);
    const catalogByLevel = Object.fromEntries(LEVELS.map((level) => [level.key, []]));
    const tracks = [];
    const seen = new Set();
    let duplicates = 0;
    let invalidDurations = 0;
    let unknownLevels = 0;
    let otherLevels = 0;
    let missingLevels = 0;

    rows.forEach((row) => {
      const identity = getTrackIdentity(row);
      if (identity && seen.has(identity)) {
        duplicates += 1;
        return;
      }
      if (identity) seen.add(identity);

      const durationSeconds = parseDuration(getField(row, 'durata', 'duration'));
      if (durationSeconds === null) {
        invalidDurations += 1;
        return;
      }

      const levels = normalizeLevel(getField(row, 'info_livello', 'info livello', 'livello'));
      if (!levels.length) {
        const rawLevel = getField(row, 'info_livello', 'info livello', 'livello');
        const normalizedLevel = normalizeText(rawLevel);
        if (!rawLevel) missingLevels += 1;
        else if (OTHER_LEVEL_PATTERN.test(normalizedLevel)) otherLevels += 1;
        else unknownLevels += 1;
        return;
      }

      const track = {
        id: getField(row, 'id', 'ID') || identity,
        coreografia: getField(row, 'coreografia', 'titolo'),
        brano: getField(row, 'brano', 'song'),
        autore: getField(row, 'autore', 'artista', 'author'),
        durationSeconds,
        durationLabel: formatDuration(durationSeconds),
        levels,
        source: row
      };
      tracks.push(track);
      levels.forEach((level) => catalogByLevel[level].push(track));
    });

    return {
      catalogByLevel,
      tracks,
      stats: { sourceRows: rows.length, duplicates, invalidDurations, unknownLevels, otherLevels, missingLevels }
    };
  }

  function validateCounts(counts, durationSeconds) {
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return { errors: ['Inserire un tempo disponibile valido nel formato HH:MM.'] };
    }
    const errors = [];
    let requested = 0;
    LEVELS.forEach((level) => {
      const value = counts?.[level.key];
      if (!Number.isInteger(value) || value < 0) {
        errors.push(`Quantita ${level.label} non valida: usare un numero intero maggiore o uguale a zero.`);
      } else {
        requested += value;
      }
    });
    if (!errors.length && requested === 0) errors.push('Richiedere almeno un brano per livello.');
    return { errors, requested };
  }

  function shuffle(items, random) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function canFillOneCycle(catalogByLevel, counts, random) {
    const slots = [];
    LEVELS.forEach((level) => {
      for (let index = 0; index < counts[level.key]; index += 1) slots.push(level.key);
    });
    slots.sort((left, right) => catalogByLevel[left].length - catalogByLevel[right].length);

    const possibleTracks = new Set(slots.flatMap((key) => catalogByLevel[key].map((track) => track.id)));
    if (slots.length > possibleTracks.size) return false;

    const trackToSlot = new Map();
    function assign(slotIndex, visited) {
      const key = slots[slotIndex];
      const options = shuffle(catalogByLevel[key], random);
      for (const track of options) {
        if (visited.has(track.id)) continue;
        visited.add(track.id);
        const previousSlot = trackToSlot.get(track.id);
        if (previousSlot === undefined || assign(previousSlot, visited)) {
          trackToSlot.set(track.id, slotIndex);
          return true;
        }
      }
      return false;
    }

    return slots.every((_, index) => assign(index, new Set()));
  }

  function getInsufficiencyMessages(catalogByLevel, counts) {
    const messages = [];
    LEVELS.forEach((level) => {
      const requested = counts[level.key];
      const available = catalogByLevel[level.key].length;
      if (requested > available) {
        messages.push(`Brani ${level.label} insufficienti: richiesti ${requested}, disponibili ${available}.`);
      }
    });

    const superOne = counts.SUPERAVANZATO_1;
    const superTwo = counts.SUPERAVANZATO_2;
    const shared = catalogByLevel.SUPERAVANZATO_1.filter((track) => track.levels.includes('SUPERAVANZATO_2')).length;
    const exclusiveOne = catalogByLevel.SUPERAVANZATO_1.length - shared;
    const exclusiveTwo = catalogByLevel.SUPERAVANZATO_2.length - shared;
    const sharedNeeded = Math.max(0, superOne - exclusiveOne) + Math.max(0, superTwo - exclusiveTwo);
    if (sharedNeeded > shared) {
      messages.push(`Brani SUPER AVANZATO 1/2 insufficienti: richiesti ${superOne + superTwo} complessivi, disponibili ${exclusiveOne + exclusiveTwo + shared} senza duplicati.`);
    }
    return messages;
  }

  function chooseTrack(pool, used, remainingSeconds, previousArtist, random) {
    let candidates = pool.filter((track) => !used.has(track.id) && track.durationSeconds <= remainingSeconds);
    if (!candidates.length) return null;
    if (previousArtist) {
      const differentArtist = candidates.filter((track) => normalizeText(track.autore) !== previousArtist);
      if (differentArtist.length) candidates = differentArtist;
    }
    candidates.sort((left, right) => right.durationSeconds - left.durationSeconds);
    const shortlist = candidates.slice(0, Math.min(5, candidates.length));
    return shortlist[Math.floor(random() * shortlist.length)];
  }

  function proportionError(counts, selectedCounts) {
    const ratioTotal = LEVELS.reduce((total, level) => total + counts[level.key], 0);
    const selectedTotal = LEVELS.reduce((total, level) => total + selectedCounts[level.key], 0);
    if (!ratioTotal || !selectedTotal) return 0;
    return LEVELS.reduce((total, level) => {
      const expected = selectedTotal * counts[level.key] / ratioTotal;
      return total + Math.abs(selectedCounts[level.key] - expected);
    }, 0);
  }

  function completedCycles(counts, selectedCounts) {
    const active = LEVELS.filter((level) => counts[level.key] > 0);
    return active.length ? Math.min(...active.map((level) => Math.floor(selectedCounts[level.key] / counts[level.key]))) : 0;
  }

  function artistRepeats(tracks) {
    let repeats = 0;
    for (let index = 1; index < tracks.length; index += 1) {
      const current = normalizeText(tracks[index].autore);
      if (current && current === normalizeText(tracks[index - 1].autore)) repeats += 1;
    }
    return repeats;
  }

  function runSelection(catalogByLevel, counts, durationSeconds, random) {
    const used = new Set();
    const selected = [];
    const selectedCounts = Object.fromEntries(LEVELS.map((level) => [level.key, 0]));
    const previousArtistByLevel = Object.create(null);
    let totalDurationSeconds = 0;
    const maxCycles = Math.max(1, Object.values(catalogByLevel).reduce((max, pool) => Math.max(max, pool.length), 0));

    for (let cycle = 0; cycle < maxCycles; cycle += 1) {
      let addedThisCycle = 0;
      for (const level of LEVELS) {
        for (let index = 0; index < counts[level.key]; index += 1) {
          const remaining = durationSeconds - totalDurationSeconds;
          const track = chooseTrack(catalogByLevel[level.key], used, remaining, previousArtistByLevel[level.key], random);
          if (!track) continue;
          used.add(track.id);
          totalDurationSeconds += track.durationSeconds;
          selectedCounts[level.key] += 1;
          addedThisCycle += 1;
          previousArtistByLevel[level.key] = normalizeText(track.autore);
          selected.push({ ...track, level: level.key, cycle: cycle + 1 });
        }
      }
      if (!addedThisCycle || totalDurationSeconds >= durationSeconds) break;
    }

    selected.sort((left, right) => LEVEL_BY_KEY[left.level].priority - LEVEL_BY_KEY[right.level].priority
      || left.coreografia.localeCompare(right.coreografia, 'it', { sensitivity: 'base' })
      || left.id.localeCompare(right.id, 'it', { numeric: true }));

    return {
      tracks: selected,
      selectedCounts,
      totalDurationSeconds,
      fullCycles: completedCycles(counts, selectedCounts),
      ratioError: proportionError(counts, selectedCounts),
      artistRepeats: artistRepeats(selected)
    };
  }

  function isBetter(candidate, current) {
    if (!current) return true;
    if (candidate.fullCycles !== current.fullCycles) return candidate.fullCycles > current.fullCycles;
    if (Math.abs(candidate.ratioError - current.ratioError) > 0.0001) return candidate.ratioError < current.ratioError;
    if (candidate.totalDurationSeconds !== current.totalDurationSeconds) return candidate.totalDurationSeconds > current.totalDurationSeconds;
    return candidate.artistRepeats < current.artistRepeats;
  }

  function generateSetlist({ catalog, counts, durationSeconds, random = Math.random, attempts = 24 } = {}) {
    const validation = validateCounts(counts, durationSeconds);
    if (validation.errors.length) return { errors: validation.errors, warnings: [], tracks: [] };
    if (!catalog?.tracks?.length) return { errors: ['Il catalogo dei brani e vuoto o non valido.'], warnings: [], tracks: [] };

    const insufficiencies = getInsufficiencyMessages(catalog.catalogByLevel, counts);
    if (!canFillOneCycle(catalog.catalogByLevel, counts, random)) {
      if (!insufficiencies.length) insufficiencies.push('Catalogo insufficiente: non e possibile completare il ciclo richiesto senza riutilizzare brani.');
      return { errors: insufficiencies, warnings: [], tracks: [] };
    }

    let best = null;
    const totalAttempts = Math.max(1, Math.min(40, Number(attempts) || 1));
    for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
      const candidate = runSelection(catalog.catalogByLevel, counts, durationSeconds, random);
      if (isBetter(candidate, best)) best = candidate;
    }

    const warnings = [];
    if (catalog.stats.invalidDurations) warnings.push(`${catalog.stats.invalidDurations} brani con durata mancante o non valida esclusi dal catalogo.`);
    if (catalog.stats.unknownLevels) warnings.push(`${catalog.stats.unknownLevels} brani con livello non riconosciuto esclusi dal catalogo.`);
    if (catalog.stats.duplicates) warnings.push(`${catalog.stats.duplicates} righe duplicate escluse usando l'ID del brano.`);
    if (!best.tracks.length) warnings.push('Nessun brano entra nel tempo disponibile.');
    else if (best.totalDurationSeconds < durationSeconds) warnings.push('Tempo residuo: non esiste una combinazione compatibile piu vicina senza superare il limite e la proporzione richiesta.');

    return {
      errors: [],
      warnings,
      tracks: best.tracks.map(({ source, levels, cycle, ...track }) => ({ ...track })),
      levelCounts: best.selectedCounts,
      totalDurationSeconds: best.totalDurationSeconds,
      availableByLevel: Object.fromEntries(LEVELS.map((level) => [level.key, catalog.catalogByLevel[level.key].length])),
      stats: catalog.stats
    };
  }

  return {
    LEVELS,
    LEVEL_BY_KEY,
    normalizeLevel,
    parseDuration,
    parseEventTime,
    formatDuration,
    parseCsv,
    buildCatalog,
    validateCounts,
    generateSetlist
  };
});
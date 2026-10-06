(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DjPreselectionFile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FORMAT = 'bordero-dj-preselezione';
  const VERSION = 1;

  function safeFilePart(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 80);
  }

  function buildFileName({ dj, data, evento }) {
    const parts = [dj, data, evento].map(safeFilePart);
    if (parts.some((part) => !part)) {
      throw new Error('Inserire DJ, data evento e nome evento per salvare la scaletta.');
    }
    return `${parts.join('_')}.json`;
  }

  function normalizeCatalogLevel(value) {
    const raw = String(value ?? '').trim();
    const level = raw.toUpperCase()
      .replace(/SUPER(?=AVANZATO)/g, 'SUPER ')
      .replace(/ADV(?=\s*\d)/g, 'AVANZATO')
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (/^SUPER AVANZATO [12]$/.test(level) || level === 'SUPER AVANZATO 1 2') return 'SUPER AVANZATO 1+2';
    if (level === 'SUPER AVANZATO 3') return 'SUPER AVANZATO 3';
    if (level === 'ALTRE COREO') return 'ALTRE COREO';
    if (level === 'BASE') return 'BASE';
    if (level === 'INTERMEDIO' || level === 'INTERMEDICO') return 'INTERMEDIO';
    if (level === 'AVANZATO 1') return 'AVANZATO 1';
    if (level === 'AVANZATO 2') return 'AVANZATO 2';
    return raw;
  }

  function createPayload({ dj, data, evento, tracks, totalDurationSeconds }) {
    if (!Array.isArray(tracks) || !tracks.length) {
      throw new Error('Generare una scaletta prima di salvarla.');
    }
    const fileName = buildFileName({ dj, data, evento });
    const seen = new Set();
    const playlistTracks = tracks.map((track, index) => {
      const id = String(track?.id ?? '').trim();
      if (!id) throw new Error(`Il brano in posizione ${index + 1} non ha un ID valido.`);
      if (seen.has(id)) throw new Error(`ID brano duplicato nella scaletta: ${id}.`);
      seen.add(id);
      const level = normalizeCatalogLevel(track.levelLabel || track.level);
      const choreography = String(track.coreografia || track.titolo || '').trim();
      return {
        id,
        branoId: id,
        position: index + 1,
        deck: 1,
        brano: {
          id,
          titolo: choreography,
          coreografia: choreography,
          brano: String(track.brano || '').trim(),
          autore: String(track.autore || '').trim(),
          durata: String(track.durationLabel || track.durata || '').trim(),
          info_livello: level
        }
      };
    });

    return {
      format: FORMAT,
      version: VERSION,
      name: fileName.replace(/\.json$/i, ''),
      fileName,
      dj: String(dj).trim(),
      data: String(data).trim(),
      evento: String(evento).trim(),
      totalDurationSeconds: Math.max(0, Math.floor(Number(totalDurationSeconds) || 0)),
      tracks: playlistTracks
    };
  }

  function parseImport(input) {
    let payload = input;
    if (typeof input === 'string') {
      try {
        payload = JSON.parse(input.replace(/^\uFEFF/, ''));
      } catch {
        throw new Error('Il file non contiene JSON valido.');
      }
    }
    if (!payload || payload.format !== FORMAT || payload.version !== VERSION || !Array.isArray(payload.tracks)) {
      throw new Error('Formato file non riconosciuto: selezionare una scaletta esportata da SCALETTA.');
    }
    if (!payload.tracks.length) throw new Error('Il file non contiene brani da importare.');

    const seen = new Set();
    const tracks = [];
    let skipped = 0;
    payload.tracks.forEach((item) => {
      const brano = item?.brano && typeof item.brano === 'object' ? item.brano : item;
      const id = String(item?.branoId || item?.id || brano?.id || '').trim();
      if (!id || seen.has(id)) {
        skipped += 1;
        return;
      }
      seen.add(id);
      const importedTrack = { ...brano, id };
      const importedLevel = brano.info_livello || brano.livello;
      if (importedLevel) importedTrack.info_livello = normalizeCatalogLevel(importedLevel);
      tracks.push({
        id,
        branoId: id,
        deck: Number(item.deck) === 2 ? 2 : 1,
        brano: importedTrack
      });
    });
    if (!tracks.length) throw new Error('Il file non contiene brani con ID valido.');

    const name = String(payload.name || payload.fileName || 'Scaletta importata')
      .replace(/\.json$/i, '')
      .trim();
    return { name: name || 'Scaletta importata', tracks, skipped };
  }

  return { FORMAT, VERSION, safeFilePart, buildFileName, normalizeCatalogLevel, createPayload, parseImport };
});
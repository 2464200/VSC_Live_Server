/**
 * BORDERÒ - Elenco Richieste
 * Mostra solo i brani richiesti e permette di gestire lo stato eseguito.
 */

class ElencoRichiestePage {
  constructor() {
    this.brani = [];
    this.requested = [];
    this.serata = {};
    this.videoClipFiles = [];
    this.videoClipCatalog = [];
    this.videoClipAvailableMap = new Map();
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize();
      await this.refreshFromCurrentData();
      await this.refreshSyncDiagnostic();
      this.render();
      this.setupStorageSync();
      this.setupListeners();
    } catch (error) {
      logger.error('Errore inizializzazione ElencoRichiestePage', error);
      Toast.error('Errore caricamento elenco richieste: ' + error.message);
    }
  }

  async refreshFromCurrentData() {
    // Usa prima la cache aggiornata da Bordero (include eventuale sync Google),
    // poi fallback a loadBrani se la cache non e disponibile.
    const cachedBrani = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []);
    const latestBrani = Array.isArray(cachedBrani) && cachedBrani.length > 0
      ? dataLoader.normalizeBraniList(cachedBrani)
      : await dataLoader.loadBrani();

    const originalBrani = latestBrani.map((brano, index) => ({
      ...brano,
      originalIndex: index,
    }));

    const currentSerata = dataLoader.getCurrentSerata();
    if (currentSerata) {
      this.serata = currentSerata.metadata;

      if (Array.isArray(currentSerata.brani) && currentSerata.brani.length > 0) {
        const executedMap = new Map(currentSerata.brani.map((b) => [String(b.id), b]));
        this.brani = originalBrani.map((brano) => {
          const saved = executedMap.get(String(brano.id));
          if (saved && String(saved.flag || '').toUpperCase() === 'X') {
            return {
              ...brano,
              flag: 'X',
              timestamp: saved.timestamp || brano.timestamp,
            };
          }
          return brano;
        });
      } else {
        this.brani = originalBrani;
      }
    } else {
      this.brani = originalBrani;
    }

    await this.refreshVideoClipAvailability();
    this.applyVideoClipAvailabilityToBrani();

    this.requested = this.getUniqueRequestedBrani(this.brani);
  }

  isRichiesteZeroValue(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-') return true;

    const normalizedNumeric = text.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(normalizedNumeric)) {
      return Number(normalizedNumeric) === 0;
    }

    return false;
  }

  isExecutedBrano(brano) {
    return String(brano?.flag || '').toUpperCase() === 'X';
  }

  applyVideoClipAvailabilityToBrani() {
    const markerFor = (brano) => this.videoClipAvailableMap.has(String(brano?.id ?? '')) ? '🎬' : '';

    this.brani = this.brani.map((brano) => ({
      ...brano,
      videoclip: markerFor(brano)
    }));
  }

  async refreshVideoClipAvailability() {
    this.videoClipFiles = [];
    this.videoClipCatalog = [];
    this.videoClipAvailableMap = new Map();

    const attempts = [
      window.location.origin + '/api/videoclip/list',
      'http://localhost:5500/api/videoclip/list',
      'http://127.0.0.1:5500/api/videoclip/list',
      '/api/videoclip/list'
    ];

    for (const url of attempts) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (json && Array.isArray(json.files) && json.files.length > 0) {
          this.videoClipFiles = json.files
            .map(f => String(f || '').trim())
            .filter(Boolean);
          logger.info('Videoclip list ottenuta da', url, this.videoClipFiles.length);
          break;
        }
      } catch (err) {
        logger.debug('Video list fetch failed for', url, err.message || err);
      }
    }

    const basenames = this.videoClipFiles.map((f) => {
      const idx = f.lastIndexOf('.');
      return idx > 0 ? f.slice(0, idx) : f;
    });

    this.videoClipCatalog = this.videoClipFiles.map((fullName, index) => {
      const baseName = basenames[index] || fullName;
      const parsed = this.parseVideoFileReference(baseName);
      const normalizedName = this.normalizeForMatch(parsed.name || baseName);
      return {
        fullName,
        baseName,
        prefix: parsed.prefix || '',
        name: parsed.name || baseName,
        normalizedName,
        tokens: this.tokenizeForMatch(normalizedName)
      };
    });

    this.brani.forEach((brano) => {
      const matched = this.findMatchingVideoFile(brano);
      if (matched) this.videoClipAvailableMap.set(String(brano.id), matched);
    });
  }

  parseVideoFileReference(fileName) {
    const rawName = String(fileName || '').trim();
    if (!rawName) return { prefix: '', name: '' };

    const withoutExtension = rawName.replace(/\.[^.]+$/, '');
    const match = withoutExtension.match(/^(\d{3})[\s_-]+(.+)$/);

    if (match) {
      return {
        prefix: match[1],
        name: match[2].trim()
      };
    }

    return {
      prefix: '',
      name: withoutExtension
    };
  }

  normalizeForMatch(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    try {
      text = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (e) {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    return text
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenizeForMatch(normalizedText) {
    return String(normalizedText || '')
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length >= 2);
  }

  buildBranoMatchProfile(brano) {
    const idDigits = String(brano?.id ?? '').replace(/\D+/g, '');
    const idPrefix = idDigits ? idDigits.padStart(3, '0') : '';

    const rawNames = [
      brano?.coreografia,
      brano?.titolo,
      brano?.brano,
      brano?.song,
      brano?.canzone
    ].map(value => String(value || '').trim()).filter(Boolean);

    const normalizedNames = [...new Set(rawNames
      .map(name => this.normalizeForMatch(name))
      .filter(name => name.length >= 3))];

    const tokenSet = new Set();
    normalizedNames.forEach(name => {
      this.tokenizeForMatch(name).forEach(token => tokenSet.add(token));
    });

    return {
      idPrefix,
      normalizedNames,
      tokens: [...tokenSet]
    };
  }

  scoreVideoCandidate(profile, candidate) {
    let score = 0;

    const hasPrefix = Boolean(profile.idPrefix);
    if (hasPrefix && candidate.prefix === profile.idPrefix) {
      score += 1000;
    }

    if (profile.normalizedNames.includes(candidate.normalizedName)) {
      score += 450;
    }

    const includesName = profile.normalizedNames.some(name =>
      candidate.normalizedName.includes(name) || name.includes(candidate.normalizedName)
    );
    if (includesName) {
      score += 120;
    }

    if (profile.tokens.length > 0 && candidate.tokens.length > 0) {
      const shared = candidate.tokens.filter(token => profile.tokens.includes(token)).length;
      const ratio = shared / Math.max(profile.tokens.length, candidate.tokens.length);
      score += Math.round(ratio * 100);
    }

    return score;
  }

  findMatchingVideoFile(brano) {
    if (!Array.isArray(this.videoClipCatalog) || this.videoClipCatalog.length === 0) return null;

    const profile = this.buildBranoMatchProfile(brano);
    const hasNames = profile.normalizedNames.length > 0;

    let pool = this.videoClipCatalog;
    if (profile.idPrefix) {
      const byPrefix = this.videoClipCatalog.filter(item => item.prefix === profile.idPrefix);
      if (byPrefix.length > 0) {
        pool = byPrefix;
      }
    }

    const scored = pool
      .map(item => ({ item, score: this.scoreVideoCandidate(profile, item) }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score <= 0) {
      return null;
    }

    const best = scored[0];
    const second = scored[1];

    if (profile.idPrefix && pool.length > 1 && hasNames) {
      const ambiguous = second && (best.score - second.score) < 80;
      if (ambiguous) {
        logger.warn('Match videoclip ambiguo: prefisso ID duplicato senza differenza significativa', {
          branoId: brano?.id,
          best: best.item.fullName,
          second: second.item.fullName,
          bestScore: best.score,
          secondScore: second.score
        });
        return null;
      }
    }

    if (!profile.idPrefix) {
      const exactNameMatches = scored.filter(entry => profile.normalizedNames.includes(entry.item.normalizedName));
      if (exactNameMatches.length === 1) {
        return exactNameMatches[0].item.fullName;
      }

      if (exactNameMatches.length > 1) {
        logger.warn('Match videoclip ambiguo: titolo coincide con più file senza prefisso ID', {
          branoId: brano?.id,
          matches: exactNameMatches.map(entry => entry.item.fullName)
        });
        return null;
      }

      if (best.score < 260) {
        return null;
      }
    }

    return best.item.fullName;
  }

  getUniqueRequestedBrani(collection = []) {
    const uniqueById = new Map();

    collection.forEach((brano) => {
      if (!brano || this.isRichiesteZeroValue(brano.richieste)) return;
      const key = String(brano.id ?? '').trim();
      if (!key || uniqueById.has(key)) return;
      uniqueById.set(key, brano);
    });

    return [...uniqueById.values()];
  }

  render() {
    this.updateSerataMeta();
    this.updateStats();
    this.renderSyncDiagnostic();
    this.renderRequested();
  }

  async refreshSyncDiagnostic() {
    this.syncDiagnostic = null;

    const endpoints = [
      '/api/bordero/sync-google/status',
      'http://localhost:5500/api/bordero/sync-google/status',
      'http://127.0.0.1:5500/api/bordero/sync-google/status',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        const state = payload?.state;
        const results = Array.isArray(state?.lastSummary?.results) ? state.lastSummary.results : [];
        const accoda = results.find((item) => String(item?.sheet || '').toLowerCase() === 'accoda 8+12');
        const diag = accoda?.richiesteDiagnostics;

        if (!diag) continue;

        this.syncDiagnostic = {
          syncedAt: state?.lastSummary?.syncedAt || state?.lastCompletedAt || '',
          totalResponseRows: Number(diag.totalResponseRows || 0),
          skippedTestRows: Number(diag.skippedTestRows || 0),
          effectiveResponseRows: Number(diag.effectiveResponseRows || 0),
        };
        return;
      } catch (error) {
        logger.debug('Sync diagnostic endpoint non disponibile', { endpoint, error: error?.message || error });
      }
    }
  }

  renderSyncDiagnostic() {
    const el = document.getElementById('sync-diagnostic');
    if (!el) return;

    const diag = this.syncDiagnostic;
    if (!diag || !diag.totalResponseRows) {
      el.hidden = true;
      el.textContent = '';
      return;
    }

    const when = diag.syncedAt
      ? `, sync ${DateUtils.formatDate(diag.syncedAt)}`
      : '';

    el.textContent = `Diagnostica richieste: ${diag.totalResponseRows} righe, escluse test ${diag.skippedTestRows}, effettive ${diag.effectiveResponseRows}${when}`;
    el.hidden = false;
  }

  updateSerataMeta() {
    document.getElementById('info-dj').textContent = this.serata.dj || '--';
    document.getElementById('info-data').textContent = this.serata.data || '--';
    document.getElementById('info-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('info-evento').textContent = this.serata.evento || '--';
  }

  updateStats() {
    const totalRequested = this.requested.length;
    const executedRequested = this.requested.filter((b) => this.isExecutedBrano(b)).length;
    const percent = totalRequested > 0 ? Math.round((executedRequested / totalRequested) * 100) : 0;

    document.getElementById('stat-richieste').textContent = totalRequested;
    document.getElementById('stat-executed').textContent = executedRequested;
    document.getElementById('stat-percent').textContent = `${percent}%`;
  }

  renderRequested() {
    const tbody = document.getElementById('richieste-tbody');
    const empty = document.getElementById('empty-richieste');
    const count = document.getElementById('richieste-count');

    if (!tbody || !empty || !count) return;

    if (this.requested.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      count.textContent = '0 brani unici';
      return;
    }

    empty.style.display = 'none';
    count.textContent = `${this.requested.length} brani unici`;

    tbody.innerHTML = this.requested
      .map((brano, index) => {
        const isExecuted = this.isExecutedBrano(brano);
        const titolo = brano.titolo || brano.coreografia || brano.brano || '--';
        const statoClass = isExecuted ? 'executed-status' : 'pending-status';
        const statoLabel = isExecuted ? 'Eseguito' : 'Da eseguire';
        const videoButtonDisabledClass = isExecuted ? ' is-disabled' : '';
        const videoButtonDisabledAttr = isExecuted ? ' disabled aria-disabled="true" tabindex="-1"' : '';
        const videoButtonTitle = isExecuted ? 'Brano eseguito: VideoClip non disponibile' : 'Apri VideoClip';
        const videoClipMarker = brano.videoclip
          ? `<button type="button" class="videoclip-open${videoButtonDisabledClass}" data-brano-id="${brano.id}" aria-label="Apri VideoClip per ${String(brano.titolo || brano.id || 'brano')}" title="${videoButtonTitle}"${videoButtonDisabledAttr}>🎬</button>`
          : '-';

        return `
          <tr class="requested-row" data-brano-id="${brano.id}">
            <td class="col-number">${index + 1}</td>
            <td class="col-titolo">${titolo}</td>
            <td class="col-autore">${brano.autore || '--'}</td>
            <td class="col-richieste">${brano.richieste || '--'}</td>
            <td class="col-coreografo">${brano.coreografo || '--'}</td>
            <td class="col-timestamp">${brano.timestamp || '--'}</td>
            <td>
              <span class="action-inline ${statoClass}" aria-live="polite">
                ${isExecuted ? '✅' : '⬜'} ${statoLabel}
              </span>
            </td>
            <td class="col-videoclip">${videoClipMarker}</td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.videoclip-open').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled || button.classList.contains('is-disabled')) {
          return;
        }
        const branoId = button.dataset.branoId;
        if (!branoId) return;
        window.location.href = `videoclip.html?branoId=${encodeURIComponent(String(branoId))}`;
      });
    });
  }

  setupStorageSync() {
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      if (event.key !== BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA && event.key !== BORDERO_CONFIG.CACHE_KEY_BRANI) return;

      logger.info('Storage event: aggiornamento dati Bordero rilevato (elenco richieste)');
      this.refreshFromCurrentData()
        .then(async () => {
          await this.refreshSyncDiagnostic();
          this.render();
          Toast.info('Elenco richieste aggiornato dalla sessione');
        })
        .catch((error) => {
          logger.error('Errore aggiornamento elenco richieste da storage event', error);
        });
    });
  }

  setupListeners() {
    document.getElementById('btn-bordero')?.addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.elencoRichiestePage = new ElencoRichiestePage();
});

logger.info('✓ ElencoRichieste.js caricato');

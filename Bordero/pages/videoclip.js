/**
 * BORDERÒ - VideoClip Manager Logic
 * Gestione video per coreografie
 */

class VideoClipManager {
  constructor() {
    this.brani = [];
    this.currentBrano = null;
    this.filteredBrani = [];
    this.availableFiles = []; // elenco file presenti nella cartella locale
    this.availableMap = new Map(); // id -> filename

    this.init();
  }

  async init() {
    logger.info('VideoClipManager initializing...');

    try {
      this.brani = await dataLoader.loadBrani();
      this.filteredBrani = [...this.brani];

      // Fetch lista file videoclip dal server di sync (try multiple fallbacks)
      this.availableFiles = [];
      const attempts = [
        'http://localhost:5501/api/videoclip/list',
        window.location.origin.replace(/:\d+$/, '') + ':5501/api/videoclip/list',
        '/api/videoclip/list'
      ];
      for (const url of attempts) {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok) continue;
          const json = await resp.json();
          if (json && Array.isArray(json.files) && json.files.length > 0) {
            this.availableFiles = json.files.map(f => String(f || '').toLowerCase());
            logger.info('Videoclip list ottenuta da', url, this.availableFiles.length);
            break;
          }
        } catch (err) {
          logger.debug('Video list fetch failed for', url, err.message || err);
          continue;
        }
      }

      // Pre-costruisci mappa di corrispondenza brano -> file (se trovato)
      this.availableMap = new Map();
      // also build basenames list (without extension) for better matching
      this.availableBasenames = this.availableFiles.map(f => {
        const idx = f.lastIndexOf('.');
        return idx > 0 ? f.slice(0, idx) : f;
      });

      this.brani.forEach(brano => {
        const matched = this.findMatchingVideoFile(brano);
        if (matched) this.availableMap.set(String(brano.id), matched);
      });

      this.renderLibrary();
      this.populateGenreFilter();
      this.setupListeners();

      logger.info('✓ VideoClipManager inizializzato');
    } catch (error) {
      logger.error('Errore inizializzazione', error);
    }
  }

  populateGenreFilter() {
    const genreSet = new Set(this.brani.map(b => b.genere).filter(Boolean));
    const genreSelect = document.getElementById('genere-filter');

    Array.from(genreSet).sort().forEach(genere => {
      const option = document.createElement('option');
      option.value = genere;
      option.textContent = genere;
      genreSelect.appendChild(option);
    });
  }

  renderLibrary() {
    const container = document.getElementById('videos-list');
    container.innerHTML = '';

    this.filteredBrani.forEach(brano => {
      const card = document.createElement('div');
      card.className = 'video-card';
      const matchedFile = this.availableMap.get(String(brano.id)) || null;
      const isAvailable = Boolean(matchedFile);
      if (this.currentBrano?.id === brano.id) {
        card.classList.add('active');
      }
      if (isAvailable) {
        card.classList.add('available');
      } else {
        card.classList.add('unavailable');
      }

      card.innerHTML = `
        <div class="video-card-thumb">🎬</div>
        <div class="video-card-content">
          <div class="video-card-title">${this.escapeHtml(brano.titolo)}</div>
          <div class="video-card-meta">
            <span>👤 ${this.escapeHtml(brano.autore || 'Sconosciuto')}</span>
            <span>🎭 ${this.escapeHtml(brano.coreografo || 'Sconosciuto')}</span>
            <span>🎵 ${this.escapeHtml(brano.genere || 'Sconosciuto')}</span>
          </div>
          <div class="video-card-action">
            <button class="btn btn-primary btn-small" data-id="${brano.id}" ${isAvailable ? '' : 'disabled'}>${isAvailable ? 'SELEZIONA' : 'NON DISPONIBILE'}</button>
          </div>
        </div>
      `;

      if (isAvailable) {
        card.addEventListener('click', () => this.selectBrano(brano));
      } else {
        // non selezionabile: disable only the button
        const btn = card.querySelector('button');
        if (btn) btn.disabled = true;
        card.style.opacity = '0.85';
      }

      container.appendChild(card);
    });

    if (this.filteredBrani.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">Nessun video trovato</div>';
    }
  }

  selectBrano(brano) {
    this.currentBrano = brano;
    this.updatePlayerInfo();
    this.renderLibrary();
  }

  updatePlayerInfo() {
    if (!this.currentBrano) {
      document.getElementById('no-video').classList.remove('hidden');
      document.getElementById('main-video').classList.add('hidden');
      return;
    }

    document.getElementById('no-video').classList.add('hidden');
    document.getElementById('main-video').classList.remove('hidden');

    document.getElementById('video-title').textContent = this.currentBrano.titolo || '--';
    document.getElementById('video-autore').innerHTML = `<strong>Autore:</strong> ${this.escapeHtml(this.currentBrano.autore || '--')}`;
    document.getElementById('video-coreo').innerHTML = `<strong>Coreografo:</strong> ${this.escapeHtml(this.currentBrano.coreografo || '--')}`;
    document.getElementById('video-genere').innerHTML = `<strong>Genere:</strong> ${this.escapeHtml(this.currentBrano.genere || '--')}`;

    // TODO: Set video source when actual video files are available
    const matchedFile = this.availableMap.get(String(this.currentBrano.id));
    if (matchedFile) {
      try {
        const syncOrigin = (window.location.protocol + '//' + window.location.hostname + ':5501').replace('://:','://localhost:');
        const url = syncOrigin + '/videos/' + encodeURIComponent(matchedFile);
        document.getElementById('video-source').src = url;
        document.getElementById('main-video').load();
      } catch (err) {
        logger.warn('Errore impostando sorgente video', err);
      }
    } else {
      document.getElementById('video-source').src = '';
      document.getElementById('main-video').load();
    }
  }

  /**
   * Cerca un file video corrispondente al brano nella lista this.availableFiles
   * Regole: cerca file contenente l'id oppure una versione normalizzata del titolo
   */
  findMatchingVideoFile(brano) {
    if (!Array.isArray(this.availableFiles) || this.availableFiles.length === 0) return null;
    const idStr = String(brano.id || '').toLowerCase().trim();
    const title = String(brano.titolo || brano.brano || '').toLowerCase().trim();

    const normalize = (s) => {
      if (!s) return '';
      try {
        // remove diacritics
        s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      } catch (e) {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
      return s.replace(/[^a-z0-9]+/g, ' ').trim();
    };

    // 1) match by id present in filename or basename
    if (idStr) {
      for (let i = 0; i < this.availableFiles.length; i++) {
        const f = this.availableFiles[i];
        const base = this.availableBasenames[i] || f;
        if (f.includes(idStr) || base.includes(idStr)) return this.availableFiles[i];
        // also check digits-only id match
        const digits = idStr.replace(/\D+/g, '');
        if (digits && (f.includes(digits) || base.includes(digits))) return this.availableFiles[i];
      }
    }

    // 2) match by normalized title against filename/basename
    const nTitle = normalize(title);
    if (nTitle) {
      for (let i = 0; i < this.availableFiles.length; i++) {
        const f = this.availableFiles[i];
        const base = this.availableBasenames[i] || f;
        const nf = normalize(base);
        if (!nf) continue;
        if (nf.includes(nTitle) || nTitle.includes(nf)) return this.availableFiles[i];
      }
    }

    return null;
  }

  setupListeners() {
    // Search
    document.getElementById('video-search').addEventListener('input', (e) => {
      this.filterVideos();
    });

    // Genre filter
    document.getElementById('genere-filter').addEventListener('change', (e) => {
      this.filterVideos();
    });

    // Player controls
    document.getElementById('btn-play').addEventListener('click', () => {
      if (this.currentBrano) {
        document.getElementById('main-video').play();
      }
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      if (this.currentBrano) {
        document.getElementById('main-video').pause();
      }
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      if (this.currentBrano) {
        const video = document.getElementById('main-video');
        video.pause();
        video.currentTime = 0;
      }
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      const video = document.getElementById('main-video');
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    });

    // Navigation
    document.getElementById('btn-back').addEventListener('click', () => {
      window.history.back();
    });

    document.getElementById('btn-bordero').addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }

  filterVideos() {
    const searchTerm = document.getElementById('video-search').value.toLowerCase();
    const genreFilter = document.getElementById('genere-filter').value;

    this.filteredBrani = this.brani.filter(brano => {
      const matchSearch = !searchTerm ||
        brano.titolo.toLowerCase().includes(searchTerm) ||
        (brano.autore && brano.autore.toLowerCase().includes(searchTerm)) ||
        (brano.coreografo && brano.coreografo.toLowerCase().includes(searchTerm));

      const matchGenre = !genreFilter || brano.genere === genreFilter;

      return matchSearch && matchGenre;
    });

    this.renderLibrary();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.videoClipManager = new VideoClipManager();
});

logger.info('✓ Videoclip.js caricato');

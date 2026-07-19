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
    this.videoCatalog = []; // metadati normalizzati dei file video
    this.availableMap = new Map(); // id -> filename
    this.isReloading = false;
    this.secondaryVideoUrl = '';
    this.currentVideoUrl = '';
    this.currentPlaybackBranoId = null;
    this.showOnlyAvailable = false;
    this.vlcPath = '';
    this.vlcFallbackActive = false;
    this.pendingBranoId = this.getRequestedBranoIdFromUrl();
    this.lastVlcCompletionEventId = 0;
    this.vlcCompletionWatcherTimer = null;
    this.vlcWasAlive = false;
    this.manualStopPending = false;

    this.init();
  }

  async init() {
    logger.info('VideoClipManager initializing...');

    try {
      this.brani = await dataLoader.loadBrani();
      this.syncExecutedState();
      this.filteredBrani = [...this.brani];

      await this.refreshAvailableFiles();

      this.renderLibrary();
      this.populateGenreFilter();
      this.setupListeners();
      this.setupMainVideoDebugIndicator();
      this.applyPendingBranoSelection();
      this.startVlcCompletionWatcher();

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

  isBranoExecuted(brano) {
    return brano && (
      brano.flag === 'X' ||
      brano.flag === 'x' ||
      brano.eseguito === true ||
      brano.eseguito === 'X' ||
      brano.eseguito === 'x' ||
      brano.executed === true ||
      brano.executed === 'X' ||
      brano.executed === 'x'
    );
  }

  async refreshAvailableFiles() {
    this.availableFiles = [];
    this.videoCatalog = [];
    this.availableMap = new Map();

    const attempts = [
      'http://localhost:5500/api/videoclip/list',
      'http://127.0.0.1:5500/api/videoclip/list',
      window.location.origin + '/api/videoclip/list',
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
          this.availableFiles = json.files
            .map(f => String(f || '').trim())
            .filter(Boolean);
          logger.info('Videoclip list ottenuta da', url, this.availableFiles.length);
          break;
        }
      } catch (err) {
        logger.debug('Video list fetch failed for', url, err.message || err);
        continue;
      }
    }

    this.availableBasenames = this.availableFiles.map(f => {
      const idx = f.lastIndexOf('.');
      return idx > 0 ? f.slice(0, idx) : f;
    });

    this.videoCatalog = this.availableFiles.map((fullName, index) => {
      const baseName = this.availableBasenames[index] || fullName;
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

    this.brani.forEach(brano => {
      const matched = this.findMatchingVideoFile(brano);
      if (matched) this.availableMap.set(String(brano.id), matched);
    });

    return this.availableFiles;
  }

  syncExecutedState() {
    const currentSerata = dataLoader.getCurrentSerata?.();
    if (!currentSerata || !Array.isArray(currentSerata.brani)) {
      return false;
    }

    const serataMap = new Map();
    currentSerata.brani.forEach(item => {
      if (item && item.id !== null && item.id !== undefined) {
        serataMap.set(String(item.id), item);
      }
    });

    let changed = false;
    this.brani = this.brani.map(brano => {
      const serataBrano = serataMap.get(String(brano.id));
      const isExecutedInSerata = Boolean(
        serataBrano && (
          serataBrano.flag === 'X' ||
          serataBrano.flag === 'x' ||
          serataBrano.eseguito === true ||
          serataBrano.eseguito === 'X' ||
          serataBrano.eseguito === 'x' ||
          serataBrano.executed === true ||
          serataBrano.executed === 'X' ||
          serataBrano.executed === 'x'
        )
      );

      if (isExecutedInSerata && !this.isBranoExecuted(brano)) {
        changed = true;
        return { ...brano, flag: 'X', timestamp: serataBrano.timestamp || brano.timestamp };
      }

      return brano;
    });

    this.filteredBrani = [...this.brani];
    return changed;
  }

  renderLibrary() {
    const container = document.getElementById('videos-list');
    if (!container) return;
    container.innerHTML = '';

    this.updateArchiveFilterButton();

    this.filteredBrani.forEach(brano => {
      const card = document.createElement('div');
      card.className = 'video-card';
      const matchedFile = this.availableMap.get(String(brano.id)) || null;
      const isAvailable = Boolean(matchedFile);
      const isExecuted = this.isBranoExecuted(brano);
      if (this.showOnlyAvailable && (!isAvailable || isExecuted)) {
        return;
      }
      if (this.currentBrano?.id === brano.id) {
        card.classList.add('active');
      }
      if (isExecuted) {
        card.classList.add('executed');
      } else if (isAvailable) {
        card.classList.add('available');
      } else {
        card.classList.add('unavailable');
      }
      card.dataset.available = isExecuted || isAvailable ? 'false' : 'false';
      card.setAttribute('aria-disabled', isExecuted || !isAvailable ? 'true' : 'false');

      const tooltipText = isExecuted
        ? 'Brano già eseguito nella serata'
        : (matchedFile ? `Video associato: ${matchedFile}` : 'Nessun video associato');

      card.innerHTML = `
        <div class="video-card-thumb">🎬</div>
        <div class="video-card-content">
          <div class="video-card-title">${this.escapeHtml(brano.titolo)}</div>
          <div class="video-card-meta">
            <span>👤 ${this.escapeHtml(brano.autore || 'Sconosciuto')}</span>
            <span>🎭 ${this.escapeHtml(brano.coreografo || 'Sconosciuto')}</span>
            <span>🎵 ${this.escapeHtml(brano.genere || 'Sconosciuto')}</span>
          </div>
          <div class="video-card-badge ${isExecuted ? 'executed' : (isAvailable ? 'available' : 'unavailable')}" title="${this.escapeHtml(tooltipText)}">
            ${isExecuted ? '⚠ VIDEO GIA\' ESEGUITO' : (isAvailable ? '✓ VIDEO DISPONIBILE' : '✕ VIDEO NON DISPONIBILE')}
          </div>
          <div class="video-card-file" title="${this.escapeHtml(matchedFile || 'Nessun file video')}">
            ${matchedFile ? `📁 ${this.escapeHtml(matchedFile)}` : '📁 Nessun file video'}
          </div>
          <div class="video-card-action">
            <button class="btn btn-primary btn-small" data-id="${brano.id}" ${isExecuted || !isAvailable ? 'disabled' : ''}>${isExecuted ? 'GIÀ ESEGUITO' : (isAvailable ? 'SELEZIONA' : 'NON DISPONIBILE')}</button>
          </div>
        </div>
      `;

      if (!isExecuted && isAvailable) {
        const btn = card.querySelector('button');
        btn?.addEventListener('click', (event) => {
          event.stopPropagation();
          this.selectBrano(brano);
        });
        card.addEventListener('click', () => this.selectBrano(brano));
      } else {
        const btn = card.querySelector('button');
        if (btn) btn.disabled = true;
        card.style.cursor = 'default';
        card.style.opacity = '0.9';
      }

      container.appendChild(card);
    });

    if (this.filteredBrani.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">Nessun video trovato</div>';
    }
  }

  selectBrano(brano) {
    return this.selectBranoWithOptions(brano, { allowExecuted: false, scrollBehavior: 'smooth' });
  }

  selectBranoWithOptions(brano, options = {}) {
    const { allowExecuted = false, scrollBehavior = 'smooth' } = options;
    if (this.isBranoExecuted(brano)) {
      if (!allowExecuted) {
        return false;
      }
    }

    this.currentBrano = brano;
    this.updatePlayerInfo();
    this.renderLibrary();

    // Porta subito il player in vista dopo la selezione di una card.
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : scrollBehavior });
    return true;
  }

  getRequestedBranoIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const value = String(params.get('branoId') || '').trim();
      return value || null;
    } catch (error) {
      logger.debug('Impossibile leggere branoId dalla URL', error);
      return null;
    }
  }

  applyPendingBranoSelection() {
    if (!this.pendingBranoId) return;

    const target = this.brani.find((item) => String(item.id) === String(this.pendingBranoId));
    if (!target) {
      this.pendingBranoId = null;
      return;
    }

    const selected = this.selectBranoWithOptions(target, { allowExecuted: true, scrollBehavior: 'auto' });
    this.pendingBranoId = null;

    if (selected) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('branoId');
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      } catch (error) {
        logger.debug('Impossibile pulire branoId dalla URL', error);
      }
    }
  }

  waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async launchVlcFallback(url) {
    const host = window.location.hostname || 'localhost';
    const candidates = [
      '/api/videoclip/play-secondary',
      `${window.location.protocol}//${host}:5500/api/videoclip/play-secondary`,
      'http://localhost:5500/api/videoclip/play-secondary'
    ];

    const retryDelays = [0, 250, 700];

    for (const endpoint of candidates) {
      for (const delay of retryDelays) {
        if (delay > 0) {
          await this.waitMs(delay);
        }

        try {
          const requestUrl = `${endpoint}?url=${encodeURIComponent(url)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(requestUrl, { cache: 'no-store', signal: controller.signal });
          clearTimeout(timer);

          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload?.success) {
            this.vlcFallbackActive = true;
            logger.debug('VLC fallback avviato da endpoint', { endpoint, delay });
            return true;
          }

          logger.warn('Endpoint VLC fallback non riuscito', {
            endpoint,
            delay,
            status: response.status,
            payload
          });
        } catch (err) {
          logger.warn('Errore endpoint VLC fallback', {
            endpoint,
            delay,
            error: err?.message || err
          });
        }
      }
    }

    this.vlcFallbackActive = false;
    return false;
  }


  loadSecondaryVideo(url) {
    // Monitor secondario usa VLC: non è necessario precaricare
    // I file verranno aperti direttamente da VLC quando richiesto
    this.secondaryVideoUrl = url;
    logger.debug('Secondary video URL set (will use VLC for playback)');
  }

  setMainVideoSource(url) {
    const mainVideo = document.getElementById('main-video');
    const source = document.getElementById('video-source');

    if (!mainVideo || !source) return;

    source.src = url || '';
    mainVideo.src = url || '';
    this.updateMainVideoDebugIndicator('source-updated');
  }

  async playMainVideo() {
    const mainVideo = document.getElementById('main-video');
    const url = this.currentVideoUrl || this.getCurrentVideoUrl();

    if (!mainVideo || !url) return;

    const sameBrano = this.currentPlaybackBranoId === this.currentBrano?.id;
    if (sameBrano && !mainVideo.paused && mainVideo.currentTime > 0) {
      return;
    }

    try {
      mainVideo.pause();
      mainVideo.currentTime = 0;
      mainVideo.muted = true;
      this.setMainVideoSource(url);
      mainVideo.load();
      await this.waitForVideoReady(mainVideo);
      await mainVideo.play();
      mainVideo.muted = false;
      this.currentPlaybackBranoId = this.currentBrano?.id ?? null;
      this.updateMainVideoDebugIndicator('playing');
    } catch (playErr) {
      logger.warn('Main video play blocked by browser policy', playErr);
      try {
        mainVideo.muted = true;
        this.setMainVideoSource(url);
        mainVideo.load();
        await this.waitForVideoReady(mainVideo);
        await mainVideo.play();
        mainVideo.muted = false;
        this.updateMainVideoDebugIndicator('playing-muted-fallback');
      } catch (fallbackErr) {
        logger.debug('Main video fallback play failed', fallbackErr);
        this.updateMainVideoDebugIndicator('play-error');
      }
    }
  }

  pauseMainVideo() {
    const mainVideo = document.getElementById('main-video');
    if (!mainVideo) return;

    if (!mainVideo.paused) {
      mainVideo.pause();
    }
    this.updateMainVideoDebugIndicator('paused');
  }

  stopMainVideo() {
    const mainVideo = document.getElementById('main-video');
    if (!mainVideo) return;

    mainVideo.pause();
    mainVideo.currentTime = 0;
    this.updateMainVideoDebugIndicator('stopped');
  }

  async playSecondaryVideo() {
    const url = this.currentVideoUrl || this.getCurrentVideoUrl();
    const playbackStatus = document.getElementById('secondary-playback-status');
    if (!url) {
      logger.debug('No video URL for secondary playback');
      if (playbackStatus) {
        playbackStatus.textContent = 'Nessun video selezionato per il monitor secondario.';
      }
      return;
    }

    // Monitor secondario: SOLO VLC, niente popup HTML5
    try {
      logger.debug('Launching/controlling VLC for secondary display');
      const response = await fetch('/api/videoclip/vlc/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', url }),
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      const success = Boolean(response.ok && payload?.success);
      if (success) {
        this.currentPlaybackBranoId = this.currentBrano?.id ?? null;
        logger.info('✓ VLC avviato sul monitor secondario');
        if (playbackStatus) {
          playbackStatus.textContent = payload.mode === 'resume'
            ? 'Monitor secondario: VLC in riproduzione (resume).'
            : 'Monitor secondario: VLC in riproduzione.';
        }
      } else {
        // fallback legacy endpoint
        const fallback = await this.launchVlcFallback(url);
        if (!fallback) {
          logger.warn('Impossibile avviare VLC sul monitor secondario', payload);
          if (playbackStatus) {
            playbackStatus.textContent = 'Errore avvio VLC sul monitor secondario. Verifica server porta 5500 e installazione VLC.';
          }
        } else if (playbackStatus) {
          playbackStatus.textContent = 'Monitor secondario: VLC in riproduzione (fallback).';
        }
      }
    } catch (err) {
      logger.warn('Errore avviando VLC per monitor secondario', err);
      if (playbackStatus) {
        playbackStatus.textContent = 'Errore durante l\'avvio VLC sul monitor secondario.';
      }
    }
  }

  async pauseSecondaryVideo() {
    const playbackStatus = document.getElementById('secondary-playback-status');
    try {
      const response = await fetch('/api/videoclip/vlc/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success) {
        if (playbackStatus) {
          playbackStatus.textContent = 'Monitor secondario: VLC in pausa/ripresa.';
        }
      } else if (playbackStatus) {
        playbackStatus.textContent = 'Monitor secondario: pausa VLC non riuscita.';
      }
    } catch (err) {
      logger.warn('Errore pausa VLC secondario', err);
      if (playbackStatus) {
        playbackStatus.textContent = 'Errore durante la pausa VLC sul monitor secondario.';
      }
    }
  }

  async stopSecondaryVideo() {
    const playbackStatus = document.getElementById('secondary-playback-status');
    try {
      const response = await fetch('/api/videoclip/vlc/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success) {
        if (playbackStatus) {
          playbackStatus.textContent = 'Monitor secondario: VLC fermato.';
        }
      } else if (playbackStatus) {
        playbackStatus.textContent = 'Monitor secondario: stop VLC non riuscito.';
      }
    } catch (err) {
      logger.warn('Errore stop VLC secondario', err);
      if (playbackStatus) {
        playbackStatus.textContent = 'Errore durante lo stop VLC sul monitor secondario.';
      }
    }
  }

  fullscreenSecondaryVideo() {
    // Monitor secondario usa VLC: VLC gestisce il fullscreen automaticamente
    logger.debug('Fullscreen sul monitor secondario - VLC è già a schermo intero');
  }

  getCurrentVideoUrl() {
    if (this.currentVideoUrl) {
      return this.currentVideoUrl;
    }

    if (!this.currentBrano) {
      return '';
    }

    const matchedFile = this.availableMap.get(String(this.currentBrano.id));
    if (!matchedFile) {
      return '';
    }

    // Use relative URL to avoid ORB cross-origin blocking (serve da Unified Server 5500)
    return '/videos/' + encodeURIComponent(matchedFile);
  }

  async waitForVideoReady(video) {
    if (!video) return;

    if (video.readyState >= 2 || video.networkState === 2) {
      return;
    }

    await new Promise((resolve) => {
      const handleReady = () => {
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('loadedmetadata', handleReady);
        resolve();
      };
      video.addEventListener('canplay', handleReady, { once: true });
      video.addEventListener('loadedmetadata', handleReady, { once: true });
      setTimeout(handleReady, 700);
    });
  }

  updatePlayerInfo() {
    if (!this.currentBrano) {
      const noVideo = document.getElementById('no-video');
      const mainVideo = document.getElementById('main-video');
      noVideo?.classList.remove('hidden');
      mainVideo?.classList.add('hidden');
      this.updateMainVideoDebugIndicator('no-selection');
      return;
    }

    document.getElementById('no-video')?.classList.add('hidden');
    document.getElementById('main-video')?.classList.remove('hidden');

    document.getElementById('video-title').textContent = this.currentBrano.titolo || '--';
    document.getElementById('video-autore').innerHTML = `<strong>Autore:</strong> ${this.escapeHtml(this.currentBrano.autore || '--')}`;
    document.getElementById('video-coreo').innerHTML = `<strong>Coreografo:</strong> ${this.escapeHtml(this.currentBrano.coreografo || '--')}`;
    document.getElementById('video-genere').innerHTML = `<strong>Genere:</strong> ${this.escapeHtml(this.currentBrano.genere || '--')}`;

    const matchedFile = this.availableMap.get(String(this.currentBrano.id));
    const noVideo = document.getElementById('no-video');
    const mainVideo = document.getElementById('main-video');
    const playbackStatus = document.getElementById('secondary-playback-status');

    if (matchedFile) {
      try {
        // Use relative URL to avoid ORB cross-origin blocking
        const url = '/videos/' + encodeURIComponent(matchedFile);
        this.currentVideoUrl = url;
        this.secondaryVideoUrl = url;
        if (mainVideo) {
          this.setMainVideoSource(url);
          mainVideo.pause();
          mainVideo.currentTime = 0;
          mainVideo.load();
          mainVideo.classList.remove('hidden');
        }
        noVideo?.classList.add('hidden');
        if (playbackStatus) {
          playbackStatus.textContent = 'Video pronto: monitor principale HTML5, monitor secondario via VLC.';
        }
        this.loadSecondaryVideo(url);
        this.updateMainVideoDebugIndicator('ready');
      } catch (err) {
        logger.warn('Errore impostando sorgente video', err);
        this.updateMainVideoDebugIndicator('ready-error');
      }
    } else {
      this.setMainVideoSource('');
      mainVideo?.load();
      mainVideo?.pause();
      noVideo?.classList.remove('hidden');
      if (playbackStatus) {
        playbackStatus.textContent = 'Nessun video disponibile per il monitor secondario.';
      }
      noVideo.innerHTML = '<p>Nessun video selezionato</p><small>Non è stato trovato un file video associato a questo brano.</small>';
      this.updateMainVideoDebugIndicator('no-video-file');
    }
  }

  setupMainVideoDebugIndicator() {
    const mainVideo = document.getElementById('main-video');
    if (!mainVideo) return;

    const events = ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'stalled', 'waiting', 'suspend', 'ended', 'error'];
    events.forEach((evt) => {
      mainVideo.addEventListener(evt, () => this.updateMainVideoDebugIndicator(evt));
    });

    this.updateMainVideoDebugIndicator('initialized');
  }

  updateMainVideoDebugIndicator(stateLabel = 'updated') {
    const mainVideo = document.getElementById('main-video');
    const stateEl = document.getElementById('dbg-html5-state');
    const readyEl = document.getElementById('dbg-html5-ready');
    const errorEl = document.getElementById('dbg-html5-error');
    const srcEl = document.getElementById('dbg-html5-src');

    if (!mainVideo || !stateEl || !readyEl || !errorEl || !srcEl) return;

    const src = mainVideo.currentSrc || mainVideo.src || document.getElementById('video-source')?.src || '';
    stateEl.textContent = String(stateLabel || 'updated');
    readyEl.textContent = String(mainVideo.readyState ?? 0);
    errorEl.textContent = String(mainVideo.error?.code ?? 0);
    srcEl.textContent = src ? src : '--';
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

  /**
   * Cerca un file video corrispondente al brano nella lista this.availableFiles.
   * I file video hanno formato: 3 cifre + spazio + nome coreografia.
   */
  findMatchingVideoFile(brano) {
    if (!Array.isArray(this.videoCatalog) || this.videoCatalog.length === 0) return null;

    const profile = this.buildBranoMatchProfile(brano);
    const hasNames = profile.normalizedNames.length > 0;

    let pool = this.videoCatalog;
    if (profile.idPrefix) {
      const byPrefix = this.videoCatalog.filter(item => item.prefix === profile.idPrefix);
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
        logger.warn('Match ambiguo: prefisso ID duplicato senza differenza significativa', {
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
        logger.warn('Match ambiguo: titolo coincide con più file senza prefisso ID', {
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

  setupListeners() {
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key !== BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA) return;
      this.handleSerataChange();
    });

    window.addEventListener('bordero:serata-updated', () => {
      this.handleSerataChange();
    });

    window.addEventListener('pageshow', () => {
      this.handleSerataChange();
    });

    window.addEventListener('focus', () => {
      this.handleSerataChange();
    });

    window.addEventListener('beforeunload', () => {
      if (this.vlcCompletionWatcherTimer) {
        clearInterval(this.vlcCompletionWatcherTimer);
        this.vlcCompletionWatcherTimer = null;
      }
    });

    const searchInput = document.getElementById('video-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterVideos();
      });
    }

    const genreSelect = document.getElementById('genere-filter');
    if (genreSelect) {
      genreSelect.addEventListener('change', () => {
        this.filterVideos();
      });
    }

    const archiveToggle = document.getElementById('btn-only-archive');
    archiveToggle?.addEventListener('click', () => {
      this.showOnlyAvailable = !this.showOnlyAvailable;
      this.updateArchiveFilterButton();
      this.filterVideos();
    });

    // Player controls
    const playButton = document.getElementById('btn-play');
    if (playButton) {
      playButton.onclick = async (event) => {
        if (!this.currentBrano) {
          logger.warn('[PLAY] No currentBrano selected');
          return;
        }
        const url = this.currentVideoUrl || this.getCurrentVideoUrl();
        if (!url) {
          logger.warn('[PLAY] No video URL');
          return;
        }

        try {
          event.preventDefault();
          event.stopPropagation();
          logger.debug('[PLAY] Starting main playback via playMainVideo()');
          await this.playMainVideo();
          logger.debug('[PLAY] Main playback initiated');
        } catch (playErr) {
          logger.warn('[PLAY] Error:', playErr.message || playErr);
        }

        // Play secondary video in parallel (don't wait for completion)
        this.playSecondaryVideo().catch(err => logger.warn('[PLAY] Secondary video error', err));
      };
    }

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.pauseMainVideo();
      this.pauseSecondaryVideo();
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      this.manualStopPending = true;
      this.stopMainVideo();
      this.stopSecondaryVideo();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.fullscreenSecondaryVideo();
    });

    // Navigation
    document.getElementById('btn-back').addEventListener('click', () => {
      window.history.back();
    });

    document.getElementById('btn-bordero').addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }

  handleSerataChange() {
    this.syncExecutedState();
    this.refreshAvailableFiles()
      .then(() => {
        this.renderLibrary();
        this.updatePlayerInfo();
      })
      .catch(() => {
        this.renderLibrary();
      });
  }

  startVlcCompletionWatcher() {
    if (this.vlcCompletionWatcherTimer) {
      clearInterval(this.vlcCompletionWatcherTimer);
    }

    this.vlcCompletionWatcherTimer = setInterval(() => {
      this.pollVlcCompletion().catch((error) => {
        logger.debug('VLC completion poll failed', error?.message || error);
      });
    }, 1500);
  }

  async pollVlcCompletion() {
    const response = await fetch('/api/videoclip/vlc/state', { cache: 'no-store' });
    if (!response.ok) return;

    const payload = await response.json().catch(() => null);
    if (!payload || !payload.success) return;

    const alive = Boolean(payload.alive);
    const completion = payload.completion || {};
    const eventId = Number(completion.eventId || 0);
    let handledByCompletionEvent = false;

    if (eventId && eventId > this.lastVlcCompletionEventId) {
      this.lastVlcCompletionEventId = eventId;
      this.handleVlcCompletionEvent(completion);
      handledByCompletionEvent = true;
    }

    // Fallback robusto: se VLC termina senza evento completion mappabile,
    // usa il brano in riproduzione corrente (a meno che sia stato stop manuale).
    if (this.vlcWasAlive && !alive && !handledByCompletionEvent) {
      if (this.manualStopPending) {
        this.manualStopPending = false;
      } else {
        this.handleVlcCompletionEvent(completion || {});
      }
    }

    this.vlcWasAlive = alive;
  }

  handleVlcCompletionEvent(completion) {
    const fileName = String(completion?.fileName || '').trim();
    const filePath = String(completion?.filePath || '').trim();
    const normalizedFileName = this.normalizeCompletionFileName(fileName || filePath);

    const brano = this.findBranoForCompletion(normalizedFileName);
    if (!brano) {
      logger.warn('Completamento VLC ricevuto ma nessun brano associato', { fileName, filePath });
      return;
    }
    if (this.isBranoExecuted(brano)) return;

    this.markBranoExecutedFromVideoEnd(brano);
  }

  normalizeCompletionFileName(value) {
    const text = String(value || '').trim().replace(/\\/g, '/');
    if (!text) return '';
    const lastSegment = text.split('/').pop() || text;
    return decodeURIComponent(lastSegment).trim().toLowerCase();
  }

  findBranoForCompletion(normalizedFileName) {
    if (!normalizedFileName) {
      const fallback = this.currentPlaybackBranoId || this.currentBrano?.id;
      if (!fallback) return null;
      return this.brani.find((item) => String(item.id) === String(fallback)) || null;
    }

    const byMatchedFile = this.brani.find((item) => {
      const matched = this.availableMap.get(String(item.id));
      const normalizedMatched = this.normalizeCompletionFileName(matched);
      return normalizedMatched && normalizedMatched === normalizedFileName;
    });
    if (byMatchedFile) return byMatchedFile;

    const prefixMatch = normalizedFileName.match(/^(\d{3})[\s_-]/);
    if (prefixMatch) {
      const expectedId = String(Number(prefixMatch[1]));
      const byPrefix = this.brani.find((item) => String(Number(item.id)) === expectedId);
      if (byPrefix) return byPrefix;
    }

    const fallback = this.currentPlaybackBranoId || this.currentBrano?.id;
    if (!fallback) return null;
    return this.brani.find((item) => String(item.id) === String(fallback)) || null;
  }

  markBranoExecutedFromVideoEnd(brano) {
    const targetId = String(brano.id);
    const nowTimestamp = DateUtils.formatDate(new Date());

    this.brani = this.brani.map((item) => {
      if (String(item.id) !== targetId) return item;
      return {
        ...item,
        flag: 'X',
        timestamp: nowTimestamp
      };
    });

    this.filteredBrani = this.filteredBrani.map((item) => {
      if (String(item.id) !== targetId) return item;
      return {
        ...item,
        flag: 'X',
        timestamp: nowTimestamp
      };
    });

    if (this.currentBrano && String(this.currentBrano.id) === targetId) {
      this.currentBrano = {
        ...this.currentBrano,
        flag: 'X',
        timestamp: nowTimestamp
      };
    }

    const currentSerata = dataLoader.getCurrentSerata?.() || {};
    const metadata = currentSerata.metadata || {};
    dataLoader.saveCurrentSerata(metadata, this.brani);

    try {
      window.dispatchEvent(new Event('bordero:serata-updated'));
    } catch (error) {
      logger.debug('Impossibile dispatchare evento bordero:serata-updated', error);
    }

    this.filterVideos();
    this.updatePlayerInfo();
    Toast.success(`Brano marcato eseguito dopo fine video: ${brano.titolo || brano.id}`);
  }

  updateArchiveFilterButton() {
    const button = document.getElementById('btn-only-archive');
    if (!button) return;
    button.classList.toggle('active', this.showOnlyAvailable);
    button.setAttribute('aria-pressed', String(this.showOnlyAvailable));
  }

  filterVideos() {
    const searchInput = document.getElementById('video-search');
    const genreSelect = document.getElementById('genere-filter');
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const genreFilter = genreSelect?.value || '';

    this.filteredBrani = this.brani.filter(brano => {
      const title = String(brano.titolo || '').toLowerCase();
      const author = String(brano.autore || '').toLowerCase();
      const choreographer = String(brano.coreografo || '').toLowerCase();
      const matchSearch = !searchTerm ||
        title.includes(searchTerm) ||
        author.includes(searchTerm) ||
        choreographer.includes(searchTerm);

      const matchGenre = !genreFilter || brano.genere === genreFilter;
      const matchedFile = this.availableMap.get(String(brano.id)) || null;
      const isAvailable = Boolean(matchedFile);
      const isExecuted = this.isBranoExecuted(brano);
      const matchArchiveFilter = !this.showOnlyAvailable || (isAvailable && !isExecuted);

      return matchSearch && matchGenre && matchArchiveFilter;
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
  const playButton = document.getElementById('btn-play');
  if (playButton && !playButton.onclick) {
    playButton.onclick = async (event) => {
      if (!window.videoClipManager?.currentBrano) return;
      const mainVideo = document.getElementById('main-video');
      const url = window.videoClipManager.currentVideoUrl || window.videoClipManager.getCurrentVideoUrl();
      if (!mainVideo || !url) return;
      try {
        event.preventDefault();
        event.stopPropagation();
        mainVideo.pause();
        mainVideo.currentTime = 0;
        mainVideo.muted = false;
        mainVideo.src = url;
        mainVideo.load();
        await new Promise(resolve => setTimeout(resolve, 1200));
        await mainVideo.play();
        window.videoClipManager.currentPlaybackBranoId = window.videoClipManager.currentBrano?.id ?? null;
      } catch (playErr) {
        logger.warn('PLAY button play failed', playErr);
      }
      await window.videoClipManager.playSecondaryVideo();
    };
  }
});

logger.info('✓ Videoclip.js caricato');

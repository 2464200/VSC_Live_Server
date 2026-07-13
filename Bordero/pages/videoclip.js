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
    this.isReloading = false;
    this.secondaryWindow = null;
    this.secondaryVideoUrl = '';
    this.currentVideoUrl = '';
    this.currentPlaybackBranoId = null;
    this.showOnlyAvailable = false;
    this.vlcPath = '';
    this.vlcFallbackActive = false;

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
          this.availableFiles = json.files.map(f => String(f || '').toLowerCase());
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
    if (this.isBranoExecuted(brano)) {
      return;
    }
    this.currentBrano = brano;
    this.updatePlayerInfo();
    this.renderLibrary();
  }

  async launchVlcFallback(url) {
    try {
      const response = await fetch('/api/videoclip/play-secondary?url=' + encodeURIComponent(url), { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      this.vlcFallbackActive = Boolean(payload.success);
      return Boolean(payload.success);
    } catch (err) {
      logger.warn('Impossibile avviare VLC fallback', err);
      return false;
    }
  }

  ensureSecondaryWindow() {
    if (this.secondaryWindow && !this.secondaryWindow.closed) {
      return this.secondaryWindow;
    }

    const popup = window.open('', 'bordero-secondary-video', 'width=1280,height=720,left=40,top=40,toolbar=no,location=no,status=no,menubar=no,resizable=yes');
    if (!popup) {
      return null;
    }

    this.secondaryWindow = popup;
    popup.document.write(`<!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Borderò - Monitor sala da ballo</title>
        <style>
          html, body { margin: 0; height: 100%; background: #000; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
          body { display: grid; place-items: center; }
          .player-shell { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }
          video { width: 100%; max-width: 100%; max-height: 100%; background: #000; object-fit: contain; }
          .overlay { position: absolute; top: 16px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; gap: 12px; }
          .badge { background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 999px; font-size: 0.95rem; backdrop-filter: blur(6px); max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .badge.now-playing { max-width: 100%; }
          .placeholder { text-align: center; color: #bbb; font-size: 1.2em; max-width: 720px; }
        </style>
      </head>
      <body>
        <div class="player-shell">
          <div class="overlay">
            <div class="badge">Monitor sala da ballo</div>
            <div class="badge now-playing" id="secondary-now-playing">Nessun brano in riproduzione</div>
            <div class="badge" id="secondary-status">Video pronto</div>
          </div>
          <video id="secondary-video" playsinline preload="auto" controls></video>
          <div class="placeholder">Seleziona un brano e premi PLAY per avviare il video per i ballerini.</div>
        </div>
      </body>
      </html>`);
    popup.document.close();
    return popup;
  }

  loadSecondaryVideo(url) {
    const popup = this.ensureSecondaryWindow();
    if (!popup) return;

    try {
      const video = popup.document.getElementById('secondary-video');
      if (!video) return;
      this.currentVideoUrl = url;
      this.secondaryVideoUrl = url;
      if (video.getAttribute('src') !== url) {
        video.setAttribute('src', url);
      }
      video.load();
      video.pause();
      video.currentTime = 0;
      const status = popup.document.getElementById('secondary-status');
      const nowPlaying = popup.document.getElementById('secondary-now-playing');
      if (status) status.textContent = 'Video pronto';
      if (nowPlaying) {
        const title = this.currentBrano?.titolo || 'Nessun brano selezionato';
        nowPlaying.textContent = title;
      }
    } catch (err) {
      logger.warn('Errore caricando video sul monitor secondario', err);
    }
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
      mainVideo.src = url;
      mainVideo.load();
      await this.waitForVideoReady(mainVideo);
      await mainVideo.play();
      mainVideo.muted = false;
      this.currentPlaybackBranoId = this.currentBrano?.id ?? null;
    } catch (playErr) {
      logger.warn('Main video play blocked by browser policy', playErr);
      try {
        mainVideo.muted = true;
        mainVideo.src = url;
        mainVideo.load();
        await this.waitForVideoReady(mainVideo);
        await mainVideo.play();
        mainVideo.muted = false;
      } catch (fallbackErr) {
        logger.debug('Main video fallback play failed', fallbackErr);
      }
    }
  }

  async playSecondaryVideo() {
    const popup = this.ensureSecondaryWindow();
    const url = this.currentVideoUrl || this.getCurrentVideoUrl();
    if (!url) return;

    try {
      const video = popup?.document?.getElementById('secondary-video');
      if (!video) {
        await this.launchVlcFallback(url);
        return;
      }

      const sameBrano = this.currentPlaybackBranoId === this.currentBrano?.id;
      if (sameBrano && !video.paused && video.currentTime > 0) {
        return;
      }

      this.secondaryVideoUrl = url;
      video.src = url;
      video.pause();
      video.currentTime = 0;
      video.load();

      const status = popup.document.getElementById('secondary-status');
      const nowPlaying = popup.document.getElementById('secondary-now-playing');
      if (status) status.textContent = 'Riproduzione avviata';
      if (nowPlaying) {
        const title = this.currentBrano?.titolo || 'Nessun brano selezionato';
        nowPlaying.textContent = title;
      }
      // Commented out: popup.focus(); might interfere with main video playback
      // popup.focus();
      await this.waitForVideoReady(video);
      try {
        await video.play();
      } catch (playErr) {
        logger.debug('Secondary video play deferred', playErr);
        await this.launchVlcFallback(url);
      }
      this.currentPlaybackBranoId = this.currentBrano?.id ?? null;
    } catch (err) {
      logger.warn('Errore avviando playback sul monitor secondario', err);
      await this.launchVlcFallback(url);
    }
  }

  pauseSecondaryVideo() {
    const popup = this.secondaryWindow;
    if (!popup || popup.closed) return;
    try {
      const video = popup.document.getElementById('secondary-video');
      video?.pause();
    } catch (err) {
      logger.warn('Errore pausa playback sul monitor secondario', err);
    }
  }

  stopSecondaryVideo() {
    const popup = this.secondaryWindow;
    if (!popup || popup.closed) return;
    try {
      const video = popup.document.getElementById('secondary-video');
      if (!video) return;
      video.pause();
      video.currentTime = 0;
    } catch (err) {
      logger.warn('Errore stop playback sul monitor secondario', err);
    }
  }

  fullscreenSecondaryVideo() {
    const popup = this.secondaryWindow;
    if (!popup || popup.closed) return;
    try {
      const video = popup.document.getElementById('secondary-video');
      if (video?.requestFullscreen) {
        video.requestFullscreen();
      }
    } catch (err) {
      logger.warn('Errore fullscreen playback sul monitor secondario', err);
    }
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
    const source = document.getElementById('video-source');
    const playbackStatus = document.getElementById('secondary-playback-status');

    if (matchedFile) {
      try {
        // Use relative URL to avoid ORB cross-origin blocking
        const url = '/videos/' + encodeURIComponent(matchedFile);
        this.currentVideoUrl = url;
        this.secondaryVideoUrl = url;
        source.src = url;
        if (mainVideo) {
          mainVideo.pause();
          mainVideo.currentTime = 0;
          mainVideo.load();
          mainVideo.classList.remove('hidden');
        }
        noVideo?.classList.add('hidden');
        if (playbackStatus) {
          playbackStatus.textContent = 'Video pronto: il playback parte sia sulla pagina sia sul monitor secondario.';
        }
        this.loadSecondaryVideo(url);
      } catch (err) {
        logger.warn('Errore impostando sorgente video', err);
      }
    } else {
      source.src = '';
      mainVideo?.load();
      mainVideo?.pause();
      noVideo?.classList.remove('hidden');
      if (playbackStatus) {
        playbackStatus.textContent = 'Nessun video disponibile per il monitor secondario.';
      }
      noVideo.innerHTML = '<p>Nessun video selezionato</p><small>Non è stato trovato un file video associato a questo brano.</small>';
    }
  }

  parseVideoFileReference(fileName) {
    const rawName = String(fileName || '').trim();
    if (!rawName) return { prefix: '', name: '' };

    const withoutExtension = rawName.replace(/\.[^.]+$/, '');
    const match = withoutExtension.match(/^(\d{3})\s+(.+)$/);

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

  /**
   * Cerca un file video corrispondente al brano nella lista this.availableFiles.
   * I file video hanno formato: 3 cifre + spazio + nome coreografia.
   */
  findMatchingVideoFile(brano) {
    if (!Array.isArray(this.availableFiles) || this.availableFiles.length === 0) return null;

    const normalize = (s) => {
      if (!s) return '';
      try {
        s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      } catch (e) {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
      return s.replace(/[^a-z0-9]+/g, ' ').trim().toLowerCase();
    };

    const candidates = [
      brano.id,
      brano.coreografia,
      brano.titolo,
      brano.brano,
      brano.song,
      brano.canzone
    ].filter(value => value !== null && value !== undefined && String(value).trim());

    for (const candidate of candidates) {
      const candidateText = String(candidate).trim();
      const candidateDigits = candidateText.replace(/\D+/g, '');
      const candidatePrefix = candidateDigits ? candidateDigits.padStart(3, '0') : '';
      const normalizedCandidate = normalize(candidateText);

      for (let i = 0; i < this.availableFiles.length; i++) {
        const fullName = this.availableFiles[i];
        const baseName = this.availableBasenames[i] || fullName;
        const parsedFull = this.parseVideoFileReference(fullName);
        const parsedBase = this.parseVideoFileReference(baseName);

        const prefixMatch = Boolean(
          candidatePrefix &&
          (parsedFull.prefix === candidatePrefix || parsedBase.prefix === candidatePrefix)
        );

        const titleMatch = Boolean(
          normalizedCandidate &&
          (
            normalize(parsedFull.name) === normalizedCandidate ||
            normalize(parsedBase.name) === normalizedCandidate ||
            normalize(parsedFull.name).includes(normalizedCandidate) ||
            normalize(parsedBase.name).includes(normalizedCandidate) ||
            normalizedCandidate.includes(normalize(parsedFull.name)) ||
            normalizedCandidate.includes(normalize(parsedBase.name))
          )
        );

        if (prefixMatch || (titleMatch && normalizedCandidate.length >= 4)) {
          return fullName;
        }
      }
    }

    return null;
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
        const mainVideo = document.getElementById('main-video');
        const url = this.currentVideoUrl || this.getCurrentVideoUrl();
        if (!mainVideo || !url) {
          logger.warn('[PLAY] No video element or URL');
          return;
        }

        try {
          event.preventDefault();
          event.stopPropagation();
          logger.debug('[PLAY] Starting playback');
          
          // Reset and load
          mainVideo.src = url;
          mainVideo.currentTime = 0;
          mainVideo.muted = false;
          
          // Wait very briefly for metadata then play immediately
          mainVideo.load();
          
          // Try to play immediately without waiting
          logger.debug('[PLAY] Calling play() immediately');
          const playPromise = mainVideo.play();
          if (playPromise !== undefined) {
            await playPromise;
            logger.debug('[PLAY] play() Promise resolved');
          }
          
          this.currentPlaybackBranoId = this.currentBrano?.id ?? null;
          logger.debug('[PLAY] Playback initiated');
        } catch (playErr) {
          logger.warn('[PLAY] Error:', playErr.message || playErr);
        }

        // Play secondary video in parallel (don't wait for completion)
        this.playSecondaryVideo().catch(err => logger.warn('[PLAY] Secondary video error', err));
      };
    }

    document.getElementById('btn-pause').addEventListener('click', () => {
      if (this.currentBrano) {
        this.pauseSecondaryVideo();
      }
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      if (this.currentBrano) {
        this.stopSecondaryVideo();
      }
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

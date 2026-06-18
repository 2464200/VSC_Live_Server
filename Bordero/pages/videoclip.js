/**
 * BORDERÒ - VideoClip Manager Logic
 * Gestione video per coreografie
 */

class VideoClipManager {
  constructor() {
    this.brani = [];
    this.currentBrano = null;
    this.filteredBrani = [];

    this.init();
  }

  async init() {
    logger.info('VideoClipManager initializing...');

    try {
      this.brani = await dataLoader.loadBrani();
      this.filteredBrani = [...this.brani];

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
      if (this.currentBrano?.id === brano.id) {
        card.classList.add('active');
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
            <button class="btn btn-primary btn-small" data-id="${brano.id}">SELEZIONA</button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.selectBrano(brano));
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
    // document.getElementById('video-source').src = `/videos/${this.currentBrano.id}.mp4`;
    // document.getElementById('main-video').load();
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

class BraniNascostiPage {
  constructor() {
    this.brani = [];
    this.serata = {};
    this.hidden = [];
    this.refreshInProgress = false;
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize();
      await this.refresh();
      this.setupSync();
      document.getElementById('btn-bordero')?.addEventListener('click', () => { window.location.href = 'bordero.html'; });
    } catch (error) {
      logger.error('Errore inizializzazione brani nascosti', error);
      Toast.error('Errore caricamento brani nascosti: ' + error.message);
    }
  }

  async refresh() {
    if (this.refreshInProgress) return;
    this.refreshInProgress = true;

    try {
      this.brani = await dataLoader.loadBrani({ silent: true });
      const currentSerata = dataLoader.getCurrentSerata();
      if (currentSerata) {
        this.serata = currentSerata.metadata || {};
        if (Array.isArray(currentSerata.brani) && currentSerata.brani.length) {
          const saved = new Map(currentSerata.brani.map((item) => [String(item.id), item]));
          this.brani = this.brani.map((item) => ({ ...item, ...(saved.get(String(item.id)) || {}) }));
        }
      }
      const selection = Storage.get('bordero_next_coreo_selection', null);
      const selectedId = String(selection?.id || '').trim();
      this.brani.forEach((item) => {
        item.next_selected = selectedId !== '' && String(item.id) === selectedId;
      });
      this.hidden = getHiddenBraniByTitle(this.brani, { isExecuted: this.isExecuted.bind(this) });
      this.render();
    } finally {
      this.refreshInProgress = false;
    }
  }

  isExecuted(brano) { return String(brano?.flag || '').toUpperCase() === 'X'; }
  titleOf(brano) { return brano.titolo || brano.coreografia || brano.brano || '--'; }

  render() {
    ['dj', 'data', 'luogo', 'evento'].forEach((field) => {
      const element = document.getElementById(`info-${field}`);
      if (element) element.textContent = this.serata[field] || '--';
    });
    document.getElementById('stat-hidden').textContent = this.hidden.length;
    document.getElementById('hidden-count').textContent = `${this.hidden.length} brani`;
    const titles = new Set(this.hidden.map((item) => String(this.titleOf(item)).trim().toLowerCase())).size;
    document.getElementById('stat-titles').textContent = titles;

    const tbody = document.getElementById('hidden-tbody');
    const empty = document.getElementById('empty-hidden');
    empty.style.display = this.hidden.length ? 'none' : 'block';
    tbody.innerHTML = this.hidden.map((brano, index) => {
      const videoclip = brano.videoclip ? `<a class="video-link" href="videoclip.html?branoId=${encodeURIComponent(String(brano.id))}">🎬</a>` : '-';
      return `<tr><td>${index + 1}</td><td>${this.escape(brano.id)}</td><td>${this.escape(this.titleOf(brano))}</td><td>${this.escape(brano.autore || '--')}</td><td>${this.escape(brano.coreografo || '--')}</td><td class="status-cell"><label class="action-inline"><input type="checkbox" class="checkbox-restore" data-brano-id="${this.escape(brano.id)}" /> Ripristina disponibilità</label></td><td class="video-cell">${videoclip}</td></tr>`;
    }).join('');
    tbody.querySelectorAll('.checkbox-restore').forEach((checkbox) => checkbox.addEventListener('change', () => this.restoreAvailability(checkbox.dataset.branoId)));
  }

  restoreAvailability(id) {
    const brano = this.brani.find((item) => String(item.id) === String(id));
    if (!brano || this.isExecuted(brano)) return;
    this.brani.forEach((item) => { item.next_selected = false; });
    brano.next_selected = true;
    brano.flag = '';
    brano.timestamp = '';
    Storage.set('bordero_next_coreo_selection', { id: String(brano.id), title: this.titleOf(brano), nextValue: this.titleOf(brano), timestamp: Date.now() });
    this.persist();
    Toast.success(`Brano pronto per NEXT: ${this.titleOf(brano)}`);
    window.location.href = 'bordero.html';
  }

  persist() {
    dataLoader.saveCurrentSerata(this.serata, this.brani);
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
    window.dispatchEvent(new Event('bordero:serata-updated'));
  }

  setupSync() {
    const sync = () => this.refresh().catch((error) => logger.error('Errore aggiornamento brani nascosti', error));
    window.addEventListener('storage', (event) => { if (event.key === BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA) sync(); });
    window.addEventListener('bordero:serata-updated', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  }

  escape(value) { return String(value ?? '--').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
}

document.addEventListener('DOMContentLoaded', () => { window.braniNascostiPage = new BraniNascostiPage(); });

class BraniNascostiPage {
  constructor() {
    this.brani = [];
    this.serata = {};
    this.hidden = [];
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
    this.brani = await dataLoader.loadBrani({ silent: true });
    const currentSerata = dataLoader.getCurrentSerata();
    if (currentSerata) {
      this.serata = currentSerata.metadata || {};
      if (Array.isArray(currentSerata.brani) && currentSerata.brani.length) {
        const saved = new Map(currentSerata.brani.map((item) => [String(item.id), item]));
        this.brani = this.brani.map((item) => ({ ...item, ...(saved.get(String(item.id)) || {}) }));
      }
    }
    this.hidden = getHiddenBraniByTitle(this.brani, { isExecuted: this.isExecuted.bind(this) });
    this.render();
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
      const selected = Boolean(brano.next_selected);
      const videoclip = brano.videoclip ? `<a class="video-link" href="videoclip.html?branoId=${encodeURIComponent(String(brano.id))}">🎬</a>` : '-';
      return `<tr><td>${index + 1}</td><td>${this.escape(brano.id)}</td><td>${this.escape(this.titleOf(brano))}</td><td>${this.escape(brano.autore || '--')}</td><td>${this.escape(brano.coreografo || '--')}</td><td class="next-cell ${selected ? 'is-selected' : ''}" data-next="${this.escape(brano.id)}">${selected ? '✓' : 'NEXT'}</td><td class="flag-cell" data-flag="${this.escape(brano.id)}">${this.isExecuted(brano) ? 'X' : 'FLAG'}</td><td class="video-cell">${videoclip}</td></tr>`;
    }).join('');
    tbody.querySelectorAll('[data-next]').forEach((cell) => cell.addEventListener('click', () => this.toggleNext(cell.dataset.next)));
    tbody.querySelectorAll('[data-flag]').forEach((cell) => cell.addEventListener('click', () => this.toggleFlag(cell.dataset.flag)));
  }

  toggleNext(id) {
    const brano = this.brani.find((item) => String(item.id) === String(id));
    if (!brano || this.isExecuted(brano)) return Toast.warning('NEXT non consentito su un brano eseguito.');
    const selected = Boolean(brano.next_selected);
    this.brani.forEach((item) => { item.next_selected = false; });
    if (selected) {
      Storage.remove('bordero_next_coreo_selection');
    } else {
      brano.next_selected = true;
      Storage.set('bordero_next_coreo_selection', { id: String(brano.id), title: this.titleOf(brano), nextValue: this.titleOf(brano), timestamp: Date.now() });
    }
    this.persist();
    this.render();
  }

  toggleFlag(id) {
    const brano = this.brani.find((item) => String(item.id) === String(id));
    if (!brano) return;
    if (this.isExecuted(brano)) {
      brano.flag = ''; brano.timestamp = '';
    } else if (brano.next_selected) {
      brano.flag = 'X'; brano.timestamp = DateUtils.formatDate(new Date()); brano.next_selected = false;
      Storage.remove('bordero_next_coreo_selection');
    } else {
      return Toast.warning('Per impostare FLAG devi prima selezionare lo stesso brano in NEXT.');
    }
    this.persist();
    this.render();
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
  }

  escape(value) { return String(value ?? '--').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
}

document.addEventListener('DOMContentLoaded', () => { window.braniNascostiPage = new BraniNascostiPage(); });

/**
 * BORDERÒ - Lista Serata Logic
 * Riepilogo dettagliato brani eseguiti e non eseguiti
 */

class ListaSerata {
  constructor() {
    this.brani = [];
    this.executed = [];
    this.pending = [];
    this.serata = {};

    this.init();
  }

  async init() {
    logger.info('ListaSerata initializing...');

    try {
      this.brani = await dataLoader.loadBrani();
      this.loadData();
      this.render();
      this.setupListeners();

      logger.info('✓ ListaSerata inizializzato');
    } catch (error) {
      logger.error('Errore inizializzazione', error);
    }
  }

  loadData() {
    const currentSerata = dataLoader.getCurrentSerata();
    if (currentSerata) {
      this.serata = currentSerata.metadata;
      this.brani = currentSerata.brani || this.brani;
    }

    this.executed = this.brani.filter(b => b.flag === 'X');
    this.pending = this.brani.filter(b => b.flag !== 'X');
  }

  render() {
    this.updateSerataMeta();
    this.updateStats();
    this.renderExecuted();
    this.renderPending();
  }

  updateSerataMeta() {
    document.getElementById('info-dj').textContent = this.serata.dj || '--';
    document.getElementById('info-data').textContent = this.serata.data || '--';
    document.getElementById('info-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('info-evento').textContent = this.serata.evento || '--';
  }

  updateStats() {
    const total = this.brani.length;
    const executed = this.executed.length;
    const pending = this.pending.length;
    const percent = total > 0 ? Math.round((executed / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-executed').textContent = executed;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-percent').textContent = `${percent}%`;
  }

  renderExecuted() {
    const tbody = document.getElementById('executed-tbody');
    const empty = document.getElementById('empty-executed');
    const count = document.getElementById('executed-count');

    if (this.executed.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      count.textContent = '0 brani';
      return;
    }

    empty.style.display = 'none';
    count.textContent = `${this.executed.length} brani`;

    tbody.innerHTML = this.executed
      .map((b, i) => `
        <tr class="executed-row">
          <td class="col-number">${i + 1}</td>
          <td class="col-titolo">${b.titolo}</td>
          <td class="col-autore">${b.autore || '--'}</td>
          <td class="col-coreografo">${b.coreografo || '--'}</td>
          <td class="col-timestamp">${b.timestamp || '--'}</td>
        </tr>
      `)
      .join('');
  }

  renderPending() {
    const tbody = document.getElementById('pending-tbody');
    const empty = document.getElementById('empty-pending');
    const count = document.getElementById('pending-count');

    if (this.pending.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      count.textContent = '0 brani';
      return;
    }

    empty.style.display = 'none';
    count.textContent = `${this.pending.length} brani`;

    tbody.innerHTML = this.pending
      .map((b, i) => `
        <tr class="pending-row">
          <td class="col-number">${i + 1}</td>
          <td class="col-titolo">${b.titolo}</td>
          <td class="col-autore">${b.autore || '--'}</td>
          <td class="col-coreografo">${b.coreografo || '--'}</td>
          <td class="col-genere">${b.genere || '--'}</td>
        </tr>
      `)
      .join('');
  }

  setupListeners() {
    document.getElementById('btn-export').addEventListener('click', () => this.exportPDF());
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-back').addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }

  exportPDF() {
    Toast.info('Esportazione PDF in preparazione...');
    window.print();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.listaSerata = new ListaSerata();
});

logger.info('✓ ListaSerata.js caricato');

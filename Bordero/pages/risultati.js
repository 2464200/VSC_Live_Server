/**
 * BORDERÒ - Risultati Serata Logic
 * Statistiche e analisi finale della serata
 */

class RisultatiSerata {
  constructor() {
    this.brani = [];
    this.executed = [];
    this.serata = {};

    this.init();
  }

  async init() {
    logger.info('RisultatiSerata initializing...');

    try {
      this.brani = await dataLoader.loadBrani();
      this.loadData();
      this.render();
      this.setupListeners();

      logger.info('✓ RisultatiSerata inizializzato');
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
  }

  render() {
    this.updateSummary();
    this.updateStats();
    this.updateGeneriChart();
    this.updateLivelliChart();
    this.updateCoreografiList();
  }

  updateSummary() {
    document.getElementById('result-data').textContent = this.serata.data || '--';
    document.getElementById('result-dj').textContent = this.serata.dj || '--';
    document.getElementById('result-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('result-evento').textContent = this.serata.evento || '--';
  }

  updateStats() {
    const total = this.brani.length;
    const executed = this.executed.length;
    const percent = total > 0 ? Math.round((executed / total) * 100) : 0;

    document.getElementById('result-total').textContent = total;
    document.getElementById('result-executed').textContent = executed;
    document.getElementById('result-percent').textContent = `${percent}%`;
  }

  updateGeneriChart() {
    const generiCount = {};
    this.executed.forEach(b => {
      const genere = b.genere || 'Sconosciuto';
      generiCount[genere] = (generiCount[genere] || 0) + 1;
    });

    const html = Object.entries(generiCount)
      .sort((a, b) => b[1] - a[1])
      .map(([genere, count]) => {
        const percent = Math.round((count / this.executed.length) * 100);
        return `
          <div class="chart-bar">
            <span class="bar-label">${genere}</span>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${percent}%"></div>
            </div>
            <span class="bar-value">${count} (${percent}%)</span>
          </div>
        `;
      })
      .join('');

    document.getElementById('generi-chart').innerHTML = html || '<p>Nessun dato</p>';
  }

  updateLivelliChart() {
    const livelliCount = {};
    this.executed.forEach(b => {
      const livello = b.info_livello || 'Sconosciuto';
      livelliCount[livello] = (livelliCount[livello] || 0) + 1;
    });

    const html = Object.entries(livelliCount)
      .sort((a, b) => b[1] - a[1])
      .map(([livello, count]) => {
        const percent = Math.round((count / this.executed.length) * 100);
        return `
          <div class="chart-bar">
            <span class="bar-label">${livello}</span>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${percent}%"></div>
            </div>
            <span class="bar-value">${count} (${percent}%)</span>
          </div>
        `;
      })
      .join('');

    document.getElementById('livelli-chart').innerHTML = html || '<p>Nessun dato</p>';
  }

  updateCoreografiList() {
    const coreografiCount = {};
    this.executed.forEach(b => {
      const coreo = b.coreografo || 'Sconosciuto';
      coreografiCount[coreo] = (coreografiCount[coreo] || 0) + 1;
    });

    const html = Object.entries(coreografiCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([coreo, count]) => `
        <li>
          <span class="coreografo-name">${coreo}</span>
          <span class="coreografo-count">${count}</span>
        </li>
      `)
      .join('');

    document.getElementById('coreografi-list').innerHTML = html || '<li><p>Nessun dato</p></li>';
  }

  setupListeners() {
    document.getElementById('btn-download').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-new-serata').addEventListener('click', () => {
      if (confirm('Vuoi davvero iniziare una nuova serata? I dati attuali verranno archiviati.')) {
        dataLoader.newSerata();
        window.location.href = 'bordero.html';
      }
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      window.history.back();
    });
  }
}

// CSS per charts (inline)
const chartStyles = `
<style>
.chart-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.bar-label {
  min-width: 120px;
  color: #ccc;
  font-weight: 600;
  text-align: right;
}

.bar-container {
  flex: 1;
  height: 30px;
  background-color: rgba(255, 127, 0, 0.1);
  border: 1px solid var(--primary-orange);
  border-radius: 5px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-orange), var(--primary-hover));
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
}

.bar-value {
  min-width: 80px;
  text-align: right;
  color: var(--primary-orange);
  font-weight: bold;
  font-family: 'Courier New', monospace;
}
</style>
`;

document.addEventListener('DOMContentLoaded', () => {
  document.head.insertAdjacentHTML('beforeend', chartStyles);
  window.risultatiSerata = new RisultatiSerata();
});

logger.info('✓ Risultati.js caricato');

/**
 * BORDERÒ - Admin Panel Logic
 * Testing, debugging, and system management
 */

class AdminPanel {
  constructor() {
    this.consoleOutput = [];
    this.init();
  }

  async init() {
    this.setupSystemStatus();
    this.setupExcelFileSelection();
    this.setupDataSync();
    this.setupDataViewer();
    this.setupCacheManagement();
    this.setupExportImport();
    this.setupConsole();
    this.log('✓ Admin Panel initialized', 'success');
  }

  /* ========== EXCEL FILE SELECTION ========== */
  setupExcelFileSelection() {
    document.getElementById('btn-select-excel').addEventListener('click', async () => {
      this.log('Aprendo finestra di selezione file Excel...', 'info');
      const file = await excelFileManager.showSelectDialog();
      
      if (file) {
        document.getElementById('excel-file-status').textContent = 
          `✓ File selezionato: ${file.name} (${excelFileManager.formatFileSize(file.size)})`;
        document.getElementById('excel-file-status').style.color = '#28a745';
        
        // Aggiorna excelSync con il file selezionato
        excelSync.excelFile = file;
        this.log(`✓ File Excel caricato: ${file.name}`, 'success');
      } else {
        this.log('Selezione file annullata', 'warn');
      }
    });
  }

  /* ========== SYSTEM STATUS ========== */
  setupSystemStatus() {
    document.getElementById('status-browser').textContent = navigator.userAgent.split(' ').pop();
    
    const storageSize = this.getStorageSize();
    document.getElementById('status-storage').textContent = `${storageSize} MB`;
    
    const lastSync = localStorage.getItem('BORDERO_LAST_EXCEL_SYNC');
    document.getElementById('status-sync').textContent = lastSync ? lastSync.substring(0, 10) : 'Never';
    
    const cacheSize = this.getCacheStats();
    document.getElementById('status-cache').textContent = cacheSize;
  }

  getStorageSize() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / 1024 / 1024).toFixed(2);
  }

  getCacheStats() {
    let count = 0;
    for (let key in localStorage) {
      if (key.startsWith('BORDERO_')) count++;
    }
    return `${count} keys`;
  }

  /* ========== DATA SYNC ========== */
  setupDataSync() {
    const updateStatus = async () => {
      const braniCount = Storage.get('BORDERO_BRANI_DATA')?.length || 0;
      const comuniCount = Storage.get('BORDERO_COMUNI_DATA')?.length || 0;
      const dbaseCount = Storage.get('BORDERO_DBASE_DATA')?.length || 0;

      document.getElementById('sync-brani-status').textContent = `${braniCount} brani cached`;
      document.getElementById('sync-comuni-status').textContent = `${comuniCount} comuni cached`;
      document.getElementById('sync-dbase-status').textContent = `${dbaseCount} DJ cached`;
      void this.refreshDataViewer();
    };

    updateStatus();
    window.addEventListener('bordero:data-updated', () => updateStatus());
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('BORDERO_')) {
        updateStatus();
      }
    });

    // Pulsante: Sincronizza BRANI
    document.getElementById('btn-sync-brani').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando Brani dal file Excel selezionato...', 'warn');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncBrani(workbook);
        updateStatus();
        this.log('✓ Brani sincronizzati con successo', 'success');
        Toast.success('✓ Brani sincronizzati');
      } catch (error) {
        this.log(`❌ Errore sync Brani: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Brani');
      }
    });

    // Pulsante: Sincronizza COMUNI
    document.getElementById('btn-sync-comuni').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando Comuni dal file Excel selezionato...', 'warn');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncComuni(workbook);
        updateStatus();
        this.log('✓ Comuni sincronizzati con successo', 'success');
        Toast.success('✓ Comuni sincronizzati');
      } catch (error) {
        this.log(`❌ Errore sync Comuni: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Comuni');
      }
    });

    // Pulsante: Sincronizza DBASE (DJ)
    document.getElementById('btn-sync-dbase').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando dBase dal file Excel selezionato...', 'warn');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncDBase(workbook);
        updateStatus();
        this.log('✓ dBase sincronizzato con successo', 'success');
        Toast.success('✓ dBase sincronizzato');
      } catch (error) {
        this.log(`❌ Errore sync dBase: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione dBase');
      }
    });

    // Pulsante: Sincronizza TUTTO
    document.getElementById('btn-sync-all').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando TUTTI i dati dal file Excel...', 'warn');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        await excelSync.syncFromExcel();
        updateStatus();
        this.log('✓ Tutti i dati sincronizzati con successo!', 'success');
      } catch (error) {
        this.log(`❌ Errore sync totale: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione');
      }
    });
  }

  /* ========== DATA VIEWER ========== */
  setupDataViewer() {
    document.getElementById('data-viewer-select').addEventListener('change', (e) => {
      void this.refreshDataViewer(e.target.value);
    });
  }

  async refreshDataViewer(type = null) {
    const select = document.getElementById('data-viewer-select');
    const output = document.getElementById('data-viewer-output');
    const activeType = type || select?.value || '';

    let data = null;
    switch (activeType) {
      case 'brani': {
        data = Storage.get('BORDERO_BRANI_DATA');
        if (!Array.isArray(data) || data.length === 0) {
          if (typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.loadBrani === 'function') {
            data = await window.dataLoader.loadBrani();
          } else {
            const loader = new DataLoader();
            data = await loader.loadBrani();
          }
        }
        break;
      }
      case 'comuni': {
        data = Storage.get('BORDERO_COMUNI_DATA');
        if (!Array.isArray(data) || data.length === 0) {
          if (typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.loadComuni === 'function') {
            data = await window.dataLoader.loadComuni();
          } else {
            const loader = new DataLoader();
            data = await loader.loadComuni();
          }
        }
        break;
      }
      case 'dbase': {
        data = Storage.get('BORDERO_DBASE_DATA');
        if (!Array.isArray(data) || data.length === 0) {
          if (typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.loadDJ === 'function') {
            data = await window.dataLoader.loadDJ();
          } else {
            const loader = new DataLoader();
            data = await loader.loadDJ();
          }
        }
        break;
      }
      case 'serata':
        data = Storage.get('BORDERO_CURRENT_SERATA');
        break;
      case 'history':
        data = Storage.get('BORDERO_SERATA_HISTORY');
        break;
      case 'localstorage':
        data = {};
        for (let key in localStorage) {
          if (key.startsWith('BORDERO_')) {
            data[key] = '...';
          }
        }
        break;
    }

    if (output) {
      output.innerHTML = this.renderViewerContent(activeType, data);
    }
  }

  renderViewerContent(type, data) {
    if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) {
      return '<div class="data-viewer-empty">Nessun dato disponibile per questa sezione.</div>';
    }

    if (type === 'brani' && Array.isArray(data)) {
      const rows = data.slice(0, 30).map((item) => {
        const id = item.id || item.ID || '';
        const title = item.titolo || item.brano || item.title || item.coreografia || '';
        const author = item.autore || item.author || '';
        const level = item.info_livello || item.livello || '';
        const coreo = item.info_coreo || item.coreografo || '';
        return `<tr><td>${this.escapeHtml(id)}</td><td>${this.escapeHtml(title)}</td><td>${this.escapeHtml(author)}</td><td>${this.escapeHtml(level)}</td><td>${this.escapeHtml(coreo)}</td></tr>`;
      }).join('');

      return `
        <div class="data-viewer-summary">${data.length} elementi caricati • anteprima 30 righe</div>
        <table class="data-viewer-table">
          <thead><tr><th>ID</th><th>Titolo</th><th>Autore</th><th>Livello</th><th>Coreografia</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    if ((type === 'comuni' || type === 'dbase') && Array.isArray(data)) {
      const rows = data.slice(0, 20).map((item) => {
        const name = item.nome || item.name || item.Nome || '';
        const extra = Object.entries(item)
          .filter(([key, value]) => key !== 'nome' && key !== 'name' && key !== 'Nome' && value !== '' && value !== null && value !== undefined)
          .slice(0, 3)
          .map(([key, value]) => `<code>${this.escapeHtml(key)}: ${this.escapeHtml(String(value))}</code>`)
          .join(' ');
        return `<tr><td>${this.escapeHtml(name)}</td><td>${extra || '—'}</td></tr>`;
      }).join('');

      const label = type === 'comuni' ? 'Comuni' : 'DJ';
      return `
        <div class="data-viewer-summary">${data.length} ${label.toLowerCase()} caricati • anteprima 20 righe</div>
        <table class="data-viewer-table">
          <thead><tr><th>${label}</th><th>Dettagli</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
      const rows = Object.entries(data).slice(0, 20).map(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `<tr><td>${this.escapeHtml(key)}</td><td>${this.escapeHtml(displayValue)}</td></tr>`;
      }).join('');
      return `
        <div class="data-viewer-summary">Struttura oggetto • anteprima 20 chiavi</div>
        <table class="data-viewer-table"><thead><tr><th>Chiave</th><th>Valore</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    return `<pre>${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ========== CACHE MANAGEMENT ========== */
  setupCacheManagement() {
    document.getElementById('btn-clear-brani-cache').addEventListener('click', () => {
      localStorage.removeItem('BORDERO_BRANI_DATA');
      this.log('✓ Brani cache cleared', 'success');
    });

    document.getElementById('btn-clear-comuni-cache').addEventListener('click', () => {
      localStorage.removeItem('BORDERO_COMUNI_DATA');
      this.log('✓ Comuni cache cleared', 'success');
    });

    document.getElementById('btn-clear-dbase-cache').addEventListener('click', () => {
      localStorage.removeItem('BORDERO_DBASE_DATA');
      this.log('✓ dBase cache cleared', 'success');
    });

    document.getElementById('btn-clear-serata-cache').addEventListener('click', () => {
      localStorage.removeItem('BORDERO_CURRENT_SERATA');
      this.log('✓ Serata data cleared', 'success');
    });

    document.getElementById('btn-clear-all-cache').addEventListener('click', () => {
      if (confirm('⚠️ Clear ALL cache? This cannot be undone!')) {
        for (let key in localStorage) {
          if (key.startsWith('BORDERO_')) {
            localStorage.removeItem(key);
          }
        }
        this.log('🗑️ ALL cache cleared', 'success');
      }
    });
  }

  /* ========== EXPORT/IMPORT ========== */
  setupExportImport() {
    document.getElementById('btn-export-all').addEventListener('click', () => {
      const allData = {};
      for (let key in localStorage) {
        if (key.startsWith('BORDERO_')) {
          allData[key] = localStorage.getItem(key);
        }
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `borderò-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      this.log('✓ Data exported', 'success');
    });

    document.getElementById('btn-export-csv-brani').addEventListener('click', () => {
      const brani = Storage.get('BORDERO_BRANI_DATA') || [];
      if (brani.length === 0) {
        this.log('No brani to export', 'warn');
        return;
      }

      const csv = this.arrayToCSV(brani);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brani-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      this.log('✓ Brani exported as CSV', 'success');
    });

    document.getElementById('btn-import-file').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          for (let key in data) {
            localStorage.setItem(key, data[key]);
          }
          this.log('✓ Data imported successfully', 'success');
        } catch (error) {
          this.log(`Import error: ${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  arrayToCSV(array) {
    if (array.length === 0) return '';
    const headers = Object.keys(array[0]);
    const headerLine = headers.join(',');
    const dataLines = array.map(row =>
      headers.map(h => this.escapeCSV(row[h] || '')).join(',')
    );
    return [headerLine, ...dataLines].join('\n');
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /* ========== CONSOLE ========== */
  setupConsole() {
    document.getElementById('btn-console-execute').addEventListener('click', () => {
      const input = document.getElementById('console-input').value;
      if (!input) return;

      try {
        const result = eval(input);
        this.log(`> ${input}`, 'warn');
        this.log(JSON.stringify(result, null, 2), 'success');
      } catch (error) {
        this.log(`> ${input}`, 'warn');
        this.log(`Error: ${error.message}`, 'error');
      }

      document.getElementById('console-input').value = '';
    });

    document.getElementById('btn-console-clear').addEventListener('click', () => {
      this.consoleOutput = [];
      document.getElementById('console-output').innerHTML = '';
    });

    document.getElementById('console-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-console-execute').click();
      }
    });
  }

  /* ========== LOGGING ========== */
  log(message, type = 'info') {
    const output = document.getElementById('console-output');
    const logEl = document.createElement('div');
    logEl.className = `log ${type}`;
    logEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    output.appendChild(logEl);
    output.scrollTop = output.scrollHeight;
    this.consoleOutput.push(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});

logger.info('✓ Admin.js loaded');

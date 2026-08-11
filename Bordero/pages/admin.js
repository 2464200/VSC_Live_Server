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
    this.setupDisplayScrollSettings();
    this.setupExcelFileSelection();
    this.setupDataSync();
    this.setupDataViewer();
    this.setupCacheManagement();
    this.setupExportImport();
    this.setupDjManagement();
    this.setupDjSoftwareSelection();
    this.setupMusicArchiveSettings();
    this.setupConsole();
    this.setupElectronLauncher();
    this.setupMonitorPolicyDiagnostics();
    this.log('✓ Admin Panel initialized', 'success');
  }

  async fetchMusicArchiveConfig() {
    const response = await fetch('/api/music-archive/config', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  async fetchMusicArchiveStatus(refresh = false) {
    const suffix = refresh ? '?refresh=1' : '';
    const response = await fetch(`/api/music-archive/status${suffix}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  async fetchMusicArchiveDirectories(targetPath = '') {
    const response = await fetch(`/api/music-archive/directories?path=${encodeURIComponent(targetPath || '')}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  setupMusicArchiveSettings() {
    const pathInput = document.getElementById('music-archive-path');
    const browseBtn = document.getElementById('btn-browse-music-archive');
    const saveBtn = document.getElementById('btn-save-music-archive');
    const checkBtn = document.getElementById('btn-check-music-archive');
    const statusEl = document.getElementById('music-archive-status');
    const recentPathEl = document.getElementById('music-archive-recent-path');

    if (!pathInput || !browseBtn || !saveBtn || !checkBtn || !statusEl) return;

    const renderStatus = (text, level = 'info') => {
      statusEl.textContent = text;
      statusEl.style.color = level === 'error' ? '#ff7f7f' : (level === 'success' ? '#9be7a5' : '#ddd');
    };

    const renderRecentPathHint = (configuredPath = '', selectedPath = '') => {
      if (!recentPathEl) return;

      const effectivePath = String(configuredPath || selectedPath || '').trim();
      if (!effectivePath) {
        recentPathEl.textContent = 'Nessun percorso salvato. Seleziona una cartella e premi Salva.';
        recentPathEl.style.color = '#dfe6ff';
        return;
      }

      recentPathEl.textContent = `Ultimo percorso usato: ${effectivePath}`;
      recentPathEl.style.color = '#9be7a5';
    };

    const populatePathOptions = async (currentPath = '') => {
      const options = [];
      const seen = new Set();
      const normalizedCurrent = String(currentPath || '').trim();
      const current = normalizedCurrent || '';

      const addOption = (value, label) => {
        const safeValue = String(value || '').trim();
        if (!safeValue || seen.has(safeValue)) {
          return;
        }
        seen.add(safeValue);
        options.push({ value: safeValue, label: String(label || safeValue) });
      };

      if (current) {
        addOption(current, current || 'Cartella corrente');
      }

      try {
        const payload = await this.fetchMusicArchiveDirectories(current);
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        if (payload?.parentPath) {
          addOption(payload.parentPath, '⬆️ Cartella superiore');
        }
        entries.forEach((entry) => {
          if (entry?.isDirectory !== false) {
            addOption(entry.path || entry.name, entry.name || entry.path);
          }
        });
      } catch (error) {
        this.log(`⚠️ Impossibile caricare la lista cartelle: ${error?.message || error}`, 'warning');
      }

      pathInput.innerHTML = '';
      options.forEach((option) => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        pathInput.appendChild(element);
      });

      if (current) {
        pathInput.value = current;
      }

      if (current) {
        renderRecentPathHint(current, current);
      }
    };

    const refreshUi = async (forceScan = false) => {
      try {
        const [config, status] = await Promise.all([
          this.fetchMusicArchiveConfig(),
          this.fetchMusicArchiveStatus(forceScan)
        ]);

        const configuredPath = String(config?.rootPath || '').trim();
        await populatePathOptions(configuredPath);
        renderRecentPathHint(configuredPath, pathInput.value);

        if (!configuredPath) {
          renderStatus('Stato archivio: non configurato', 'info');
          return;
        }

        if (!status?.exists) {
          renderStatus('Stato archivio: cartella configurata ma non raggiungibile', 'error');
          return;
        }

        renderStatus(`Stato archivio: OK • ${status.fileCount || 0} file audio indicizzati`, 'success');
      } catch (error) {
        renderStatus(`Stato archivio: errore (${error?.message || error})`, 'error');
      }
    };

    pathInput.addEventListener('change', async () => {
      const selectedPath = String(pathInput.value || '').trim();
      if (!selectedPath) {
        return;
      }
      await populatePathOptions(selectedPath);
    });

    browseBtn.addEventListener('click', async () => {
      const currentPath = String(pathInput.value || '').trim();
      try {
        const payload = await this.fetchMusicArchiveDirectories(currentPath || '');
        if (payload?.path) {
          await populatePathOptions(payload.path);
        }
      } catch (error) {
        this.log(`❌ Impossibile aprire la navigazione archivio: ${error?.message || error}`, 'error');
        Toast.error('Impossibile caricare la cartella archivio');
      }
    });

    saveBtn.addEventListener('click', async () => {
      const rootPath = String(pathInput.value || '').trim();
      if (!rootPath) {
        Toast.warning('Inserisci il percorso della cartella archivio');
        return;
      }

      try {
        const response = await fetch('/api/music-archive/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootPath })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }

        this.log(`✓ Archivio brani salvato: ${payload.rootPath}`, 'success');
        Toast.success('Cartella archivio salvata');
        await refreshUi(true);
      } catch (error) {
        this.log(`❌ Errore salvataggio archivio brani: ${error?.message || error}`, 'error');
        Toast.error('Impossibile salvare la cartella archivio');
        await refreshUi(false);
      }
    });

    checkBtn.addEventListener('click', async () => {
      renderStatus('Stato archivio: verifica in corso...', 'info');
      await refreshUi(true);
    });

    refreshUi(false);
  }

  getDjSoftwareStorageKey() {
    return 'BORDERO_DJ_SOFTWARE';
  }

  normalizeDjSoftware(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = ['rekordbox', 'serato', 'djaypro', 'traktor', 'virtualdj'];
    return allowed.includes(normalized) ? normalized : '';
  }

  isDjSoftwareSelectable(software) {
    const normalized = this.normalizeDjSoftware(software);
    return normalized === 'virtualdj' || normalized === 'traktor';
  }

  readDjSoftwareSelection() {
    const raw = localStorage.getItem(this.getDjSoftwareStorageKey());
    return this.normalizeDjSoftware(raw);
  }

  saveDjSoftwareSelection(software) {
    const normalized = this.normalizeDjSoftware(software);
    if (!normalized) {
      localStorage.removeItem(this.getDjSoftwareStorageKey());
      return '';
    }

    localStorage.setItem(this.getDjSoftwareStorageKey(), normalized);
    return normalized;
  }

  getDjSoftwareLabel(software) {
    const map = {
      rekordbox: 'Pioneer DJ Rekordbox',
      serato: 'Serato DJ',
      djaypro: 'Algoriddim djay Pro',
      traktor: 'Native Instruments Traktor Pro',
      virtualdj: 'VirtualDJ'
    };

    return map[this.normalizeDjSoftware(software)] || 'Nessuno';
  }

  isFeatureEnabledBySelectedSoftware(software) {
    // Hook pronto per la funzione specifica richiesta in un secondo momento.
    return this.normalizeDjSoftware(software) === 'virtualdj';
  }

  updateDjSoftwareUi(selectedSoftware) {
    const normalized = this.normalizeDjSoftware(selectedSoftware);
    const buttons = document.querySelectorAll('.software-toggle-btn');

    buttons.forEach((button) => {
      const software = this.normalizeDjSoftware(button.getAttribute('data-software'));
      const selectable = this.isDjSoftwareSelectable(software);
      const isOn = software === normalized;
      button.textContent = isOn ? 'ON' : 'OFF';
      button.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      button.disabled = !selectable;
      button.title = selectable ? '' : 'Software non ancora abilitato';
      button.classList.toggle('btn-primary', isOn);
      button.classList.toggle('btn-secondary', !isOn);
      button.classList.toggle('is-on', isOn);
      button.classList.toggle('is-off', !isOn);
      button.classList.toggle('is-disabled', !selectable);
    });

    const selectionStatus = document.getElementById('dj-software-selection-status');
    if (selectionStatus) {
      selectionStatus.textContent = `Software selezionato: ${this.getDjSoftwareLabel(normalized)}`;
    }

    const featureStatus = document.getElementById('dj-software-feature-status');
    if (featureStatus) {
      const enabled = this.isFeatureEnabledBySelectedSoftware(normalized);
      featureStatus.textContent = enabled
        ? 'Funzione collegata: abilitata (regola temporanea: VirtualDJ selezionato)'
        : 'Funzione collegata: disabilitata (in attesa specifica)';
    }
  }

  setupDjSoftwareSelection() {
    const buttons = document.querySelectorAll('.software-toggle-btn');
    if (!buttons || buttons.length === 0) return;

    const applySelection = (software, notify = true) => {
      if (software && !this.isDjSoftwareSelectable(software)) {
        this.log(`⚠️ Software non ancora abilitato: ${this.getDjSoftwareLabel(software)}`, 'warn');
        Toast.warning('Software non ancora abilitato');
        this.updateDjSoftwareUi(this.readDjSoftwareSelection());
        return;
      }

      const selected = this.saveDjSoftwareSelection(software);
      this.updateDjSoftwareUi(selected);

      if (notify) {
        window.dispatchEvent(new CustomEvent('bordero:dj-software-changed', {
          detail: {
            software: selected,
            featureEnabled: this.isFeatureEnabledBySelectedSoftware(selected)
          }
        }));
      }

      if (selected) {
        this.log(`✓ Software DJ selezionato: ${this.getDjSoftwareLabel(selected)}`, 'success');
      }
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const software = this.normalizeDjSoftware(button.getAttribute('data-software'));
        if (!software) return;
        applySelection(software, true);
      });
    });

    applySelection(this.readDjSoftwareSelection(), false);

    window.addEventListener('storage', (event) => {
      if (event.key !== this.getDjSoftwareStorageKey()) return;
      this.updateDjSoftwareUi(this.readDjSoftwareSelection());
    });
  }

  setupMonitorPolicyDiagnostics() {
    const output = document.getElementById('monitor-policy-last-route');
    const clearBtn = document.getElementById('btn-monitor-policy-clear');

    if (!output) return;

    const render = (eventPayload) => {
      if (!eventPayload) {
        output.textContent = 'In attesa del primo routing...';
        return;
      }

      const policyPrimary = eventPayload?.policy?.primary ? 'SI' : 'NO';
      const policySecondary = eventPayload?.policy?.secondary ? 'SI' : 'NO';
      const primaryUpdated = eventPayload?.primaryUpdated ? 'SI' : 'NO';
      const secondaryUpdated = eventPayload?.secondaryUpdated ? 'SI' : 'NO';
      const swap = eventPayload?.swapPrimarySecondary ? 'ON' : 'OFF';

      output.textContent = [
        `Ora: ${eventPayload?.timestamp || '-'}`,
        `Origine: ${eventPayload?.source || '-'}`,
        `Pagina: ${eventPayload?.path || eventPayload?.url || '-'}`,
        `Policy tabella -> Principale: ${policyPrimary} | Secondario: ${policySecondary}`,
        `Aggiornamento effettivo -> Principale: ${primaryUpdated} | Secondario: ${secondaryUpdated}`,
        `Swap monitor: ${swap}`
      ].join('\n');
    };

    clearBtn?.addEventListener('click', () => {
      render(null);
    });

    const monitorPolicyBridge = window.electronAPI?.monitorPolicy;
    if (!monitorPolicyBridge) {
      output.textContent = 'Diagnostica live disponibile solo in runtime Electron.';
      return;
    }

    monitorPolicyBridge.getLastRoute()
      .then((payload) => {
        render(payload?.event || null);
      })
      .catch((error) => {
        output.textContent = `Impossibile leggere ultimo routing: ${error?.message || error}`;
      });

    monitorPolicyBridge.onRouted((eventPayload) => {
      render(eventPayload || null);
    });
  }

  getDisplayScrollDefaults() {
    return {
      stepMs: Number(BORDERO_CONFIG?.DISPLAY_SCROLL_DEFAULT_STEP_MS ?? 16),
      pauseSec: Number(BORDERO_CONFIG?.DISPLAY_SCROLL_DEFAULT_PAUSE_SEC ?? 1),
      stepPx: Number(BORDERO_CONFIG?.DISPLAY_SCROLL_DEFAULT_STEP_PX ?? 1),
    };
  }

  getDisplayScrollStorageKey() {
    return BORDERO_CONFIG?.DISPLAY_SCROLL_SETTINGS_STORAGE_KEY || 'BORDERO_DISPLAY_SCROLL_SETTINGS';
  }

  readDisplayScrollSettings() {
    const defaults = this.getDisplayScrollDefaults();
    const raw = localStorage.getItem(this.getDisplayScrollStorageKey());

    if (!raw) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw);
      const stepMs = Number(parsed?.stepMs);
      const pauseSec = Number(parsed?.pauseSec);
      const stepPx = Number(parsed?.stepPx);

      return {
        stepMs: Number.isFinite(stepMs) ? Math.min(50, Math.max(1, stepMs)) : defaults.stepMs,
        pauseSec: Number.isFinite(pauseSec) ? Math.min(20, Math.max(0, pauseSec)) : defaults.pauseSec,
        stepPx: Number.isFinite(stepPx) ? Math.min(5, Math.max(1, stepPx)) : defaults.stepPx,
      };
    } catch (error) {
      logger.warn('Display scroll settings non valide, uso default', error?.message || error);
      return defaults;
    }
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

  getRequestedBraniCountForDisplay() {
    const brani = Storage.get('BORDERO_BRANI_DATA');
    if (!Array.isArray(brani) || brani.length === 0) {
      return 0;
    }

    return brani.filter((item) => !this.isRichiesteZeroValue(item?.richieste)).length;
  }

  formatSecondsToMinSec(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = Math.round(safe % 60);
    if (minutes <= 0) {
      return `${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  }

  updateDisplayScrollEstimate(stepMs, pauseSec, stepPx) {
    const estimateValue = document.getElementById('display-scroll-estimate-value');
    if (!estimateValue) return;

    const requestedCount = this.getRequestedBraniCountForDisplay();
    if (requestedCount <= 0) {
      estimateValue.textContent = 'n/d (nessun brano richiesto disponibile)';
      return;
    }

    const rowHeightPx = 40;
    const tableViewportPx = 700; // stima per monitor 1080p della pagina display
    const contentHeightPx = requestedCount * rowHeightPx;
    const maxScrollPx = Math.max(0, contentHeightPx - tableViewportPx);

    if (maxScrollPx <= 0) {
      estimateValue.textContent = `tabella interamente visibile (${requestedCount} brani)`;
      return;
    }

    const oneWaySeconds = (maxScrollPx / Math.max(1, stepPx)) * (Math.max(1, stepMs) / 1000);
    const fullCycleSeconds = (oneWaySeconds * 2) + (Math.max(0, pauseSec) * 2);

    estimateValue.textContent =
      `${this.formatSecondsToMinSec(fullCycleSeconds)} ciclo completo | ${requestedCount} brani | corsa ${Math.round(maxScrollPx)}px`;
  }

  saveDisplayScrollSettings(settings) {
    const payload = {
      stepMs: Number.isFinite(Number(settings?.stepMs)) ? Math.min(50, Math.max(1, Number(settings.stepMs))) : 16,
      pauseSec: Number.isFinite(Number(settings?.pauseSec)) ? Math.min(20, Math.max(0, Number(settings.pauseSec))) : 1,
      stepPx: Number.isFinite(Number(settings?.stepPx)) ? Math.min(5, Math.max(1, Number(settings.stepPx))) : 1,
    };

    localStorage.setItem(this.getDisplayScrollStorageKey(), JSON.stringify(payload));
    return payload;
  }

  setupDisplayScrollSettings() {
    const speedInput = document.getElementById('display-scroll-speed');
    const pauseInput = document.getElementById('display-scroll-pause');
    const stepPxInput = document.getElementById('display-scroll-step-px');
    const speedValue = document.getElementById('display-scroll-speed-value');
    const pauseValue = document.getElementById('display-scroll-pause-value');
    const stepPxValue = document.getElementById('display-scroll-step-px-value');
    const estimateValue = document.getElementById('display-scroll-estimate-value');
    const saveBtn = document.getElementById('btn-save-display-scroll');
    const resetBtn = document.getElementById('btn-reset-display-scroll');

    if (!speedInput || !pauseInput || !stepPxInput || !saveBtn || !resetBtn) {
      return;
    }

    const renderReadout = () => {
      const stepMs = Number(speedInput.value);
      const pauseSec = Number(pauseInput.value);
      const stepPx = Number(stepPxInput.value);

      if (speedValue) speedValue.textContent = `${stepMs} ms`;
      if (pauseValue) pauseValue.textContent = `${pauseSec.toFixed(1)} sec`;
      if (stepPxValue) stepPxValue.textContent = `${stepPx} px`;
      if (estimateValue) this.updateDisplayScrollEstimate(stepMs, pauseSec, stepPx);
    };

    const current = this.readDisplayScrollSettings();
    speedInput.value = String(current.stepMs);
    pauseInput.value = String(current.pauseSec);
    stepPxInput.value = String(current.stepPx);
    renderReadout();

    speedInput.addEventListener('input', renderReadout);
    pauseInput.addEventListener('input', renderReadout);
    stepPxInput.addEventListener('input', renderReadout);

    saveBtn.addEventListener('click', () => {
      const saved = this.saveDisplayScrollSettings({
        stepMs: Number(speedInput.value),
        pauseSec: Number(pauseInput.value),
        stepPx: Number(stepPxInput.value),
      });
      speedInput.value = String(saved.stepMs);
      pauseInput.value = String(saved.pauseSec);
      stepPxInput.value = String(saved.stepPx);
      renderReadout();
      this.log(`✓ Impostazioni scroll salvate (velocita: ${saved.stepMs}ms, pausa: ${saved.pauseSec}s, passo: ${saved.stepPx}px)`, 'success');
      Toast.success('Impostazioni scroll salvate');
      this.updateDisplayScrollEstimate(saved.stepMs, saved.pauseSec, saved.stepPx);
    });

    resetBtn.addEventListener('click', () => {
      const defaults = this.getDisplayScrollDefaults();
      const saved = this.saveDisplayScrollSettings(defaults);
      speedInput.value = String(saved.stepMs);
      pauseInput.value = String(saved.pauseSec);
      stepPxInput.value = String(saved.stepPx);
      renderReadout();
      this.log('↺ Impostazioni scroll ripristinate ai default', 'warn');
      Toast.warning('Default scroll ripristinati');
      this.updateDisplayScrollEstimate(saved.stepMs, saved.pauseSec, saved.stepPx);
    });

    window.addEventListener('bordero:data-updated', () => {
      this.updateDisplayScrollEstimate(Number(speedInput.value), Number(pauseInput.value), Number(stepPxInput.value));
    });

    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith('BORDERO_')) return;
      this.updateDisplayScrollEstimate(Number(speedInput.value), Number(pauseInput.value), Number(stepPxInput.value));
    });
  }

  /* ========== DJ MANAGEMENT ========== */
  setupDjManagement() {
    const addBtn = document.getElementById('btn-add-dj');
    const refreshBtn = document.getElementById('btn-refresh-dj-list');
    const syncBtn = document.getElementById('btn-sync-dj-source');
    const input = document.getElementById('dj-name-input');
    const list = document.getElementById('dj-list');

    if (!addBtn || !refreshBtn || !syncBtn || !input || !list) return;

    const persistDjSource = async (djList) => {
      try {
        const response = await fetch('http://localhost:5500/api/bordero/dj-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dj: djList })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        this.log(`✓ Sorgente DJ salvata su file (${result.count} DJ)`, 'success');
        return result;
      } catch (error) {
        logger.error('Errore salvataggio sorgente DJ', error);
        Toast.error('Impossibile salvare la sorgente DJ');
        return null;
      }
    };

    const loadDjListFromSource = async () => {
      // Bordero usa una sorgente DJ separata da Eventi (deejay.csv/cache locale).
      const localDj = await dataLoader.loadDJ();
      return Array.isArray(localDj) ? localDj : [];
    };

    const renderDjList = async () => {
      try {
        const dj = await loadDjListFromSource();
        if (!Array.isArray(dj) || dj.length === 0) {
          list.innerHTML = '<div class="sync-log warn">Nessun DJ disponibile</div>';
          return;
        }

        const rows = dj.map((item) => {
          const name = item?.nome || item?.name || '';
          return `
            <div class="dj-row" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #ddd;">
              <span class="dj-name-display">${this.escapeHtml(name)}</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary edit-dj-btn" type="button" data-dj-name="${this.escapeHtml(name)}">Modifica</button>
                <button class="btn btn-secondary remove-dj-btn" type="button" data-dj-name="${this.escapeHtml(name)}">Rimuovi</button>
              </div>
            </div>
          `;
        }).join('');

        list.innerHTML = rows;

        list.querySelectorAll('button.remove-dj-btn').forEach((button) => {
          button.addEventListener('click', async () => {
            const name = button.getAttribute('data-dj-name');
            if (!name) return;
            const nextList = dj.filter((item) => (item?.nome || item?.name || '') !== name);
            Storage.set('BORDERO_DBASE_DATA', nextList);
            await persistDjSource(nextList);
            this.log(`✓ DJ rimosso: ${name}`, 'success');
            Toast.success(`DJ rimosso: ${name}`);
            await this.renderDjListFromStorage();
          });
        });

        list.querySelectorAll('button.edit-dj-btn').forEach((button) => {
          button.addEventListener('click', async () => {
            const name = button.getAttribute('data-dj-name');
            if (!name) return;
            const row = button.closest('.dj-row');
            if (!row) return;

            row.innerHTML = `
              <input class="input dj-edit-input" type="text" value="${this.escapeHtml(name)}" style="flex:1; min-width: 180px;" />
              <div style="display:flex; gap:8px;">
                <button class="btn btn-primary save-dj-btn" type="button" style="font-weight:700;">💾 Salva</button>
                <button class="btn btn-secondary cancel-dj-btn" type="button">↺ Annulla</button>
              </div>
            `;

            const input = row.querySelector('.dj-edit-input');
            let autoSaveTimer = null;

            const saveEdit = async () => {
              const newName = input?.value?.trim();
              if (!newName) {
                Toast.warning('Inserisci un nome DJ');
                return;
              }

              const nextList = dj.map((item) => {
                const currentName = item?.nome || item?.name || '';
                if (currentName !== name) return item;
                return { ...item, nome: newName, name: newName };
              });

              Storage.set('BORDERO_DBASE_DATA', nextList);
              await persistDjSource(nextList);
              this.log(`✓ DJ aggiornato: ${name} → ${newName}`, 'success');
              Toast.success(`DJ aggiornato: ${newName}`);
              await this.renderDjListFromStorage();
            };

            input.addEventListener('input', () => {
              clearTimeout(autoSaveTimer);
              autoSaveTimer = setTimeout(() => {
                saveEdit();
              }, 700);
            });

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                clearTimeout(autoSaveTimer);
                saveEdit();
              }
            });

            row.querySelector('.save-dj-btn').addEventListener('click', () => {
              clearTimeout(autoSaveTimer);
              saveEdit();
            });

            row.querySelector('.cancel-dj-btn').addEventListener('click', async () => {
              clearTimeout(autoSaveTimer);
              await this.renderDjListFromStorage();
            });
          });
        });
      } catch (error) {
        logger.error('Errore render DJ list', error);
        list.innerHTML = '<div class="sync-log error">Errore nel caricamento dei DJ</div>';
      }
    };

    this.renderDjListFromStorage = renderDjList;

    addBtn.addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) {
        Toast.warning('Inserisci un nome DJ');
        return;
      }

      const current = await dataLoader.loadDJ();
      const exists = (current || []).some((item) => String(item?.nome || item?.name || '').toLowerCase() === name.toLowerCase());
      if (exists) {
        Toast.warning('DJ già presente');
        return;
      }

      const nextList = [...(current || []), { nome: name, name }];
      Storage.set('BORDERO_DBASE_DATA', nextList);
      await persistDjSource(nextList);
      input.value = '';
      this.log(`✓ DJ aggiunto: ${name}`, 'success');
      Toast.success(`DJ aggiunto: ${name}`);
      await renderDjList();
    });

    refreshBtn.addEventListener('click', () => renderDjList());
    window.addEventListener('focus', () => {
      renderDjList();
    });
    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith('BORDERO_')) return;
      renderDjList();
    });
    syncBtn.addEventListener('click', async () => {
      const current = Storage.get('BORDERO_DBASE_DATA', []);
      const normalized = Array.isArray(current) ? current.filter((item) => item && (item.nome || item.name)) : [];
      Storage.set('BORDERO_DBASE_DATA', normalized);
      await persistDjSource(normalized);
      this.log('✓ Sorgente DJ sincronizzata', 'success');
      Toast.success('Sorgente DJ sincronizzata');
      await renderDjList();
    });

    renderDjList();
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
      const locationCount = Storage.get('BORDERO_LOCATION_DATA')?.length || 0;

      document.getElementById('sync-brani-status').textContent = `${braniCount} brani cached`;
      document.getElementById('sync-comuni-status').textContent = `${comuniCount} comuni cached`;
      document.getElementById('sync-dbase-status').textContent = `${dbaseCount} DJ cached`;
      document.getElementById('sync-location-status').textContent = `${locationCount} location cached`;

      const musicArchiveStatusEl = document.getElementById('sync-music-archive-status');
      if (musicArchiveStatusEl) {
        try {
          const payload = await this.fetchMusicArchiveStatus(false);
          const fileCount = Number(payload?.fileCount) || 0;
          const exists = payload?.exists !== false;
          musicArchiveStatusEl.textContent = exists
            ? `${fileCount} file audio trovati`
            : 'Archivio non raggiungibile';
        } catch (error) {
          musicArchiveStatusEl.textContent = 'Archivio non verificato';
        }
      }

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
      this.addSyncLog('Avvio sync Brani da file Excel...', 'info');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        this.addSyncLog('Nessun file Excel selezionato per Brani.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncBrani(workbook);
        updateStatus();
        this.log('✓ Brani sincronizzati con successo', 'success');
        this.addSyncLog('Brani sincronizzati con successo.', 'success');
        Toast.success('✓ Brani sincronizzati');
      } catch (error) {
        this.log(`❌ Errore sync Brani: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync Brani: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Brani');
      }
    });

    // Pulsante: Sincronizza COMUNI
    document.getElementById('btn-sync-comuni').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando Comuni dal file Excel selezionato...', 'warn');
      this.addSyncLog('Avvio sync Comuni da file Excel...', 'info');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        this.addSyncLog('Nessun file Excel selezionato per Comuni.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncComuni(workbook);
        updateStatus();
        this.log('✓ Comuni sincronizzati con successo', 'success');
        this.addSyncLog('Comuni sincronizzati con successo.', 'success');
        Toast.success('✓ Comuni sincronizzati');
      } catch (error) {
        this.log(`❌ Errore sync Comuni: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync Comuni: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Comuni');
      }
    });

    // Pulsante: Sincronizza DBASE (DJ)
    document.getElementById('btn-sync-dbase').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando dBase dal file Excel selezionato...', 'warn');
      this.addSyncLog('Avvio sync dBase da file Excel...', 'info');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        this.addSyncLog('Nessun file Excel selezionato per dBase.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncDBase(workbook);
        updateStatus();
        this.log('✓ dBase sincronizzato con successo', 'success');
        this.addSyncLog('dBase sincronizzato con successo.', 'success');
        Toast.success('✓ dBase sincronizzato');
      } catch (error) {
        this.log(`❌ Errore sync dBase: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync dBase: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione dBase');
      }
    });

    document.getElementById('btn-sync-location').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando Location dal file Excel selezionato...', 'warn');
      this.addSyncLog('Avvio sync Location da file Excel...', 'info');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        this.addSyncLog('Nessun file Excel selezionato per Location.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const arrayBuffer = await excelSync.excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        await excelSync.syncLocation(workbook);
        updateStatus();
        this.log('✓ Location sincronizzate con successo', 'success');
        this.addSyncLog('Location sincronizzate con successo.', 'success');
        Toast.success('✓ Location sincronizzate');
      } catch (error) {
        this.log(`❌ Errore sync Location: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync Location: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Location');
      }
    });

    document.getElementById('btn-sync-music-archive').addEventListener('click', async () => {
      const statusEl = document.getElementById('sync-music-archive-status');
      if (statusEl) {
        statusEl.textContent = 'Verifica archivio in corso...';
      }

      try {
        const payload = await this.fetchMusicArchiveStatus(true);
        const fileCount = Number(payload?.fileCount) || 0;
        const exists = payload?.exists !== false;
        if (statusEl) {
          statusEl.textContent = exists
            ? `${fileCount} file audio trovati`
            : 'Archivio non raggiungibile';
        }
        this.addSyncLog(
          exists
            ? `Archivio verificato: ${fileCount} file audio trovati.`
            : 'Archivio verificato ma non raggiungibile.',
          exists ? 'success' : 'warn'
        );
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = 'Archivio non verificato';
        }
        this.addSyncLog(`Errore verifica archivio: ${error.message}`, 'error');
      }
    });

    // Pulsante: Sincronizza TUTTO
    document.getElementById('btn-sync-all').addEventListener('click', async () => {
      this.log('🔄 Sincronizzando TUTTI i dati dal file Excel...', 'warn');
      this.addSyncLog('Avvio sync totale da file Excel...', 'info');
      if (!excelSync.excelFile) {
        this.log('⚠️ Nessun file selezionato. Seleziona il file prima.', 'error');
        this.addSyncLog('Nessun file Excel selezionato per sync totale.', 'error');
        Toast.warning('Seleziona il file Excel prima');
        return;
      }
      try {
        const result = await excelSync.syncFromExcel();
        if (result) {
          updateStatus();
          this.log('✓ Tutti i dati sincronizzati con successo!', 'success');
          this.addSyncLog('Sync totale da file Excel completato con successo.', 'success');
          Toast.success('✓ Tutti i dati sincronizzati');
        } else {
          this.log('❌ Sincronizzazione non completata. Verifica file Excel e XLSX.', 'error');
          this.addSyncLog('Sincronizzazione totale non completata. Verifica file Excel e libreria XLSX.', 'error');
          Toast.warning('Sincronizzazione non completata. Verifica file Excel e libreria XLSX');
        }
      } catch (error) {
        this.log(`❌ Errore sync totale: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync totale: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione');
      }
    });

    // Pulsante: Sync da Google Sheets
    document.getElementById('btn-sync-google').addEventListener('click', async () => {
      this.log('🌐 Avvio sync da Google Sheets...', 'warn');
      this.addSyncLog('Avvio sync da Google Sheets...', 'info');
      try {
        const endpoint = `${window.location.origin || 'http://localhost:5500'}/api/bordero/sync-google`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        let result = {};

        if (responseText) {
          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            const preview = responseText.slice(0, 120).replace(/\s+/g, ' ').trim();
            throw new Error(
              `Risposta non JSON dall'endpoint sync (HTTP ${response.status}, content-type: ${contentType || 'n/a'}). Anteprima: ${preview}`
            );
          }
        }

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        const successMessage = result?.summary?.successCount != null
          ? `${result.summary.successCount}/${result.summary.totalSheets} fogli sincronizzati`
          : (result.message || 'sincronizzazione completata');

        updateStatus();
        this.log(`✓ Sync Google Sheets completato: ${successMessage}`, 'success');
        this.addSyncLog(`Sync Google Sheets completato: ${successMessage}`, 'success');
        Toast.success('✓ Sync da Google Sheets completato');

      } catch (error) {
        this.log(`❌ Errore sync Google Sheets: ${error.message}`, 'error');
        this.addSyncLog(`Errore sync Google Sheets: ${error.message}`, 'error');
        Toast.error('Errore sincronizzazione Google Sheets');
      }
    });

    document.getElementById('btn-clear-sync-log').addEventListener('click', () => {
      const output = document.getElementById('sync-feedback-output');
      if (output) output.innerHTML = '<div class="sync-log info">Log sincronizzazione pulito.</div>';
      this.log('✓ Sync log pulito', 'success');
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
      case 'location': {
        data = Storage.get('BORDERO_LOCATION_DATA');
        if (!Array.isArray(data) || data.length === 0) {
          if (typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.loadLocations === 'function') {
            data = await window.dataLoader.loadLocations();
          } else {
            const loader = new DataLoader();
            data = await loader.loadLocations();
          }
        }
        break;
      }
      case 'music-archive': {
        try {
          const payload = await this.fetchMusicArchiveStatus(false);
          data = {
            rootPath: payload?.rootPath || '',
            exists: Boolean(payload?.exists),
            fileCount: Number(payload?.fileCount) || 0,
            scannedAt: payload?.scannedAt || 0,
            csvPath: payload?.csvPath || '',
            csvCount: Number(payload?.csvCount) || 0,
            sample: Array.isArray(payload?.files) ? payload.files.slice(0, 30) : []
          };
        } catch (error) {
          data = {
            error: error?.message || String(error)
          };
        }
        break;
      }
      case 'serata': {
        const currentSerata = typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.getCurrentSerata === 'function'
          ? window.dataLoader.getCurrentSerata()
          : null;
        data = currentSerata || Storage.get(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, null);
        break;
      }
      case 'history': {
        const history = typeof window !== 'undefined' && window.dataLoader && typeof window.dataLoader.getSerataHistory === 'function'
          ? window.dataLoader.getSerataHistory(200)
          : null;
        data = history || Storage.get(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY, []);
        break;
      }
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
      const emptyMessage = type === 'serata'
        ? 'Nessuna serata corrente salvata ancora. Salva o archivia una serata da Borderò per vederne i dettagli.'
        : type === 'history'
          ? 'Nessuna cronologia serate presente ancora. Archivia una serata per popolare questo elenco.'
          : 'Nessun dato disponibile per questa sezione.';
      return `<div class="data-viewer-empty">${emptyMessage}</div>`;
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

    if ((type === 'comuni' || type === 'dbase' || type === 'location') && Array.isArray(data)) {
      if (type === 'location') {
        const rows = data.slice(0, 20).map((item) => `
          <tr>
            <td>${this.escapeHtml(item.nome_evento || '')}</td>
            <td>${this.escapeHtml(item.localita || '')}</td>
            <td>${this.escapeHtml(item.provincia || '')}</td>
            <td>${this.escapeHtml(item.referente || '')}</td>
          </tr>`).join('');

        return `
          <div class="data-viewer-summary">${data.length} location caricate • anteprima 20 righe</div>
          <table class="data-viewer-table">
            <thead><tr><th>Evento</th><th>Localita</th><th>Provincia</th><th>Referente</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

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

    if (type === 'music-archive' && data && typeof data === 'object') {
      if (data.error) {
        return `<div class="data-viewer-empty">Errore archivio: ${this.escapeHtml(data.error)}</div>`;
      }

      const sample = Array.isArray(data.sample) ? data.sample : [];
      const rows = sample.slice(0, 20).map((item) => `
        <tr>
          <td>${this.escapeHtml(item.relativePath || '')}</td>
          <td>${this.escapeHtml(item.fileName || '')}</td>
          <td>${this.escapeHtml(this.formatBytes(item.size || 0))}</td>
          <td>${this.escapeHtml(item.modifiedAt || '')}</td>
        </tr>
      `).join('');

      const summary = [
        `${Number(data.fileCount) || 0} file audio trovati`,
        data.exists ? 'cartella raggiungibile' : 'cartella non raggiungibile',
        data.rootPath ? `root: ${data.rootPath}` : null
      ].filter(Boolean).join(' • ');

      return `
        <div class="data-viewer-summary">${this.escapeHtml(summary)}</div>
        <table class="data-viewer-table">
          <thead><tr><th>Percorso relativo</th><th>File</th><th>Dimensione</th><th>Ultima modifica</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Nessun file da mostrare in anteprima</td></tr>'}</tbody>
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

  formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

    document.getElementById('btn-clear-location-cache').addEventListener('click', () => {
      localStorage.removeItem('BORDERO_LOCATION_DATA');
      localStorage.removeItem(BORDERO_CONFIG.CACHE_KEY_LOCATION);
      this.log('✓ Location cache cleared', 'success');
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

  /* ========== ELECTRON LAUNCHER ========== */
  setupElectronLauncher() {
    const launchBtn = document.getElementById('btn-launch-electron');
    const swapBtn = document.getElementById('btn-swap-monitors');
    const primaryMonitorSelect = document.getElementById('select-primary-monitor');
    const applyPrimaryMonitorBtn = document.getElementById('btn-apply-primary-monitor');
    if (!launchBtn && !swapBtn && !primaryMonitorSelect && !applyPrimaryMonitorBtn) return;

    const updateSwapButton = (enabled) => {
      if (!swapBtn) return;
      swapBtn.textContent = `Inverti Monitor: ${enabled ? 'ON' : 'OFF'}`;
      swapBtn.classList.toggle('btn-primary', enabled);
      swapBtn.classList.toggle('btn-secondary', !enabled);
    };

    const updatePrimaryMonitorSelect = (payload) => {
      if (!primaryMonitorSelect) return;

      const explicitChoice = Number(payload?.primaryMonitorChoice);
      const resolvedChoice = explicitChoice === 1 || explicitChoice === 2
        ? explicitChoice
        : (Boolean(payload?.swapPrimarySecondary) ? 2 : 1);

      primaryMonitorSelect.value = String(resolvedChoice);
    };

    const loadSwapStatus = async () => {
      if (!swapBtn && !primaryMonitorSelect) return;
      try {
        const response = await fetch('/api/electron/monitor-preferences', {
          method: 'GET',
          cache: 'no-store'
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        updateSwapButton(Boolean(payload.swapPrimarySecondary));
        updatePrimaryMonitorSelect(payload);
      } catch (error) {
        this.log(`Impossibile leggere stato swap monitor: ${error?.message || error}`, 'warn');
      }
    };

    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        this.log('Avvio Electron dual-monitor...', 'info');
        try {
          const terminalCommand = 'npm run electron';
          this.log(`Comando pronto: ${terminalCommand}`, 'success');
          Toast.success('Launcher Electron pronto. Avvia il progetto da terminale con npm run electron');
        } catch (error) {
          this.log(`Errore avvio Electron: ${error?.message || error}`, 'error');
          Toast.error('Impossibile avviare Electron da qui');
        }
      });
    }

    if (swapBtn) {
      swapBtn.addEventListener('click', async () => {
        swapBtn.disabled = true;
        try {
          const response = await fetch('/api/electron/swap-monitors', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = await response.json();
          const isEnabled = Boolean(payload.swapPrimarySecondary);
          updateSwapButton(isEnabled);
          updatePrimaryMonitorSelect(payload);
          this.log(`Swap monitor ${isEnabled ? 'attivato' : 'disattivato'}: applicazione Electron aggiornata`, 'success');
          Toast.success(`Swap monitor ${isEnabled ? 'ON' : 'OFF'}`);
        } catch (error) {
          this.log(`Errore swap monitor: ${error?.message || error}`, 'error');
          Toast.error('Impossibile invertire i monitor');
        } finally {
          swapBtn.disabled = false;
        }
      });
    }

    if (applyPrimaryMonitorBtn && primaryMonitorSelect) {
      applyPrimaryMonitorBtn.addEventListener('click', async () => {
        applyPrimaryMonitorBtn.disabled = true;
        primaryMonitorSelect.disabled = true;

        try {
          const requestedChoice = Number(primaryMonitorSelect.value) === 2 ? 2 : 1;
          const shouldSwap = requestedChoice === 2;

          const response = await fetch('/api/electron/swap-monitors', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              swapPrimarySecondary: shouldSwap
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = await response.json();
          updateSwapButton(Boolean(payload.swapPrimarySecondary));
          updatePrimaryMonitorSelect(payload);
          this.log(`Monitor principale impostato su ${requestedChoice}: applicazione Electron aggiornata`, 'success');
          Toast.success(`Monitor principale ${requestedChoice} applicato`);
        } catch (error) {
          this.log(`Errore impostazione monitor principale: ${error?.message || error}`, 'error');
          Toast.error('Impossibile impostare il monitor principale');
        } finally {
          applyPrimaryMonitorBtn.disabled = false;
          primaryMonitorSelect.disabled = false;
        }
      });
    }

    loadSwapStatus();
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
  addSyncLog(message, type = 'info') {
    const output = document.getElementById('sync-feedback-output');
    if (!output) return;
    const logEl = document.createElement('div');
    logEl.className = `sync-log ${type}`;
    logEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    output.appendChild(logEl);
    output.scrollTop = output.scrollHeight;
  }

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

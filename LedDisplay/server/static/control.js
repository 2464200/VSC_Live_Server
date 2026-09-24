(() => {
  const key = 'bordero-led-display-settings';
  const defaults = { messages: '*** MONSTER COUNTRY GROUP ***\nPROSSIMA COREOGRAFIA: {NEXT}\nDJ: {DJ}\nBUON BALLO A TUTTI!!!', useNext: true, speed: 55, direction: 'left', textColor: '#ff0000', rainbow: false, hold: 2, blink: false, paused: false };
  const controls = ['messages', 'use-next', 'speed', 'direction', 'text-color', 'rainbow', 'hold', 'blink'];
  const read = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...defaults }; } };
  const save = () => { const config = Object.fromEntries(controls.map(id => [id, document.getElementById(id).type === 'checkbox' ? document.getElementById(id).checked : document.getElementById(id).value])); config.textColor = config['text-color']; delete config['text-color']; config.speed = Number(config.speed); config.hold = Number(config.hold); config.paused = document.getElementById('pause').dataset.paused === 'true'; config.updatedAt = new Date().toISOString(); localStorage.setItem(key, JSON.stringify(config)); document.getElementById('speed-output').textContent = `${config.speed} px/s`; document.getElementById('hold-output').textContent = `${config.hold} s`; document.getElementById('status').textContent = 'Salvato'; };
  const fill = () => { const config = read(); controls.forEach(id => { const node = document.getElementById(id); const value = id === 'text-color' ? config.textColor : config[id]; node[node.type === 'checkbox' ? 'checked' : 'value'] = value; }); document.getElementById('pause').dataset.paused = config.paused; document.getElementById('pause').textContent = config.paused ? 'Riprendi' : 'Pausa'; document.getElementById('speed-output').textContent = `${config.speed} px/s`; document.getElementById('hold-output').textContent = `${config.hold} s`; };
  async function loadNext() { try { const text = await fetch(`/NextCoreo.csv?t=${Date.now()}`, { cache:'no-store' }).then(response => response.text()); const cells = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0].split(','); const name = (cells[1] || cells[0] || '').trim(); document.getElementById('status').textContent = name ? `NextCoreo: ${name}` : 'NextCoreo vuoto'; } catch { document.getElementById('status').textContent = 'NextCoreo non disponibile'; } }
  fill(); if (!localStorage.getItem(key)) save(); controls.forEach(id => { const node = document.getElementById(id); node.addEventListener('input', save); node.addEventListener('change', save); }); window.addEventListener('beforeunload', save); window.addEventListener('storage', event => { if (event.key === key) fill(); }); document.getElementById('pause').addEventListener('click', event => { const button = event.currentTarget; button.dataset.paused = button.dataset.paused !== 'true'; button.textContent = button.dataset.paused === 'true' ? 'Riprendi' : 'Pausa'; save(); }); document.getElementById('load-next').addEventListener('click', loadNext); document.getElementById('open-secondary').addEventListener('click', event => { if (!window.electronAPI?.windowManager) return; event.preventDefault(); window.electronAPI.windowManager.openSecondaryPage({ path: '/LedDisplay/server/static/index.html' }); }); document.getElementById('turn-off-secondary').addEventListener('click', async () => { if (!window.electronAPI?.windowManager) return; const result = await window.electronAPI.windowManager.restoreSecondaryPage(); document.getElementById('status').textContent = result?.success ? 'Pagina precedente ripristinata' : 'Impossibile ripristinare il display'; }); if (read().useNext) loadNext();
  const presetKey = 'bordero-led-presets';
  const defaultPresets = [
    '*** MONSTER COUNTRY GROUP ***\nDJ: {DJ}\nPROSSIMA COREOGRAFIA: {NEXT}\nBUON BALLO A TUTTI!!!',
    '*** MONSTER COUNTRY GROUP ***\nDJ {DJ}\n{EVENTO}\n{LUOGO}\n{DATA}',
    '*** MONSTER COUNTRY GROUP ***\nPROSSIMA COREOGRAFIA: {NEXT}',
    '*** MONSTER COUNTRY GROUP ***\nRAGAZZI, RIGHE E FILE...COME SEMPRE',
    '*** MONSTER COUNTRY GROUP ***\n{EVENTO}-{LUOGO}-{DATA}',
    "C'E' DA SPOSTARE UNA MACCHINA...E' UN DIESEL"
  ];
  const presetModal = document.getElementById('preset-modal');
  const presetSlots = Array.from(document.querySelectorAll('.preset-slot'));
  const confirmPresetButton = document.getElementById('confirm-preset');
  let selectedPreset = null;
  let presetSaveQueue = Promise.resolve();
  const readLocalPresets = () => { try { const stored = JSON.parse(localStorage.getItem(presetKey) || '[]'); return Array.isArray(stored) ? stored : []; } catch { return []; } };
  const applyPresets = stored => presetSlots.forEach((slot, index) => { slot.value = stored[index] || ''; });
  const loadPresets = async () => {
    const local = readLocalPresets();
    try {
      const response = await fetch('/api/led-display/presets?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Archivio non disponibile');
      const payload = await response.json();
      const stored = Array.isArray(payload.presets) ? payload.presets : [];
      const presets = stored.some(Boolean) ? stored : (local.some(Boolean) ? local : defaultPresets);
      if (!stored.some(Boolean) && local.some(Boolean)) {
        await fetch('/api/led-display/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presets: local }) });
      }
      applyPresets(presets);
      localStorage.setItem(presetKey, JSON.stringify(presets));
    } catch {
      applyPresets(local.some(Boolean) ? local : defaultPresets);
    }
  };
  const savePresets = () => {
    const presets = presetSlots.map(slot => slot.value);
    localStorage.setItem(presetKey, JSON.stringify(presets));
    presetSaveQueue = presetSaveQueue.catch(() => {}).then(async () => {
      const response = await fetch('/api/led-display/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presets }) });
      if (!response.ok) throw new Error('Salvataggio archivio non riuscito');
    });
    return presetSaveQueue;
  };
  const closePresets = async () => { await savePresets(); presetModal.hidden = true; };
  const selectPreset = slot => { presetSlots.forEach(s => s.classList.remove('selected')); slot.classList.add('selected'); selectedPreset = slot; confirmPresetButton.disabled = false; };
  presetSlots.forEach(slot => { slot.addEventListener('focus', () => selectPreset(slot)); slot.addEventListener('input', savePresets); });
  document.getElementById('open-presets').addEventListener('click', async () => { await loadPresets(); presetModal.hidden = false; });
  document.getElementById('close-presets').addEventListener('click', () => { void closePresets(); });
  presetModal.addEventListener('click', event => { if (event.target === presetModal) void closePresets(); });
  confirmPresetButton.addEventListener('click', async () => { if (!selectedPreset) return; await savePresets(); document.getElementById('messages').value = selectedPreset.value; save(); presetModal.hidden = true; });
})();

(() => {
  const activeKey = 'bordero_led_display_active';
  const turnOffButton = document.getElementById('turn-off-secondary');
  const updateIndicator = active => turnOffButton?.classList.toggle('remote-action-pending', active);
  const applyRoute = route => {
    if (!route?.secondaryUpdated) return;
    const active = String(route.path || '').toLowerCase() === '/leddisplay/server/static/index.html';
    localStorage.setItem(activeKey, String(active));
    updateIndicator(active);
  };

  updateIndicator(false);
  window.electronAPI?.monitorPolicy?.onRouted?.(applyRoute);
  window.electronAPI?.monitorPolicy?.getLastRoute?.().then(result => applyRoute(result?.event));
})();
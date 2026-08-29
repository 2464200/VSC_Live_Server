(() => {
  'use strict';
  const el = {
    state: document.getElementById('connectionState'), next: document.getElementById('nextCoreoValue'), nextDetail: document.getElementById('nextCoreoDetail'), dj: document.getElementById('mobileDj'), data: document.getElementById('mobileData'), luogo: document.getElementById('mobileLuogo'), evento: document.getElementById('mobileEvento'), completed: document.getElementById('mobileCompleted'), updated: document.getElementById('updatedAt'), list: document.getElementById('dataBody'), empty: document.getElementById('emptyState'), container: document.getElementById('scrollContainer'), settings: document.getElementById('settingsPanel'), speed: document.getElementById('speed'), speedValue: document.getElementById('speedValue'), pause: document.getElementById('pause'), pauseValue: document.getElementById('pauseValue'), toggle: document.getElementById('scrollToggle')
  };
  let frame;
  let lastFrame = 0;
  let direction = 1;
  let pausedUntil = 0;
  let scrolling = true;
  let refreshTimer;

  function connection(label, kind) { el.state.textContent = label; el.state.dataset.kind = kind; }
  function completed(item) { const value = String(item?.status || item?.flag || '').toUpperCase(); return item?.executed === true || value === 'X' || value === 'ESEGUITO'; }

  function render(payload) {
    const metadata = payload?.metadata || {};
    const next = payload?.next || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    el.dj.textContent = metadata.dj || '--'; el.data.textContent = metadata.data || '--'; el.luogo.textContent = metadata.luogo || '--'; el.evento.textContent = metadata.evento || '--';
    el.completed.textContent = `${items.filter(completed).length}/${items.length}`;
    el.next.textContent = next.title || '--'; el.nextDetail.textContent = [next.id ? `ID ${next.id}` : '', next.infoLevel || ''].filter(Boolean).join(' | ');
    const date = payload?.updatedAt ? new Date(payload.updatedAt) : null;
    el.updated.textContent = date && !Number.isNaN(date.getTime()) ? `Aggiornato ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'In attesa dati';
    el.list.replaceChildren();
    items.forEach((item, index) => {
      const done = completed(item);
      const blocked = item.displayState === 'blocked';
      const card = document.createElement('article');
      const muted = !done && !blocked && index >= 4;
      card.className = `choreography-card${done ? ' is-completed' : ''}${blocked ? ' is-blocked' : ''}${muted ? ' is-muted' : ''}`;
      const number = document.createElement('span'); number.className = 'card-number'; number.textContent = done ? '✓' : String(index + 1);
      const title = document.createElement('h2'); title.textContent = item.title || item.titolo || item.coreografia || '--';
      const detail = document.createElement('p'); detail.className = 'card-details'; detail.textContent = [item.id ? `ID ${item.id}` : '', item.song || item.brano || '', item.author || item.autore || '', item.choreographer || item.coreografo || ''].filter(Boolean).join(' | ');
      card.append(number, title, detail); el.list.append(card);
    });
    el.empty.hidden = items.length > 0;
  }

  function loadJsonp(endpoint) {
    return new Promise((resolve, reject) => {
      const callback = `mobileDisplay_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const script = document.createElement('script');
      const timeout = setTimeout(() => finish(new Error('Timeout Google')), 12000);
      function finish(error, payload) {
        clearTimeout(timeout); delete window[callback]; script.remove();
        if (error) reject(error); else resolve(payload);
      }
      window[callback] = (payload) => finish(null, payload);
      script.onerror = () => finish(new Error('Connessione Google non disponibile'));
      script.src = `${endpoint}${endpoint.includes('?') ? '&' : '?'}callback=${callback}&t=${Date.now()}`;
      document.head.append(script);
    });
  }

  async function refresh() {
    const config = window.MOBILE_DISPLAY_CONFIG || {};
    if (!config.endpoint || config.endpoint.includes('YOUR_GOOGLE')) { connection('Google da configurare', 'error'); return; }
    connection('Aggiornamento...', 'waiting');
    try { render(await loadJsonp(config.endpoint)); connection('Live', 'live'); }
    catch (error) { connection('Connessione non disponibile', 'error'); console.error('Google display:', error.message); }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer); refreshTimer = setTimeout(async () => { await refresh(); scheduleRefresh(); }, Number(window.MOBILE_DISPLAY_CONFIG?.refreshMs) || 10000);
  }
  function scroll(timestamp) {
    if (!scrolling) return;
    if (!lastFrame) lastFrame = timestamp;
    if (timestamp >= pausedUntil) {
      el.container.scrollTop += direction * Number(el.speed.value) * 10 * (timestamp - lastFrame) / 1000;
      const bottom = el.container.scrollTop + el.container.clientHeight >= el.container.scrollHeight - 1;
      if (bottom || el.container.scrollTop <= 0) { direction = bottom ? -1 : 1; pausedUntil = timestamp + Number(el.pause.value) * 1000; }
    }
    lastFrame = timestamp; frame = requestAnimationFrame(scroll);
  }
  function updateControls() { el.speedValue.textContent = el.speed.value; el.pauseValue.textContent = `${el.pause.value} s`; }
  function toggleScroll() { scrolling = !scrolling; el.toggle.textContent = scrolling ? 'Pausa' : 'Riprendi'; cancelAnimationFrame(frame); if (scrolling) { lastFrame = 0; frame = requestAnimationFrame(scroll); } }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (error) { console.warn('Fullscreen:', error); } }

  document.getElementById('refreshButton').addEventListener('click', refresh);
  document.getElementById('settingsButton').addEventListener('click', () => el.settings.showModal());
  document.getElementById('fullscreenToggle').addEventListener('click', fullscreen);
  el.toggle.addEventListener('click', toggleScroll); el.speed.addEventListener('input', updateControls); el.pause.addEventListener('input', updateControls);
  updateControls(); frame = requestAnimationFrame(scroll); refresh(); scheduleRefresh();
})();
(() => {
  const body = document.getElementById('data-body');
  const container = document.getElementById('scrollContainer');
  const loader = document.getElementById('loader');
  const menu = document.getElementById('menuPanel');
  const speed = document.getElementById('speed');
  const pause = document.getElementById('pause');
  const speedValue = document.getElementById('speedValue');
  const pauseValue = document.getElementById('pauseValue');
  let frame = 0;
  let lastFrame = 0;
  let direction = 1;
  let pauseUntil = 0;
  let scrolling = true;

  function parseCsv(text) {
    const rows = [];
    let value = '';
    let row = [];
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') { value += character; index += 1; } else quoted = !quoted;
      } else if (character === ',' && !quoted) { row.push(value); value = ''; }
      else if (character === '\n' && !quoted) { row.push(value); rows.push(row); row = []; value = ''; }
      else if (character !== '\r') value += character;
    }
    if (value || row.length) { row.push(value); rows.push(row); }
    return rows;
  }

  function clean(value) { return String(value || '').trim().replace(/^"+|"+$/g, ''); }
  function updateControls() { speedValue.textContent = speed.value; pauseValue.textContent = pause.value; }
  function renderRows(rows) {
    body.replaceChildren();
    rows.slice(3).filter((row) => row.some((cell) => clean(cell))).forEach((row) => {
      const cells = row.map(clean);
      if (!cells[1] && !cells[2]) return;
      const card = document.createElement('div');
      card.className = `choreo-card${cells[0].toUpperCase() === 'X' ? ' executed' : ''}`;
      card.textContent = cells.slice(1).filter(Boolean).join(' | ');
      body.append(card);
    });
  }

  async function refresh() {
    try {
      const [displayResponse, nextResponse] = await Promise.all([
        fetch(`display.csv?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`NextCoreo.csv?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      if (!displayResponse.ok) throw new Error(`display.csv HTTP ${displayResponse.status}`);
      renderRows(parseCsv(await displayResponse.text()));
      if (nextResponse.ok) {
        const next = parseCsv(await nextResponse.text())[0] || [];
        document.getElementById('nextCoreoValue').textContent = clean(next[1]) || clean(next[0]) || '--';
      }
      loader.classList.add('hidden');
    } catch (error) {
      console.error('Aggiornamento index display:', error);
      loader.classList.remove('hidden');
    }
  }

  function scroll(timestamp) {
    if (!scrolling) return;
    if (!lastFrame) lastFrame = timestamp;
    if (timestamp >= pauseUntil) {
      container.scrollTop += direction * Number(speed.value) * 10 * (timestamp - lastFrame) / 1000;
      const bottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
      if (bottom || container.scrollTop <= 0) { direction = bottom ? -1 : 1; pauseUntil = timestamp + Number(pause.value) * 1000; }
    }
    lastFrame = timestamp;
    frame = requestAnimationFrame(scroll);
  }

  window.toggleMenu = () => menu.classList.toggle('active');
  window.toggleFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  document.getElementById('stopScroll').addEventListener('click', () => { scrolling = false; cancelAnimationFrame(frame); });
  document.getElementById('resumeScroll').addEventListener('click', () => { if (!scrolling) { scrolling = true; lastFrame = 0; frame = requestAnimationFrame(scroll); } });
  speed.addEventListener('input', updateControls); pause.addEventListener('input', updateControls);
  updateControls(); refresh(); setInterval(refresh, 10000); frame = requestAnimationFrame(scroll);
})();
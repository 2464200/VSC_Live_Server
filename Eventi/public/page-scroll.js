(() => {
  function initPageScroll() {
    if (document.getElementById('eventi-page-scroll')) return;

    const controls = document.createElement('nav');
    controls.id = 'eventi-page-scroll';
    controls.className = 'eventi-page-scroll';
    controls.setAttribute('aria-label', 'Scorrimento pagina');
    controls.hidden = true;

    const spacer = document.createElement('div');
    spacer.className = 'eventi-page-scroll-space';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.hidden = true;

    function createButton(label, path, toBottom) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'eventi-page-scroll-button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}" /></svg>`;
      button.addEventListener('click', () => {
        const page = document.scrollingElement || document.documentElement;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({
          top: toBottom ? page.scrollHeight - page.clientHeight : 0,
          left: window.scrollX,
          behavior: reducedMotion ? 'auto' : 'smooth'
        });
      });
      controls.appendChild(button);
      return button;
    }

    const topButton = createButton('Vai a inizio pagina', 'M5 4h14 M12 20V8 M7 13l5-5 5 5', false);
    const bottomButton = createButton('Vai a fondo pagina', 'M5 20h14 M12 4v12 M7 11l5 5 5-5', true);
    document.body.append(spacer, controls);

    let pendingFrame = false;

    function updateControls() {
      pendingFrame = false;
      const page = document.scrollingElement || document.documentElement;
      // Lo spazio dei tasti non deve far apparire scorrevole una pagina corta.
      const contentHeight = page.scrollHeight - spacer.offsetHeight;
      const scrollable = contentHeight > page.clientHeight + 1;
      if (controls.hidden === scrollable) controls.hidden = !scrollable;
      if (spacer.hidden === scrollable) spacer.hidden = !scrollable;

      const maxScroll = Math.max(0, page.scrollHeight - page.clientHeight);
      topButton.disabled = page.scrollTop <= 1;
      bottomButton.disabled = page.scrollTop >= maxScroll - 1;
    }

    function scheduleUpdate() {
      if (pendingFrame) return;
      pendingFrame = true;
      window.requestAnimationFrame(updateControls);
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleUpdate);
    }
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(document.body);
      resizeObserver.observe(document.documentElement);
    }
    // Ricalcola anche quando filtri e aggiornamenti cambiano gli elenchi.
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class']
    });
    scheduleUpdate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageScroll, { once: true });
  } else {
    initPageScroll();
  }
})();

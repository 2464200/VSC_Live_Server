// Small non-blocking toast helper
(function(){
  function ensureToastContainer() {
    let c = document.getElementById('site-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'site-toast-container';
      c.style.position = 'fixed';
      c.style.right = '20px';
      c.style.bottom = '20px';
      c.style.zIndex = 99999;
      document.body.appendChild(c);
    }
    return c;
  }

  window.showToast = function(message, ms = 3000) {
    const c = ensureToastContainer();
    const t = document.createElement('div');
    t.className = 'site-toast';
    t.textContent = message;
    t.style.background = 'rgba(0,0,0,0.85)';
    t.style.color = '#fff';
    t.style.padding = '10px 14px';
    t.style.marginTop = '8px';
    t.style.borderRadius = '8px';
    t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    t.style.fontSize = '13px';
    t.style.opacity = '0';
    t.style.transition = 'opacity 180ms ease, transform 220ms ease';
    t.style.transform = 'translateY(6px)';
    c.appendChild(t);
    // enter
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });
    const timeout = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(6px)';
      setTimeout(() => t.remove(), 240);
    }, ms);
    // allow click to dismiss
    t.addEventListener('click', () => { clearTimeout(timeout); t.remove(); });
    return t;
  };
})();

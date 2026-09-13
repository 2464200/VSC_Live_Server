(function () {
  function isHomeHref(href) {
    if (!href) return false;
    return href === 'index.html' || href === '../index.html' || /\/index\.html$/i.test(href);
  }

  function setupHomeBreadcrumbGuard() {
    const breadcrumbs = document.querySelectorAll('.nav-breadcrumb');
    if (!breadcrumbs.length) return;

    breadcrumbs.forEach((nav) => {
      const links = nav.querySelectorAll('a[href]');
      links.forEach((link) => {
        if (link.dataset.boundHomeGuard === 'true') return;

        const rawHref = (link.getAttribute('href') || '').trim();
        const normalized = rawHref.toLowerCase();
        if (!isHomeHref(normalized)) return;

        link.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const targetHref = (link.getAttribute('href') || '../index.html').trim();
          window.location.assign(targetHref);
        });

        link.dataset.boundHomeGuard = 'true';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHomeBreadcrumbGuard);
  } else {
    setupHomeBreadcrumbGuard();
  }
})();

(function () {
    const mountId = 'global-nav-container';
    const homeUrl = '/Bordero/index.html';

    function getPageName() {
        const title = document.title.trim();
        return title.replace(/^BORDER[OÒ]['’]?\s*-\s*/i, '').replace(/\s*\|\s*Bordero$/i, '') || 'Pagina corrente';
    }

    function init() {
        if (document.querySelector('.nav-breadcrumb') || document.getElementById(mountId)) return;

        const container = document.createElement('div');
        container.id = mountId;
        container.innerHTML = `<nav class="nav-breadcrumb" aria-label="Navigazione pagina" style="max-width:1400px;margin:16px auto;padding:0 15px;color:#fff;font:600 16px 'Segoe UI',Tahoma,sans-serif;"><a href="${homeUrl}" style="color:#ff7f00;text-decoration:none;">Home</a><span aria-hidden="true" style="margin:0 20px;color:#ccc;">/</span><span style="color:#fff;">${getPageName()}</span></nav>`;
        document.body.insertBefore(container, document.body.firstChild);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

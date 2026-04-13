(function() {
    const mountId = 'global-nav-container';
    const defaultNav = `<nav class="global-nav" style="background:#222;color:#fff;padding:10px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
    <a href="/diagnostica.html" style="color:#fff;text-decoration:none;">Diagnostica</a>
    <a href="/servizio.html" style="color:#fff;text-decoration:none;">Servizio</a>
    <a href="/pdf-viewer.html" style="color:#fff;text-decoration:none;">PDF Viewer</a>
    <a href="/ScriptPDF1.html" style="color:#fff;text-decoration:none;">ScriptPDF1</a>
    <a href="/ScriptPDF1_prova.html" style="color:#fff;text-decoration:none;">ScriptPDF1_prova</a>
    <a href="/Prova/ScriptPDF1.html" style="color:#fff;text-decoration:none;">Prova ScriptPDF1</a>
    <a href="/Prova/test-scriptpdf1.html" style="color:#fff;text-decoration:none;">Test ScriptPDF1</a>
    <a href="/NextCoreo1.html" style="color:#fff;text-decoration:none;">NextCoreo1</a>
    <a href="/NextCoreo2.html" style="color:#fff;text-decoration:none;">NextCoreo2</a>
    <a href="/Prova/Report.html" style="color:#fff;text-decoration:none;">Report</a>
    <a href="/Prova/Report_black.html" style="color:#fff;text-decoration:none;">Report_black</a>
    <a href="/Prova/Report_white.html" style="color:#fff;text-decoration:none;">Report_white</a>
    <a href="/eventi/eventi.html" style="color:#fff;text-decoration:none;">Eventi</a>
    <a href="/eventi/dj-manager.html" style="color:#fff;text-decoration:none;">DJ Manager</a>
    <a href="/eventi/admin.html" style="color:#fff;text-decoration:none;">Admin Eventi</a>
    <a href="/eventi/spuntati.html" style="color:#fff;text-decoration:none;">Spuntati</a>
    <a href="/eventi/non-spuntati.html" style="color:#fff;text-decoration:none;">Non Spuntati</a>
    <a href="/eventi/prenotati.html" style="color:#fff;text-decoration:none;">Prenotati</a>
    <a href="/eventi/tutti.html" style="color:#fff;text-decoration:none;">Tutti</a>
    <a href="/eventi/visualizer.html" style="color:#fff;text-decoration:none;">Visualizer</a>
    <a href="/Prova/Logo.html" style="color:#fff;text-decoration:none;">Logo</a>
    <a href="/Prova/Webcam.html" style="color:#fff;text-decoration:none;">Webcam</a>
    <a href="/temp.html" style="color:#fff;text-decoration:none;">Temp</a>
    <a href="/public/mobile.html" style="color:#fff;text-decoration:none;">Mobile</a>
    <a href="/public/404.html" style="color:#fff;text-decoration:none;">404</a>
</nav>`;

    async function loadNav() {
        try {
            const response = await fetch('/nav.html', { cache: 'no-store' });
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            console.warn('Impossibile caricare nav.html, uso template interno', e);
        }
        return defaultNav;
    }

    async function init() {
        const navHtml = await loadNav();
        let container = document.getElementById(mountId);
        if (!container) {
            container = document.createElement('div');
            container.id = mountId;
            document.body.insertBefore(container, document.body.firstChild);
        }
        container.innerHTML = navHtml;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

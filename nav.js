(function() {
    const mountId = 'global-nav-container';
    const defaultNav = `<nav class="global-nav" style="background:#222;color:#fff;padding:10px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
    <a href="/diagnostica.html" style="color:#fff;text-decoration:none;">Diagnostica</a>
    <a href="/servizio.html" style="color:#fff;text-decoration:none;">Servizio</a>
    <a href="/pdf/viewers/pdf-viewer.html" style="color:#fff;text-decoration:none;">PDF Viewer</a>
    <a href="/ScriptPDF1.html" style="color:#fff;text-decoration:none;">ScriptPDF1</a>
    <a href="/Prova/ScriptPDF1.html" style="color:#fff;text-decoration:none;">Prova ScriptPDF1</a>
    <a href="/Prova/test-scriptpdf1.html" style="color:#fff;text-decoration:none;">Test ScriptPDF1</a>
    <a href="/NextCoreo1.html" style="color:#fff;text-decoration:none;">NextCoreo1</a>
    <a href="/NextCoreo2.html" style="color:#fff;text-decoration:none;">NextCoreo2</a>
    <a href="/Prova/Report.html" style="color:#fff;text-decoration:none;">Report</a>
    <a href="/Prova/Report_black.html" style="color:#fff;text-decoration:none;">Report_black</a>
    <a href="/Prova/Report_white.html" style="color:#fff;text-decoration:none;">Report_white</a>
    <a href="/eventi/eventi.html" style="color:#fff;text-decoration:none;">Eventi</a>
    <a href="/Prova/Logo.html" style="color:#fff;text-decoration:none;">Logo</a>
    <a href="/Prova/Webcam.html" style="color:#fff;text-decoration:none;">Webcam</a>
    <a href="/temp.html" style="color:#fff;text-decoration:none;">Temp</a>
    <a href="/mobile.html" style="color:#fff;text-decoration:none;">Mobile</a>
    <a href="/LedDisplay.html" style="color:#fff;text-decoration:none;">LedDisplay</a>
</nav>`;

    function resolveNavUrl(url) {
        if (window.resolveAppUrl) {
            return window.resolveAppUrl(url);
        }
        return url;
    }

    function rewriteAnchors(container) {
        if (!container) return;
        container.querySelectorAll('a[href]').forEach((link) => {
            const original = link.getAttribute('href');
            if (!original || /^(?:[a-z]+:)?\/\//i.test(original) || /^(?:mailto|tel|data|javascript):/i.test(original) || original.startsWith('#')) {
                return;
            }
            const resolved = resolveNavUrl(original);
            if (resolved !== original) {
                link.setAttribute('href', resolved);
            }
        });
    }

    async function loadNav() {
        try {
            const response = await fetch(resolveNavUrl('/nav.html'), { cache: 'no-store' });
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
        rewriteAnchors(container);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

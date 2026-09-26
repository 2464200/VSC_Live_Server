(function () {
    const mountId = 'global-nav-container';
    const defaultHomeUrl = '/Bordero/index.html';
    const displayPath = '/bordero/pages/display.html';
    const displayWindowName = 'bordero-display-secondary';
    const primaryWindowName = 'bordero-primary';

    function normalizedPath(pathname) {
        return String(pathname || '').replace(/\\/g, '/').toLowerCase();
    }

    function isDisplayPage(pathname) {
        return normalizedPath(pathname).endsWith(displayPath);
    }

    function routeThroughElectron(url) {
        const openPage = window.electronAPI?.windowManager?.openSecondaryPage;
        if (typeof openPage !== 'function') return false;

        try {
            Promise.resolve(openPage({ path: `${url.pathname}${url.search}${url.hash}` }))
                .then((result) => {
                    if (!result?.success) {
                        window.alert?.('Impossibile aprire la pagina richiesta.');
                    }
                })
                .catch((error) => {
                    console.warn('Navigazione Bordero non riuscita:', error?.message || error);
                    window.alert?.('Impossibile aprire la pagina richiesta.');
                });
        } catch (error) {
            console.warn('Navigazione Bordero non riuscita:', error?.message || error);
            window.alert?.('Impossibile aprire la pagina richiesta.');
        }
        return true;
    }

    function movePopupToSecondaryScreen(popup, screenDetailsPromise) {
        if (!screenDetailsPromise) return;

        Promise.resolve(screenDetailsPromise).then((details) => {
            const secondary = details?.screens?.find((screen) => !screen.isPrimary);
            if (!secondary || popup.closed) return;

            const left = Math.round(Number(secondary.availLeft ?? secondary.left ?? 0));
            const top = Math.round(Number(secondary.availTop ?? secondary.top ?? 0));
            const width = Math.round(Number(secondary.availWidth ?? secondary.width ?? 1280));
            const height = Math.round(Number(secondary.availHeight ?? secondary.height ?? 720));
            popup.moveTo?.(left, top);
            popup.resizeTo?.(width, height);
        }).catch(() => {});
    }

    function openDisplayWindow(url) {
        let screenDetailsPromise = null;
        if (typeof window.getScreenDetails === 'function') {
            try {
                screenDetailsPromise = window.getScreenDetails();
            } catch (_) {}
        }

        const popup = window.open('', displayWindowName, 'popup=yes');
        if (!popup) {
            window.alert?.('Consenti i popup per aprire il Display sul monitor secondario.');
            return;
        }

        try {
            const currentUrl = new URL(popup.location.href);
            if (!isDisplayPage(currentUrl.pathname)) {
                popup.location.replace(url.href);
            }
        } catch (_) {
            popup.location.replace(url.href);
        }

        movePopupToSecondaryScreen(popup, screenDetailsPromise);
        window.focus?.();
    }

    function openPageInPrimaryWindow(url) {
        if (window.opener && !window.opener.closed) {
            window.opener.location.assign(url.href);
            window.opener.focus?.();
            return;
        }

        const primary = window.open(url.href, primaryWindowName);
        if (!primary) {
            window.alert?.('Impossibile aprire la pagina nella finestra principale.');
        }
    }

    function handleNavigationClick(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = event.target?.closest?.('a[href]');
        if (!anchor) return;

        let targetUrl;
        let currentUrl;
        try {
            targetUrl = new URL(anchor.href || anchor.getAttribute('href'), window.location.href);
            currentUrl = new URL(window.location.href);
        } catch (_) {
            return;
        }

        if (targetUrl.origin !== currentUrl.origin) return;

        const onDisplayPage = isDisplayPage(currentUrl.pathname);
        const toDisplayPage = isDisplayPage(targetUrl.pathname);
        if (!onDisplayPage && !toDisplayPage) return;
        if (onDisplayPage && toDisplayPage) return;

        event.preventDefault();
        event.stopPropagation();

        if (routeThroughElectron(targetUrl)) return;
        if (onDisplayPage) {
            openPageInPrimaryWindow(targetUrl);
        } else {
            openDisplayWindow(targetUrl);
        }
    }

    function getPageName() {
        const title = document.title.trim();
        return title.replace(/^BORDER[OÒ]['’]?\s*-\s*/i, '').replace(/\s*\|\s*Bordero$/i, '') || 'Pagina corrente';
    }

    function init() {
        const currentPath = normalizedPath(window.location.pathname);
        if (currentPath.startsWith('/bordero/')) {
            window.name = isDisplayPage(currentPath) ? displayWindowName : primaryWindowName;
        }

        document.addEventListener('click', handleNavigationClick, true);
        if (document.querySelector('.nav-breadcrumb') || document.getElementById(mountId)) return;

        let homeUrl = defaultHomeUrl;
        if (window.location.protocol === 'file:') {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/eventi/')) {
                homeUrl = '../../Bordero/index.html';
            } else if (path.includes('/bordero/pages/')) {
                homeUrl = '../index.html';
            } else {
                homeUrl = './Bordero/index.html';
            }
        }

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

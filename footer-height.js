(function () {
    let ro;
    function updateFooterHeight() {
        const footer = document.querySelector('footer');
        if (!footer) return;
        const h = Math.ceil(footer.getBoundingClientRect().height) || 0;
        document.documentElement.style.setProperty('--footer-height', h + 'px');
        if (!ro) {
            ro = new ResizeObserver(updateFooterHeight);
            ro.observe(footer);
        }
    }
    window.addEventListener('load', updateFooterHeight);
    window.addEventListener('resize', updateFooterHeight);
    // Aggiorna anche se il DOM cambia (contenuti dinamici)
    window.addEventListener('DOMContentLoaded', () => {
        const mo = new MutationObserver(updateFooterHeight);
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
        updateFooterHeight();
    });
})();
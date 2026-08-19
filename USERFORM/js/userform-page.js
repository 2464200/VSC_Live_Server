function normalizeRouteTarget(target) {
  if (!target) {
    return "";
  }

  try {
    const parsed = new URL(String(target), window.location.href);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    return String(target);
  }
}

function isCanonicalUserFormRoute(target) {
  const normalized = normalizeRouteTarget(target).toLowerCase();
  const fileName = normalized.split('/').filter(Boolean).pop() || '';
  const stem = fileName.replace(/\.html$/i, '');
  const canonicalSet = new Set(['qrcode', 'servizio', 'pagina03', 'pagina04', 'wecam', 'pagina06', 'pagina07', 'pagina08', 'pagina09', 'pagina10', 'pagina11']);
  return normalized.includes('/userform/pages/') && canonicalSet.has(stem);
}

function openManagedPage(target) {
  if (!target) {
    return false;
  }

  const finalTarget = String(target).trim();
  const normalizedRoute = normalizeRouteTarget(finalTarget);

  if (isCanonicalUserFormRoute(finalTarget) && window.electronAPI?.windowManager?.openSecondaryPage) {
    const routePath = normalizedRoute.startsWith("/") ? normalizedRoute : `/${normalizedRoute}`;
    window.electronAPI.windowManager.openSecondaryPage({ path: routePath }).catch(() => {
      window.open(finalTarget, "_blank", "noopener,noreferrer");
    });
    return true;
  }

  window.open(finalTarget, "_blank", "noopener,noreferrer");
  return true;
}

(function () {
  const forms = window.USERFORM_REGISTRY || [];
  const fileName = window.location.pathname.split("/").pop() || "";
  const pageId = fileName.replace(/\.html$/i, "");
  const index = forms.findIndex((f) => f.id === pageId);

  if (index < 0) {
    return;
  }

  const form = forms[index];
  const prev = forms[index - 1] || null;
  const next = forms[index + 1] || null;

  const titleNode = document.getElementById("form-name");
  const captionNode = document.getElementById("form-caption");
  const sizeNode = document.getElementById("form-size");
  const prevNode = document.getElementById("prev-form");
  const nextNode = document.getElementById("next-form");

  if (titleNode) titleNode.textContent = form.id;
  if (captionNode) captionNode.textContent = form.caption;
  if (sizeNode) sizeNode.textContent = `${form.clientWidth} x ${form.clientHeight}`;

  if (prevNode) {
    if (prev) {
      prevNode.href = `${prev.id}.html`;
      prevNode.removeAttribute("aria-disabled");
    } else {
      prevNode.setAttribute("aria-disabled", "true");
      prevNode.classList.add("btn-secondary");
    }
  }

  if (nextNode) {
    if (next) {
      nextNode.href = `${next.id}.html`;
      nextNode.removeAttribute("aria-disabled");
    } else {
      nextNode.setAttribute("aria-disabled", "true");
      nextNode.classList.add("btn-secondary");
    }
  }
})();

if (document.readyState !== "loading") {
  document.body?.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[data-open]");
    if (!anchor) {
      return;
    }

    event.preventDefault();
    openManagedPage(anchor.getAttribute("data-open") || anchor.href);
  });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    document.body?.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[data-open]");
      if (!anchor) {
        return;
      }

      event.preventDefault();
      openManagedPage(anchor.getAttribute("data-open") || anchor.href);
    });
  });
}


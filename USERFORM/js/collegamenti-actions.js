(function () {
  const cards = [...document.querySelectorAll(".collegamenti-resource-card")];
  const sections = [...document.querySelectorAll(".collegamenti-resource-section")];
  const searchInput = document.getElementById("resource-search");
  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  const countNode = document.getElementById("resource-count");
  const countLabel = document.getElementById("resource-count-label");
  const emptyState = document.getElementById("empty-resources");
  const statusNode = document.getElementById("collegamenti-status");
  const statusMessage = statusNode?.querySelector(".collegamenti-status-message");

  let activeFilter = "all";

  function setStatus(message, state = "ready") {
    if (statusNode && statusMessage) {
      statusNode.dataset.state = state;
      statusMessage.textContent = message;
    }
  }

  function updateResources() {
    const query = (searchInput?.value || "").trim().toLocaleLowerCase("it");
    let visibleCount = 0;

    for (const card of cards) {
      const matchesCategory = activeFilter === "all" || card.dataset.category === activeFilter;
      const searchableText = `${card.dataset.search || ""} ${card.textContent}`.toLocaleLowerCase("it");
      const matchesSearch = !query || searchableText.includes(query);
      const visible = matchesCategory && matchesSearch;

      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    for (const section of sections) {
      section.hidden = !section.querySelector(".collegamenti-resource-card:not([hidden])");
    }

    if (countNode) {
      countNode.textContent = String(visibleCount).padStart(2, "0");
    }
    if (countLabel) {
      countLabel.setAttribute("aria-label", `${visibleCount} risorse visibili su ${cards.length}`);
    }
    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      filterButtons.forEach((filterButton) => {
        const selected = filterButton === button;
        filterButton.classList.toggle("is-active", selected);
        filterButton.setAttribute("aria-pressed", String(selected));
      });
      updateResources();
    });
  });

  searchInput?.addEventListener("input", updateResources);

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      event.preventDefault();
      searchInput?.focus();
    }

    if (event.key === "Escape" && document.activeElement === searchInput && searchInput?.value) {
      searchInput.value = "";
      updateResources();
    }
  });

  document.querySelectorAll(".collegamenti-open-link[data-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const rawUrl = button.getAttribute("data-link") || "";

      try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:" || !["docs.google.com", "drive.google.com"].includes(url.hostname)) {
          throw new Error("Il collegamento non appartiene a un dominio Google autorizzato.");
        }

        if (typeof window.openManagedPage !== "function" || !window.openManagedPage(url.href)) {
          throw new Error("Il gestore di apertura dei collegamenti non è disponibile.");
        }

        const title = button.closest(".collegamenti-resource-card")?.querySelector("h3")?.textContent || "Risorsa";
        setStatus(`Apertura richiesta: ${title}.`);
      } catch (error) {
        setStatus(`Impossibile aprire il collegamento: ${error.message}`, "error");
      }
    });
  });

  document.getElementById("btn-close-collegamenti")?.addEventListener("click", () => {
    if (document.referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }

    window.location.href = "../index.html";
  });

  updateResources();
})();

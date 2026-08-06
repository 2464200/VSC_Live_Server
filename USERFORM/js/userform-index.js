(function () {
  const forms = window.USERFORM_REGISTRY || [];
  const grid = document.getElementById("forms-grid");

  if (!grid) {
    return;
  }

  if (!forms.length) {
    grid.innerHTML = "<p class=\"muted\">Nessun form registrato.</p>";
    return;
  }

  grid.innerHTML = forms
    .map((form) => {
      const size = `${form.clientWidth} x ${form.clientHeight}`;
      const implemented = new Set([
        "INDICE",
        "PAGINA01",
        "PAGINA02",
        "PAGINA03",
        "PAGINA04",
        "PAGINA05",
        "PAGINA06",
        "PAGINA07",
        "PAGINA08",
        "PAGINA09",
        "PAGINA10",
        "PAGINA11"
      ]);
      const badge = implemented.has(form.id) ? "MVP pronto" : "Placeholder";
      return `
        <article class="form-card">
          <span class="badge">${badge}</span>
          <h3>${form.id}</h3>
          <p class="meta">Caption VBA: ${form.caption}</p>
          <p class="meta">Client size: ${size}</p>
          <a class="btn" href="pages/${form.id}.html">Apri pagina</a>
        </article>
      `;
    })
    .join("");
})();


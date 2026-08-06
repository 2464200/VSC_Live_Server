(function () {
  const comboDBase = document.getElementById("combo-dbase");
  const comboComuni = document.getElementById("combo-comuni");
  const btnProva = document.getElementById("btn-prova");
  const btnClose = document.getElementById("btn-close-pagina01");
  const statusNode = document.getElementById("pagina01-status");
  const urlPill = document.getElementById("pagina01-url-pill");
  const captionNode = document.getElementById("pagina01-caption");

  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5500";
  const provaUrl = `${baseUrl}/Prova/ScriptPDF1.html`;

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.textContent = `Stato: ${msg}`;
    }
  };

  if (captionNode) {
    captionNode.textContent = "DJ'S BORDERO' - 2025 [DJ LUCAS BERRY]";
  }

  if (urlPill) {
    urlPill.textContent = provaUrl;
  }

  const dBaseSeed = ["A1", "A2", "A3"];
  const comuniSeed = [
    "F1772",
    "F1773",
    "F1774",
    "F1775",
    "F1776"
  ];

  const fillSelect = (node, items, placeholder) => {
    if (!node) {
      return;
    }

    node.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    node.appendChild(first);

    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      node.appendChild(opt);
    });
  };

  fillSelect(comboDBase, dBaseSeed, "Seleziona valore dBase");
  fillSelect(comboComuni, comuniSeed, "Seleziona valore ComuniItalia");

  if (comboDBase) {
    comboDBase.addEventListener("change", () => {
      setStatus(`ComboBox1 selezionato: ${comboDBase.value || "nessun valore"}`);
    });
  }

  if (comboComuni) {
    comboComuni.addEventListener("change", () => {
      setStatus(`ComboBox2 selezionato: ${comboComuni.value || "nessun valore"}`);
    });
  }

  if (btnProva) {
    btnProva.addEventListener("click", () => {
      window.open(provaUrl, "_blank", "noopener,noreferrer");
      setStatus("Prova_Click eseguito: apertura ScriptPDF1 richiesta.");
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/")) {
        window.history.back();
        return;
      }

      window.location.href = "../index.html";
    });
  }
})();

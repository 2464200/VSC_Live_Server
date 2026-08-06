(function () {
  const storeKey = "userform_pagina11_locations";

  const fields = {
    id: document.getElementById("fld-id"),
    nome: document.getElementById("fld-nome"),
    localita: document.getElementById("fld-localita"),
    tipoStruttura: document.getElementById("fld-tipo-struttura"),
    strutturaCoperta: document.getElementById("fld-struttura-coperta"),
    provincia: document.getElementById("fld-provincia"),
    paese: document.getElementById("fld-paese"),
    indirizzo: document.getElementById("fld-indirizzo"),
    civico: document.getElementById("fld-civico"),
    referente: document.getElementById("fld-referente"),
    cellReferente: document.getElementById("fld-cell-referente"),
    tipoPista: document.getElementById("fld-tipo-pista"),
    tipoPrese: document.getElementById("fld-tipo-prese"),
    audio: document.getElementById("fld-audio"),
    luci: document.getElementById("fld-luci"),
    service: document.getElementById("fld-service"),
    palcoDj: document.getElementById("fld-palco-dj"),
    palcoBall: document.getElementById("fld-palco-ball"),
    parcheggio: document.getElementById("fld-parcheggio"),
    bar: document.getElementById("fld-bar"),
    toilette: document.getElementById("fld-toilette")
  };

  const filtroCampo = document.getElementById("filtro-campo");
  const filtroValore = document.getElementById("filtro-valore");
  const body = document.getElementById("location-list-body");
  const counter = document.getElementById("location-counter");
  const statusNode = document.getElementById("pagina11-status");

  let rows = [];
  let filtered = [];
  let selectedIndex = -1;

  const ynValues = ["SI", "NO", "N/A"];
  const tipoPistaValues = ["Legno", "PVC", "Cemento", "Altro"];
  const preseValues = ["Schuko", "CEE", "Misto"];
  const province = ["MI", "RM", "TO", "NA", "FI"];
  const paesiByProvincia = {
    MI: ["Milano", "Rho", "Sesto San Giovanni"],
    RM: ["Roma", "Tivoli", "Fiumicino"],
    TO: ["Torino", "Moncalieri", "Rivoli"],
    NA: ["Napoli", "Pozzuoli", "Afragola"],
    FI: ["Firenze", "Scandicci", "Prato"]
  };

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  const readStore = () => {
    const raw = localStorage.getItem(storeKey);
    if (raw) {
      return JSON.parse(raw);
    }

    return [
      {
        id: 2,
        nome: "Evento Demo 1",
        localita: "Milano",
        tipoStruttura: "Palazzetto",
        strutturaCoperta: "SI",
        provincia: "MI",
        paese: "Milano",
        indirizzo: "Via Roma",
        civico: "12",
        referente: "Mario Rossi",
        cellReferente: "3331234567",
        tipoPista: "Legno",
        tipoPrese: "Schuko",
        audio: "SI",
        luci: "SI",
        service: "SI",
        palcoDj: "SI",
        palcoBall: "SI",
        parcheggio: "SI",
        bar: "SI",
        toilette: "SI"
      },
      {
        id: 3,
        nome: "Evento Demo 2",
        localita: "Roma",
        tipoStruttura: "Teatro",
        strutturaCoperta: "SI",
        provincia: "RM",
        paese: "Roma",
        indirizzo: "Via Appia",
        civico: "90",
        referente: "Laura Bianchi",
        cellReferente: "3470000000",
        tipoPista: "PVC",
        tipoPrese: "CEE",
        audio: "NO",
        luci: "SI",
        service: "NO",
        palcoDj: "SI",
        palcoBall: "NO",
        parcheggio: "SI",
        bar: "NO",
        toilette: "SI"
      }
    ];
  };

  const persist = () => {
    localStorage.setItem(storeKey, JSON.stringify(rows));
  };

  const fillSelect = (node, values) => {
    if (!node) return;
    node.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "";
    node.appendChild(first);
    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      node.appendChild(o);
    });
  };

  const initCombos = () => {
    [
      fields.strutturaCoperta,
      fields.audio,
      fields.luci,
      fields.service,
      fields.palcoDj,
      fields.palcoBall,
      fields.parcheggio,
      fields.bar,
      fields.toilette
    ].forEach((node) => fillSelect(node, ynValues));

    fillSelect(fields.tipoPista, tipoPistaValues);
    fillSelect(fields.tipoPrese, preseValues);
    fillSelect(fields.provincia, province);
    fillSelect(fields.paese, []);

    fields.provincia?.addEventListener("change", () => {
      fillSelect(fields.paese, paesiByProvincia[fields.provincia.value] || []);
      setStatus("cmbProvincia_Change: aggiornata lista paesi.");
    });
  };

  const getRecordFromForm = () => ({
    id: fields.id.value ? Number(fields.id.value) : null,
    nome: fields.nome.value.trim(),
    localita: fields.localita.value.trim(),
    tipoStruttura: fields.tipoStruttura.value.trim(),
    strutturaCoperta: fields.strutturaCoperta.value,
    provincia: fields.provincia.value,
    paese: fields.paese.value,
    indirizzo: fields.indirizzo.value.trim(),
    civico: fields.civico.value.trim(),
    referente: fields.referente.value.trim(),
    cellReferente: fields.cellReferente.value.trim(),
    tipoPista: fields.tipoPista.value,
    tipoPrese: fields.tipoPrese.value,
    audio: fields.audio.value,
    luci: fields.luci.value,
    service: fields.service.value,
    palcoDj: fields.palcoDj.value,
    palcoBall: fields.palcoBall.value,
    parcheggio: fields.parcheggio.value,
    bar: fields.bar.value,
    toilette: fields.toilette.value
  });

  const fillForm = (rec) => {
    fields.id.value = rec.id || "";
    fields.nome.value = rec.nome || "";
    fields.localita.value = rec.localita || "";
    fields.tipoStruttura.value = rec.tipoStruttura || "";
    fields.strutturaCoperta.value = rec.strutturaCoperta || "";
    fields.provincia.value = rec.provincia || "";
    fillSelect(fields.paese, paesiByProvincia[fields.provincia.value] || []);
    fields.paese.value = rec.paese || "";
    fields.indirizzo.value = rec.indirizzo || "";
    fields.civico.value = rec.civico || "";
    fields.referente.value = rec.referente || "";
    fields.cellReferente.value = rec.cellReferente || "";
    fields.tipoPista.value = rec.tipoPista || "";
    fields.tipoPrese.value = rec.tipoPrese || "";
    fields.audio.value = rec.audio || "";
    fields.luci.value = rec.luci || "";
    fields.service.value = rec.service || "";
    fields.palcoDj.value = rec.palcoDj || "";
    fields.palcoBall.value = rec.palcoBall || "";
    fields.parcheggio.value = rec.parcheggio || "";
    fields.bar.value = rec.bar || "";
    fields.toilette.value = rec.toilette || "";
  };

  const clearForm = () => {
    fillForm({});
  };

  const verifyFields = () => {
    if (!fields.nome.value.trim()) {
      setStatus("Inserire Nome Evento.");
      return false;
    }
    if (!fields.localita.value.trim()) {
      setStatus("Inserire Localita.");
      return false;
    }
    if (!fields.referente.value.trim()) {
      setStatus("Inserire Referente.");
      return false;
    }
    return true;
  };

  const availableFilterFields = () => [
    "nome", "localita", "provincia", "paese", "referente", "tipoPista"
  ];

  const refreshFilterValues = () => {
    const field = filtroCampo?.value;
    if (!field || !filtroValore) return;
    const unique = [...new Set(rows.map((r) => (r[field] || "").toString()).filter(Boolean))].sort();
    filtroValore.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "(tutti)";
    filtroValore.appendChild(all);
    unique.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      filtroValore.appendChild(o);
    });
  };

  const applyFilter = () => {
    const field = filtroCampo?.value;
    const value = (filtroValore?.value || "").toUpperCase();

    filtered = rows.filter((r) => {
      if (!field || !value) return true;
      return (r[field] || "").toString().toUpperCase().includes(value);
    });

    renderTable();
  };

  const renderTable = () => {
    if (!body) return;
    body.innerHTML = "";
    filtered.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.nome || ""}</td><td>${r.localita || ""}</td><td>${(r[filtroCampo?.value || "nome"] || "")}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("dblclick", () => {
        selectedIndex = idx;
        fillForm(r);
        updateCounter();
        setStatus(`lstLocation_DblClick: record ${r.id} caricato.`);
      });
      tr.addEventListener("click", () => {
        selectedIndex = idx;
        updateCounter();
      });
      body.appendChild(tr);
    });

    if (filtered.length) {
      if (selectedIndex < 0 || selectedIndex >= filtered.length) selectedIndex = 0;
      fillForm(filtered[selectedIndex]);
    } else {
      selectedIndex = -1;
      clearForm();
    }

    updateCounter();
  };

  const updateCounter = () => {
    if (!counter) return;
    if (!filtered.length || selectedIndex < 0) {
      counter.textContent = `0 / ${filtered.length}`;
      return;
    }
    counter.textContent = `${selectedIndex + 1} / ${filtered.length}`;
  };

  document.getElementById("btn-save-record")?.addEventListener("click", () => {
    if (!verifyFields()) return;
    const record = getRecordFromForm();
    const nextId = rows.length ? Math.max(...rows.map((r) => Number(r.id) || 0)) + 1 : 2;
    record.id = nextId;
    rows.push(record);
    persist();
    refreshFilterValues();
    applyFilter();
    setStatus("cmdSalva: location salvata.");
    clearForm();
  });

  document.getElementById("btn-edit-record")?.addEventListener("click", () => {
    const id = Number(fields.id.value || 0);
    if (!id) {
      setStatus("Seleziona una Location da modificare.");
      return;
    }
    const idx = rows.findIndex((r) => Number(r.id) === id);
    if (idx < 0) return;
    rows[idx] = getRecordFromForm();
    rows[idx].id = id;
    persist();
    refreshFilterValues();
    applyFilter();
    setStatus("cmdModifica: record aggiornato.");
  });

  document.getElementById("btn-delete-record")?.addEventListener("click", () => {
    const id = Number(fields.id.value || 0);
    if (!id) return;
    rows = rows.filter((r) => Number(r.id) !== id);
    persist();
    refreshFilterValues();
    applyFilter();
    clearForm();
    setStatus("cmdElimina: record eliminato.");
  });

  document.getElementById("btn-new-record")?.addEventListener("click", () => {
    clearForm();
    setStatus("cmdNuovo: form pulito.");
  });

  document.getElementById("btn-close-location")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  document.getElementById("btn-hide-location")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });

  document.getElementById("btn-prev-record")?.addEventListener("click", () => {
    if (!filtered.length) return;
    selectedIndex = selectedIndex <= 0 ? filtered.length - 1 : selectedIndex - 1;
    fillForm(filtered[selectedIndex]);
    updateCounter();
    setStatus("cmdPrecedente: navigazione record aggiornata.");
  });

  document.getElementById("btn-next-record")?.addEventListener("click", () => {
    if (!filtered.length) return;
    selectedIndex = selectedIndex >= filtered.length - 1 ? 0 : selectedIndex + 1;
    fillForm(filtered[selectedIndex]);
    updateCounter();
    setStatus("cmdSuccessivo: navigazione record aggiornata.");
  });

  filtroCampo?.addEventListener("change", () => {
    refreshFilterValues();
    applyFilter();
    setStatus("cmbFiltroCampo_Change: filtro campo aggiornato.");
  });

  filtroValore?.addEventListener("change", () => {
    applyFilter();
    setStatus("cmbValoreFiltro_Change: filtro valore applicato.");
  });

  rows = readStore();
  initCombos();

  const fieldsList = availableFilterFields();
  if (filtroCampo) {
    filtroCampo.innerHTML = "";
    fieldsList.forEach((f) => {
      const o = document.createElement("option");
      o.value = f;
      o.textContent = f;
      filtroCampo.appendChild(o);
    });
    filtroCampo.value = fieldsList[0];
  }

  refreshFilterValues();
  applyFilter();
})();

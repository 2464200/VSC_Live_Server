(function () {
  'use strict';

  const MAX_STATE_AGE_MS = 48 * 60 * 60 * 1000;

  class RichiesteVelociPage {
    constructor() {
      this.catalog = [];
      this.cloudState = null;
      this.selectedBrano = null;
      this.suggestions = [];
      this.activeSuggestion = -1;
      this.isSaving = false;
      this.isLoadingCatalog = true;
      this.init();
    }

    async init() {
      this.bindEvents();
      this.renderAvailability();
      try {
        await dataLoader.initialize(false);
        this.catalog = await dataLoader.loadBrani({ silent: true });
        this.isLoadingCatalog = false;
        this.updateSearchStatus();

        const cloud = window.firebaseCloudClient;
        if (!cloud) throw new Error('Sincronizzazione Borderò non disponibile.');
        await cloud.authReady;
        this.cloudState = cloud.latestCloudState;
        await cloud.fetchRequestStateDirect();
        this.cloudState = cloud.latestCloudState;
        this.render();
        document.getElementById('quick-song-search').focus();
      } catch (error) {
        this.isLoadingCatalog = false;
        this.updateSearchStatus(`Catalogo o stato Borderò non disponibile: ${error.message}`, true);
        this.renderAvailability();
      }
    }

    bindEvents() {
      const input = document.getElementById('quick-song-search');
      input.addEventListener('input', () => this.updateSuggestions());
      input.addEventListener('keydown', (event) => this.handleSearchKeydown(event));
      input.addEventListener('focus', () => {
        if (input.value.trim()) this.updateSuggestions();
      });
      document.getElementById('quick-song-suggestions').addEventListener('click', (event) => {
        const option = event.target.closest('[data-suggestion-index]');
        if (option) this.selectSuggestion(Number(option.dataset.suggestionIndex));
      });
      document.getElementById('quick-request-form').addEventListener('submit', (event) => this.bookRequest(event));
      document.getElementById('firebase-cloud-auth').addEventListener('click', async () => {
        await window.firebaseCloudClient?.togglePublisherAuth();
        this.renderAvailability();
      });
      window.addEventListener('bordero:publisher-auth-updated', () => this.renderAvailability());
      window.addEventListener('bordero:request-state-updated', (event) => this.onCloudStateUpdated(event.detail));
      window.addEventListener('bordero:cloud-updated', (event) => this.onCloudStateUpdated(event.detail));
      window.addEventListener('storage', (event) => {
        if (event.key === BORDERO_CONFIG.CACHE_KEY_BRANI || event.key === 'BORDERO_BRANI_DATA') {
          this.catalog = Storage.get('BORDERO_BRANI_DATA', Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []));
          this.updateSuggestions();
        }
      });
    }

    onCloudStateUpdated(state) {
      this.cloudState = state || null;
      this.render();
    }

    updateSearchStatus(message = '', isError = false) {
      const help = document.getElementById('quick-search-help');
      if (message) {
        help.textContent = message;
        help.classList.toggle('is-error', isError);
        return;
      }
      help.textContent = this.isLoadingCatalog
        ? 'Caricamento del catalogo Borderò…'
        : `${this.catalog.length} coreografie nel catalogo. I titoli uguali sono distinti dall’ID.`;
      help.classList.remove('is-error');
    }

    normalizeText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('it');
    }

    getTitle(brano) {
      return String(brano?.titolo || brano?.coreografia || '').trim();
    }

    updateSuggestions() {
      const input = document.getElementById('quick-song-search');
      const query = this.normalizeText(input.value);
      this.selectedBrano = null;
      this.activeSuggestion = -1;
      document.getElementById('quick-selected-song').hidden = true;
      document.getElementById('quick-action-message').textContent = '';
      document.getElementById('quick-action-message').classList.remove('is-error');
      this.suggestions = query.length < 1
        ? []
        : this.catalog
          .filter((brano) => String(brano.id ?? '').trim() && this.getTitle(brano) && this.normalizeText(this.getTitle(brano)).includes(query))
          .slice(0, 20);
      this.renderSuggestions();
      this.renderAvailability();
    }

    renderSuggestions() {
      const list = document.getElementById('quick-song-suggestions');
      list.replaceChildren();
      this.suggestions.forEach((brano, index) => {
        const option = document.createElement('div');
        option.id = `quick-suggestion-${index}`;
        option.className = 'quick-suggestion';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === this.activeSuggestion));
        option.dataset.suggestionIndex = String(index);

        const main = document.createElement('span');
        main.className = 'quick-suggestion-main';
        const heading = document.createElement('span');
        heading.className = 'quick-suggestion-heading';
        const title = document.createElement('span');
        title.className = 'quick-suggestion-title';
        title.textContent = this.getTitle(brano);
        const id = document.createElement('span');
        id.className = 'quick-suggestion-id';
        id.textContent = `ID ${brano.id}`;
        heading.append(title, id);

        const details = document.createElement('span');
        details.className = 'quick-suggestion-details';
        [
          ['Autore', brano.autore || brano.author],
          ['Brano', brano.brano || brano.song || brano.canzone],
          ['Livello', brano.info_livello || brano['info livello']]
        ].forEach(([label, value]) => {
          const detail = document.createElement('span');
          detail.className = 'quick-suggestion-detail';
          const detailLabel = document.createElement('span');
          detailLabel.className = 'quick-suggestion-detail-label';
          detailLabel.textContent = label;
          const detailValue = document.createElement('span');
          detailValue.className = 'quick-suggestion-detail-value';
          detailValue.textContent = String(value || '—').trim();
          detail.append(detailLabel, detailValue);
          details.append(detail);
        });

        main.append(heading, details);
        option.append(main);
        list.append(option);
      });
      list.hidden = this.suggestions.length === 0;
      const input = document.getElementById('quick-song-search');
      input.setAttribute('aria-expanded', String(!list.hidden));
      if (this.activeSuggestion >= 0) {
        input.setAttribute('aria-activedescendant', `quick-suggestion-${this.activeSuggestion}`);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    handleSearchKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (this.suggestions.length) {
          this.selectSuggestion(this.activeSuggestion >= 0 ? this.activeSuggestion : 0);
        }
        return;
      }
      if (!this.suggestions.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const current = this.activeSuggestion < 0
          ? (delta > 0 ? -1 : 0)
          : this.activeSuggestion;
        this.activeSuggestion = (current + delta + this.suggestions.length) % this.suggestions.length;
        this.renderSuggestions();
      } else if (event.key === 'Escape') {
        this.suggestions = [];
        this.renderSuggestions();
      }
    }

    selectSuggestion(index) {
      const brano = this.suggestions[index];
      if (!brano) return;
      this.selectedBrano = brano;
      document.getElementById('quick-song-search').value = this.getTitle(brano);
      const selected = document.getElementById('quick-selected-song');
      selected.textContent = `${this.getTitle(brano)} · ID ${brano.id}`;
      selected.hidden = false;
      this.suggestions = [];
      this.renderSuggestions();
      this.renderAvailability();
    }

    getCurrentState() {
      const state = this.cloudState || window.firebaseCloudClient?.latestCloudState;
      if (!state || typeof state !== 'object') return { ok: false, reason: 'Stato condiviso non disponibile.' };
      const updatedAt = Date.parse(state.updatedAt || '');
      const age = Date.now() - updatedAt;
      if (!Number.isFinite(updatedAt) || age < -5 * 60 * 1000 || age > MAX_STATE_AGE_MS) {
        return { ok: false, reason: 'Stato Borderò non aggiornato: riapri o sincronizza il Borderò.' };
      }
      const cloud = window.firebaseCloudClient;
      const serataKey = cloud?.getSerataKey(state.serata);
      if (!serataKey) return { ok: false, reason: 'Seleziona DJ e data serata nel Borderò.' };
      if (!Array.isArray(state.brani)) return { ok: false, reason: 'Dati della serata non disponibili.' };
      return { ok: true, state, serataKey };
    }

    getAvailability() {
      if (!this.selectedBrano) return { state: 'checking', label: 'Seleziona una coreografia', detail: '' };
      const current = this.getCurrentState();
      if (!current.ok) return { state: 'unavailable', label: 'Verifica non disponibile', detail: current.reason };

      const brano = current.state.brani.find((item) => String(item?.id ?? '').trim() === String(this.selectedBrano.id ?? '').trim());
      if (!brano) return { state: 'unavailable', label: 'Verifica non disponibile', detail: 'L’ID selezionato non è presente nello stato Borderò della serata.' };
      if (window.firebaseCloudClient.isBranoExecuted(brano)) {
        return { state: 'executed', label: 'Già eseguita', detail: 'Lo stato eseguito è gestito dal Borderò.' };
      }

      const requestKey = window.firebaseCloudClient.getBranoRequestKey(brano.id);
      const quickRequest = current.state.quickRequestsBySerata?.[current.serataKey]?.[requestKey];
      const catalogBrano = this.catalog.find((item) => String(item?.id ?? '').trim() === String(brano.id ?? '').trim());
      const cloudCatalogBrano = (Array.isArray(current.state.catalogBrani) ? current.state.catalogBrani : [])
        .find((item) => String(item?.id ?? '').trim() === String(brano.id ?? '').trim());
      const onlineRequest = window.firebaseCloudClient.isRichiestaOnline(catalogBrano)
        || window.firebaseCloudClient.isRichiestaOnline(cloudCatalogBrano)
        || window.firebaseCloudClient.isRichiestaOnline(brano);
      if (quickRequest || onlineRequest) {
        return { state: 'reserved', label: 'Già prenotata', detail: quickRequest && onlineRequest
          ? 'Presente sia tra le richieste vocali sia tra quelle online.'
          : quickRequest ? 'Richiesta vocale già registrata.' : 'Richiesta già presente nei Moduli 8+12.' };
      }
      return { state: 'free', label: 'Libera', detail: 'Verifica completata sullo stato condiviso della serata.' };
    }

    canBook() {
      const cloud = window.firebaseCloudClient;
      const user = cloud?.publisherAuth?.currentUser;
      return Boolean(
        this.selectedBrano
        && !this.isSaving
        && this.getAvailability().state === 'free'
        && user
        && cloud.isAuthorizedPublisher(user)
      );
    }

    renderAvailability() {
      const availability = this.getAvailability();
      const box = document.getElementById('quick-availability');
      box.dataset.state = availability.state;
      document.getElementById('quick-availability-text').textContent = availability.label;
      document.getElementById('quick-availability-detail').textContent = availability.detail;
      document.getElementById('btn-book-quick-request').disabled = !this.canBook();

      const info = document.getElementById('quick-serata-info');
      const current = this.getCurrentState();
      if (!current.ok) {
        info.textContent = current.reason;
        return;
      }
      const metadata = current.state.serata || {};
      info.textContent = `Serata: ${metadata.dj} · ${metadata.data}${metadata.luogo ? ` · ${metadata.luogo}` : ''}`;
    }

    getQuickRequests() {
      const current = this.getCurrentState();
      if (!current.ok) return [];
      const entries = current.state.quickRequestsBySerata?.[current.serataKey] || {};
      return Object.values(entries).filter((entry) => entry && typeof entry === 'object');
    }

    formatTimestamp(value) {
      const timestamp = Date.parse(value || '');
      return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('it-IT') : (String(value || '').trim() || '--');
    }

    escapeHtml(value) {
      const element = document.createElement('span');
      element.textContent = String(value ?? '');
      return element.innerHTML;
    }

    renderBoard() {
      const tbody = document.getElementById('quick-requests-body');
      const empty = document.getElementById('quick-board-empty');
      const current = this.getCurrentState();
      const requests = this.getQuickRequests().sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
      const catalogById = new Map(this.catalog.map((brano) => [String(brano.id ?? '').trim(), brano]));
      const stateBrani = new Map((current.ok ? current.state.brani : []).map((brano) => [String(brano.id ?? '').trim(), brano]));

      tbody.innerHTML = requests.map((request) => {
        const catalogBrano = catalogById.get(String(request.id)) || {};
        const cloudCatalogBrano = (Array.isArray(current.state?.catalogBrani) ? current.state.catalogBrani : [])
          .find((item) => String(item?.id ?? '').trim() === String(request.id));
        const brano = stateBrani.get(String(request.id)) || catalogBrano;
        const isExecuted = window.firebaseCloudClient?.isBranoExecuted(brano) || false;
        const isOnline = Boolean(
          window.firebaseCloudClient?.isRichiestaOnline(brano)
          || window.firebaseCloudClient?.isRichiestaOnline(catalogBrano)
          || window.firebaseCloudClient?.isRichiestaOnline(cloudCatalogBrano)
        );
        const status = isExecuted ? 'Già eseguita' : 'Da eseguire';
        const statusClass = isExecuted ? 'is-executed' : 'is-pending';
        const flag = isExecuted ? 'X' : '—';
        const next = brano.next_selected ? '✓' : (brano.next_coreo || brano.nextCoreo || brano['next coreo'] || '—');
        const timestamp = brano.timestamp || request.createdAt;
        const onlineCount = window.firebaseCloudClient?.isRichiestaOnline(catalogBrano)
          ? catalogBrano.richieste
          : window.firebaseCloudClient?.isRichiestaOnline(cloudCatalogBrano)
            ? cloudCatalogBrano.richieste
            : brano.richieste;
        const requestSources = `<span class="quick-source-label">VOCALE</span>${isOnline ? `<span class="quick-source-label is-online">ONLINE × ${this.escapeHtml(onlineCount)}</span>` : ''}`;
        return `<tr data-brano-id="${this.escapeHtml(request.id)}">
          <td><span class="quick-readonly-indicator" aria-label="${isExecuted ? 'Eseguita' : 'Non eseguita'}">${flag}</span></td>
          <td>${this.escapeHtml(next)}</td>
          <td>${this.escapeHtml(request.id)}</td>
          <td>${this.escapeHtml(this.formatTimestamp(timestamp))}</td>
          <td>${this.escapeHtml(brano.titolo || brano.coreografia || request.title)}</td>
          <td>${this.escapeHtml(brano.autore || '—')}</td>
          <td>${this.escapeHtml(brano.brano || brano.song || brano.canzone || '—')}</td>
          <td>${requestSources}</td>
          <td>${this.escapeHtml(brano.info_livello || '—')}</td>
          <td><span class="quick-board-state ${statusClass}">${status}</span></td>
        </tr>`;
      }).join('');
      empty.hidden = requests.length > 0;
      document.getElementById('quick-request-count').textContent = String(requests.length);
    }

    render() {
      this.renderAvailability();
      this.renderBoard();
    }

    async bookRequest(event) {
      event.preventDefault();
      if (!this.canBook()) return;

      const current = this.getCurrentState();
      if (!current.ok) {
        this.showActionMessage(current.reason, true);
        this.renderAvailability();
        return;
      }

      this.isSaving = true;
      this.renderAvailability();
      this.showActionMessage('Verifica e prenotazione in corso…');
      try {
        const result = await window.firebaseCloudClient.reserveQuickRequest({
          branoId: this.selectedBrano.id,
          title: this.getTitle(this.selectedBrano),
          serataKey: current.serataKey
        }, (attempt, maxAttempts) => {
          this.showActionMessage(`Server occupato: richiesta in coda (${attempt}/${maxAttempts})…`);
        });
        this.cloudState = window.firebaseCloudClient.latestCloudState;
        if (!result.ok) {
          this.render();
          const messages = {
            'gia-prenotata': 'La coreografia è stata prenotata nel frattempo.',
            'gia-eseguita': 'La coreografia è stata eseguita nel frattempo.',
            'serata-modificata': 'La serata è cambiata. Verifica nuovamente la richiesta.',
            'brano-non-disponibile': 'La coreografia non è più presente nello stato Borderò.',
            'stato-non-disponibile': 'Non riesco a leggere lo stato condiviso dopo i tentativi. Verifica la connessione e riprova.',
            'stato-non-aggiornato': 'Lo stato Borderò non è aggiornato. Sincronizza il Borderò e riprova.'
          };
          this.showActionMessage(messages[result.reason] || 'La prenotazione non è riuscita: lo stato è cambiato. Verifica e riprova.', true);
          return;
        }

        this.render();
        this.showActionMessage('Richiesta prenotata e sincronizzata con il Borderò.');
        this.selectedBrano = null;
        this.suggestions = [];
        document.getElementById('quick-song-search').value = '';
        document.getElementById('quick-selected-song').hidden = true;
        this.renderSuggestions();
        this.renderAvailability();
        document.getElementById('quick-song-search').focus();
      } catch (error) {
        logger.error('Errore prenotazione richiesta veloce', error);
        this.showActionMessage(`Salvataggio non riuscito: ${error.message}. Puoi riprovare.`, true);
        this.cloudState = window.firebaseCloudClient?.latestCloudState || this.cloudState;
        this.render();
      } finally {
        this.isSaving = false;
        this.renderAvailability();
      }
    }

    showActionMessage(message, isError = false) {
      const element = document.getElementById('quick-action-message');
      element.textContent = message;
      element.classList.toggle('is-error', isError);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.richiesteVelociPage = new RichiesteVelociPage();
  });
})();

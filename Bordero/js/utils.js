/**
 * BORDERO - Utility Functions
 * Funzioni helper generiche per il progetto
 */

/**
 * LocalStorage Utilities
 */
const Storage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      logger.debug(`Storage.set: ${key}`, value);
    } catch (e) {
      logger.error(`Storage.set error: ${key}`, e);
    }
  },

  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      logger.error(`Storage.get error: ${key}`, e);
      return defaultValue;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      logger.debug(`Storage.remove: ${key}`);
    } catch (e) {
      logger.error(`Storage.remove error: ${key}`, e);
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      logger.info('Storage.clear: tutti i dati cancellati');
    } catch (e) {
      logger.error('Storage.clear error', e);
    }
  },

  getAllBorderoKeys: () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('bordero_')) {
        keys.push(key);
      }
    }
    return keys;
  },
};

/**
 * CSV Parser
 */
const CSVParser = {
  /**
   * Parse CSV string to array of objects
   * @param {string} csv - CSV content
   * @param {number} skipLines - Lines to skip from beginning (default 0)
   * @returns {Array} Array of objects
   */
  parse: (csv, skipLines = 0) => {
    const lines = csv.split('\n').slice(skipLines);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = CSVParser.parseCSVLine(line);
      if (values.length !== headers.length) continue;

      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim() || '';
      });

      data.push(obj);
    }

    return data;
  },

  /**
   * Parse single CSV line handling quoted values
   */
  parseCSVLine: (line) => {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  },
};

/**
 * Utility oggetti/array
 */
const ObjectUtils = {
  /**
   * Deep clone oggetto
   */
  clone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Merge oggetti
   */
  merge: (...objects) => {
    return Object.assign({}, ...objects);
  },

  /**
   * Filtra array per campo e valore
   */
  filterByField: (array, field, value) => {
    return array.filter(item => 
      String(item[field]).toLowerCase().includes(String(value).toLowerCase())
    );
  },

  /**
   * Sort array per campo
   */
  sortByField: (array, field, ascending = true) => {
    return [...array].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum) && aVal !== '' && bVal !== '';

      if (bothNumeric) {
        return ascending ? aNum - bNum : bNum - aNum;
      }

      const aStr = aVal != null ? String(aVal) : '';
      const bStr = bVal != null ? String(bVal) : '';
      return ascending
        ? aStr.localeCompare(bStr, 'it', { numeric: true, sensitivity: 'base' })
        : bStr.localeCompare(aStr, 'it', { numeric: true, sensitivity: 'base' });
    });
  },

  /**
   * Cerca valore in array di oggetti (multiple fields)
   */
  searchMultiField: (array, searchTerm, fields) => {
    const term = searchTerm.toLowerCase();
    return array.filter(item =>
      fields.some(field =>
        String(item[field]).toLowerCase().includes(term)
      )
    );
  },
};

/**
 * DOM Utilities
 */
const DOMUtils = {
  /**
   * Crea elemento con classe e contenuto
   */
  createElement: (tag, className = '', content = '') => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content) el.innerHTML = content;
    return el;
  },

  /**
   * Mostra/Nascondi elemento
   */
  show: (element) => {
    if (element) element.style.display = '';
  },

  hide: (element) => {
    if (element) element.style.display = 'none';
  },

  toggle: (element) => {
    if (element) {
      element.style.display = element.style.display === 'none' ? '' : 'none';
    }
  },

  /**
   * Add/Remove classe
   */
  addClass: (element, className) => {
    element?.classList.add(className);
  },

  removeClass: (element, className) => {
    element?.classList.remove(className);
  },

  toggleClass: (element, className) => {
    element?.classList.toggle(className);
  },

  /**
   * Event delegation
   */
  on: (parent, eventType, selector, handler) => {
    parent?.addEventListener(eventType, (e) => {
      if (e.target.matches(selector)) {
        handler.call(e.target, e);
      }
    });
  },
};

/**
 * Date Utilities
 */
const DateUtils = {
  /**
   * Format date as Italian locale
   */
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Format time only
   */
  formatTime: (date) => {
    return new Date(date).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  },

  /**
   * Get timestamp in ISO format
   */
  now: () => new Date().toISOString(),
};

/**
 * Toast Notifications
 */
const Toast = {
  show: (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = DOMUtils.createElement(
      'div',
      `toast toast-${type}`,
      `<span>${message}</span>`
    );

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: (msg, duration) => Toast.show(msg, 'success', duration),
  error: (msg, duration) => Toast.show(msg, 'error', duration),
  warning: (msg, duration) => Toast.show(msg, 'warning', duration),
  info: (msg, duration) => Toast.show(msg, 'info', duration),
};

/**
 * Network Utilities
 */
const Network = {
  /**
   * Carica CSV dal percorso
   */
  fetchCSV: async (url) => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      logger.error(`Network.fetchCSV: ${url}`, e);
      throw e;
    }
  },

  /**
   * Fetch JSON
   */
  fetchJSON: async (url) => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      logger.error(`Network.fetchJSON: ${url}`, e);
      throw e;
    }
  },

  /**
   * Check online status
   */
  isOnline: () => navigator.onLine,
};

logger.info('✓ Utils.js caricato');

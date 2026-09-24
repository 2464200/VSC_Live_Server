const BorderoSettingsStore = (() => {
  const storageKey = 'BORDERO_SETTINGS';
  const version = 1;
  const defaults = {
    tableView: {
      filters: {},
      search: '',
      searchMode: 'general',
      sort: null,
      sortDirection: 'asc',
      page: 1,
    },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const merge = (base, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return clone(base);
    const result = { ...base };
    Object.entries(value).forEach(([key, entry]) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        result[key] = merge(base[key], entry);
      } else if (entry !== undefined) {
        result[key] = entry;
      }
    });
    return result;
  };

  const read = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return clone(defaults);
      const parsed = JSON.parse(raw);
      return merge(defaults, parsed?.version === version ? parsed.data : parsed);
    } catch (error) {
      console.warn('Impostazioni Borderò non valide, uso i default', error?.message || error);
      return clone(defaults);
    }
  };

  const write = (settings) => {
    const payload = { version, updatedAt: new Date().toISOString(), data: merge(defaults, settings) };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      return payload.data;
    } catch (error) {
      console.warn('Impossibile salvare le impostazioni Borderò', error?.message || error);
      return payload.data;
    }
  };

  return {
    read,
    write,
    get(section, fallback = null) {
      const value = read()[section];
      return value === undefined ? fallback : value;
    },
    set(section, value) {
      const settings = read();
      settings[section] = value;
      return write(settings);
    },
    reset(section = null) {
      const settings = read();
      if (section) {
        settings[section] = clone(defaults[section] || {});
      } else {
        return write(defaults);
      }
      return write(settings);
    },
  };
})();

(() => {
  const settingsKey = 'bordero-led-display-settings';
  const excludedColors = new Set(['#000000', '#050403', '#120000', '#260b06']);
  const palette = ['#ff0000', '#ffffff', '#008000', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#808080']
    .filter(color => !excludedColors.has(color));
  const colorTransitionDurationMs = 900;
  const fillStyleDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');

  function hexToRgb(hex) {
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  }

  function rgbToHex(rgb) {
    return `#${rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
  }

  function getRainbowColor(now) {
    const position = now / colorTransitionDurationMs;
    const currentIndex = Math.floor(position) % palette.length;
    const progress = position - Math.floor(position);
    const current = hexToRgb(palette[currentIndex]);
    const next = hexToRgb(palette[(currentIndex + 1) % palette.length]);
    return rgbToHex(current.map((channel, index) => channel + (next[index] - channel) * progress));
  }

  if (!fillStyleDescriptor?.set || !fillStyleDescriptor?.get) return;

  Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillStyle', {
    configurable: fillStyleDescriptor.configurable,
    enumerable: fillStyleDescriptor.enumerable,
    get() {
      return fillStyleDescriptor.get.call(this);
    },
    set(value) {
      let nextValue = value;
      if (typeof value === 'string') {
        try {
          const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
          if (settings.rainbow && palette.includes(value.toLowerCase())) {
            nextValue = getRainbowColor(performance.now());
          }
        } catch (_) {
          // Keep the renderer usable if localStorage is unavailable.
        }
      }
      fillStyleDescriptor.set.call(this, nextValue);
    }
  });
})();

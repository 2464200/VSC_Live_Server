function pickDisplayTargets(displays) {
  if (!Array.isArray(displays) || displays.length === 0) {
    return {
      primary: null,
      secondary: null
    };
  }

  const primary = displays.find((display) => display.isPrimary) || displays[0];
  const secondary = displays.find((display) => display.id !== primary.id) || primary;

  return { primary, secondary };
}

function resolveDisplayTargetsForWindows(displays, options = {}) {
  const { swapPrimarySecondary = false } = options;
  const targets = pickDisplayTargets(displays);

  if (!targets.primary || !targets.secondary) {
    return {
      mainDisplay: targets.primary,
      monitorDisplay: targets.secondary,
      primaryDisplay: targets.primary,
      secondaryDisplay: targets.secondary
    };
  }

  return {
    mainDisplay: swapPrimarySecondary ? targets.secondary : targets.primary,
    monitorDisplay: swapPrimarySecondary ? targets.primary : targets.secondary,
    primaryDisplay: targets.primary,
    secondaryDisplay: targets.secondary
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDisplayScaleFactor(display) {
  if (!display || typeof display.scaleFactor !== 'number' || Number.isNaN(display.scaleFactor)) {
    return 1;
  }

  return clamp(display.scaleFactor, 0.75, 2.5);
}

function getDisplayDpiScale(display) {
  const scaleFactor = getDisplayScaleFactor(display);
  return scaleFactor > 1 ? scaleFactor : 1;
}

function getWindowBoundsForDisplay(display, options = {}) {
  const { width = 1280, height = 720 } = options;

  if (!display || !display.bounds) {
    return {
      x: 0,
      y: 0,
      width,
      height
    };
  }

  return {
    x: display.bounds.x + Math.max(0, Math.floor((display.bounds.width - width) / 2)),
    y: display.bounds.y + Math.max(0, Math.floor((display.bounds.height - height) / 2)),
    width,
    height
  };
}

function buildDisplayLayoutConfig(display, options = {}) {
  const { width = 1280, height = 720, fullscreen = false } = options;
  const safeDisplay = display || {};
  const bounds = safeDisplay.bounds || { x: 0, y: 0, width, height };
  const scaleFactor = getDisplayScaleFactor(safeDisplay);
  const zoomFactor = fullscreen ? clamp(1 / scaleFactor, 0.7, 1.25) : 1;

  const logicalWidth = fullscreen
    ? bounds.width
    : Math.max(800, Math.min(bounds.width, Math.max(width, Math.floor(bounds.width * 0.95))));
  const logicalHeight = fullscreen
    ? bounds.height
    : Math.max(600, Math.min(bounds.height, Math.max(height, Math.floor(bounds.height * 0.95))));

  return {
    display,
    bounds,
    scaleFactor,
    zoomFactor,
    width: logicalWidth,
    height: logicalHeight,
    x: bounds.x + Math.max(0, Math.floor((bounds.width - logicalWidth) / 2)),
    y: bounds.y + Math.max(0, Math.floor((bounds.height - logicalHeight) / 2))
  };
}

function buildElectronAppConfig({ baseUrl, pageUrl = '/Bordero/pages/bordero.html', displayUrl = '/Bordero/pages/display.html' } = {}) {
  const normalizedBaseUrl = baseUrl || 'http://localhost:5500';

  return {
    primaryUrl: `${normalizedBaseUrl}${pageUrl}`,
    secondaryUrl: `${normalizedBaseUrl}${displayUrl}`,
    windowOptions: {
      width: 1400,
      height: 900,
      show: false,
      title: 'Borderò - Dual Monitor'
    }
  };
}

module.exports = {
  pickDisplayTargets,
  resolveDisplayTargetsForWindows,
  getWindowBoundsForDisplay,
  buildDisplayLayoutConfig,
  getDisplayScaleFactor,
  getDisplayDpiScale,
  buildElectronAppConfig
};

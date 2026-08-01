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
  buildElectronAppConfig
};

// Color theme. Dark is the default; the choice is remembered on this device only
// (localStorage 'runsesh.theme', a non-sensitive UI preference).

const STORAGE_KEY = 'runsesh.theme';
export const THEMES = Object.freeze({ DARK: 'dark', LIGHT: 'light' });
const DEFAULT_THEME = THEMES.DARK;
const BROWSER_BAR_COLOR = Object.freeze({ dark: '#17171c', light: '#ff8a1f' });

function isTheme(value) {
  return value === THEMES.DARK || value === THEMES.LIGHT;
}

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Applies a theme to the page. Invalid values fall back to the default. */
export function applyTheme(theme = getTheme()) {
  const value = isTheme(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = value;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BROWSER_BAR_COLOR[value]);
  return value;
}

export function setTheme(theme) {
  const value = applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
  return value;
}

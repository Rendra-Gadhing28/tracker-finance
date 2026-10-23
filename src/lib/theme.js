/**
 * Sets the active theme ('light', 'dark', or 'system')
 * @param {'light' | 'dark' | 'system'} t
 */
export function setTheme(t) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (t === 'system') {
    delete root.dataset.theme;
    localStorage.removeItem('theme');
  } else {
    root.dataset.theme = t;
    localStorage.setItem('theme', t);
  }
}

/**
 * Gets currently saved theme preference
 * @returns {'light' | 'dark' | 'system'}
 */
export function getTheme() {
  if (typeof localStorage === 'undefined') return 'system';
  const t = localStorage.getItem('theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

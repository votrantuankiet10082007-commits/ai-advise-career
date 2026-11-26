(() => {
  const key = 'career.account.display';
  const validThemes = ['light', 'dark', 'system'];

  function syncTheme() {
    let theme = 'light';
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (validThemes.includes(saved?.theme)) theme = saved.theme;
    } catch {
      // Keep the page's default theme when storage is unavailable.
      if (document.documentElement.dataset.theme) return;
    }
    document.documentElement.dataset.theme = theme;
    const picker = document.getElementById('theme');
    if (picker) picker.value = theme;
  }

  syncTheme();
  window.addEventListener('pageshow', event => {
    if (event.persisted) syncTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) syncTheme();
  });
})();

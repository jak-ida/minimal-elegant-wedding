/* Runs before the page paints (kept tiny on purpose).
   1. Adds the "js" class so reveal animations only start hidden when JavaScript works.
   2. Remembers a dismissed announcement banner for this browser session.
   3. Safety net: if main.js has not started within 4 seconds, remove the "js" class
      so nothing stays hidden. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  try {
    if (window.sessionStorage.getItem('wedding-banner-dismissed') === '1') {
      root.classList.add('banner-dismissed');
    }
  } catch (error) { /* storage can be blocked; ignore */ }

  window.setTimeout(function () {
    if (!root.classList.contains('js-ready')) {
      root.classList.remove('js');
    }
  }, 4000);
})();

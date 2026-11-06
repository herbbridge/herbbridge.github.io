/* Restore before first paint. This preference never reads or changes a medicine list. */
(function () {
  'use strict';
  var key = 'herbsafe.textsize';
  var large = false;
  try { large = localStorage.getItem(key) === 'large'; } catch (error) { /* works for this visit */ }
  function apply() {
    document.documentElement.setAttribute('data-textsize', large ? 'large' : 'normal');
    var button = document.getElementById('textsize-toggle');
    if (button) button.setAttribute('aria-pressed', String(large));
  }
  apply();
  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('textsize-toggle');
    if (!button) return;
    apply();
    button.addEventListener('click', function () {
      large = !large;
      try { localStorage.setItem(key, large ? 'large' : 'normal'); } catch (error) { /* works for this visit */ }
      apply();
    });
  });
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) {
      large = event.newValue === 'large';
      apply();
    }
  });
})();

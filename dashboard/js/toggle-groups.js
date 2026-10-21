/*
 * Groups of buttons where one is "selected" (time range, alert filter).
 * HTMX loads the new content; this file only moves the selected look
 * (aria-pressed) to the button that was clicked.
 *
 *   <div data-toggle-group>
 *     <button aria-pressed="true">...</button>
 *     <button aria-pressed="false">...</button>
 *   </div>
 */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var button = e.target.closest('[data-toggle-group] button');
    if (!button) { return; }
    var group = button.closest('[data-toggle-group]');
    group.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
    });
  });
})();

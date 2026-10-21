/*
 * Small helpers around HTMX. HTMX itself loads the pages;
 * this file only handles the things HTMX does not do for us.
 */
(function () {
  'use strict';

  var content = document.getElementById('content');
  var pageTitle = document.getElementById('page-title');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  var menuBtn = document.getElementById('menu-btn');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  /* ---------- Active link in the sidebar ---------- */
  function setActive(name) {
    document.querySelectorAll('.nav-link').forEach(function (link) {
      var on = link.getAttribute('data-nav') === name;
      link.classList.toggle('is-active', on);
      if (on) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /* ---------- Mobile sidebar ---------- */
  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSidebar(); }
  });

  /* Any element with data-nav (sidebar links, table rows, back links)
     highlights the matching sidebar link and closes the mobile menu. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-nav]');
    if (!el) { return; }
    setActive(el.getAttribute('data-nav'));
    closeSidebar();
  });
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'Enter') { return; }
    var el = e.target.closest ? e.target.closest('[data-nav]') : null;
    if (el) { setActive(el.getAttribute('data-nav')); }
  });

  /* ---------- Computers page: search and status filter ---------- */
  function applyFilter() {
    var body = document.getElementById('computers-body');
    if (!body) { return; }

    var searchBox = document.getElementById('computer-search');
    var query = searchBox ? searchBox.value.trim().toLowerCase() : '';
    var active = document.querySelector('[data-filter][aria-pressed="true"]');
    var status = active ? active.getAttribute('data-filter') : 'all';

    var rows = body.querySelectorAll('tr[data-name]');
    var shown = 0;
    rows.forEach(function (row) {
      var matchesStatus = status === 'all' || row.getAttribute('data-status') === status;
      var matchesName = row.getAttribute('data-name').toLowerCase().indexOf(query) !== -1;
      var visible = matchesStatus && matchesName;
      row.classList.toggle('hidden', !visible);
      if (visible) { shown += 1; }
    });

    var empty = document.getElementById('empty-state');
    if (empty) { empty.classList.toggle('hidden', shown > 0); }

    var count = document.getElementById('result-count');
    if (count) {
      count.textContent = 'Showing ' + shown + ' of ' + rows.length + ' computers';
    }
  }

  document.addEventListener('input', function (e) {
    if (e.target.id === 'computer-search') { applyFilter(); }
  });
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-filter]');
    if (!chip) { return; }
    document.querySelectorAll('[data-filter]').forEach(function (c) {
      c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
    });
    applyFilter();
  });

  /* ---------- After HTMX puts new HTML on the page ---------- */
  document.body.addEventListener('htmx:afterSettle', function (e) {
    window.HeimdallCharts.init(e.target);
    applyFilter();

    // A whole page was swapped in: update title, scroll up, move focus.
    if (e.target === content) {
      var marker = content.querySelector('[data-title]');
      if (marker) {
        var title = marker.getAttribute('data-title');
        pageTitle.textContent = title;
        document.title = title + ' | Heimdall';
      }
      window.scrollTo({ top: 0 });
      content.focus({ preventScroll: true });
    }
  });

  /* ---------- Errors ---------- */
  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.add('opacity-0', 'translate-y-2');
    }, 5000);
  }

  function showErrorCard() {
    content.innerHTML =
      '<div class="mx-auto mt-10 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center">' +
        '<p class="font-display text-lg font-semibold">This page could not load</p>' +
        '<p class="mt-2 text-sm text-slate-600">The dashboard could not get its data. ' +
        'Check that the dashboard server is running, then try again.</p>' +
        '<button type="button" onclick="location.reload()" ' +
        'class="mt-5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">Try again</button>' +
      '</div>';
  }

  function handleError(e) {
    showToast('Could not load data. Check your connection and try again.');
    if (e.detail && e.detail.target === content) { showErrorCard(); }
  }
  document.body.addEventListener('htmx:responseError', handleError);
  document.body.addEventListener('htmx:sendError', handleError);
})();

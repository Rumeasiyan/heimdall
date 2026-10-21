/**
 * Heimdall Public Portal Controller
 * Implements all Public Scope tasks: FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR6a, FR33, SR-H1, SR-H2, SR-G5.
 */
(function () {
  'use strict';

  var state = {
    offices: [],
    timeseries: {},
    selectedOfficeId: null,
    currentRange: '7d',
    dateFrom: '',
    dateTo: '',
    statusFilter: 'all',
    districtFilter: 'all',
    searchQuery: ''
  };

  function init() {
    loadData().then(function () {
      var defaultRange = PublicData.presetRange(state.timeseries, state.currentRange);
      setArchiveRange(defaultRange.from, defaultRange.to, false);
      setupEventListeners();
      renderNationalOverview();
      renderOfficeList();

      PublicMap.init('public-map-container', state.offices, function (officeId, openDetails) {
        selectOffice(officeId, openDetails);
      });

      // Handle permalink from URL
      checkUrlParams();

      // Listen to popstate (back/forward button)
      window.addEventListener('popstate', function () {
        checkUrlParams();
      });
    }).catch(function (error) {
      var errorContainer = document.getElementById('portal-error');
      if (errorContainer) {
        errorContainer.textContent = 'The public preview could not be initialized. Check the local server and reload.';
        errorContainer.classList.remove('hidden');
      }
      console.error('Failed to initialize the public portal:', error);
    });
  }

  function loadData() {
    function fetchJson(path) {
      return fetch(path).then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ').');
        }
        return response.json();
      });
    }

    return Promise.all([
      fetchJson('data/public-offices.json'),
      fetchJson('data/timeseries-fixture.json')
    ]).then(function (results) {
      if (!Array.isArray(results[0]) || !results[1].ranges) {
        throw new Error('The public fixture data has an invalid format.');
      }
      PublicData.validateOffices(results[0]);
      PublicData.validateTimeseries(results[1]);
      state.offices = results[0];
      state.timeseries = results[1];
    });
  }

  function checkUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var officeId = params.get('office');
    var range = params.get('range');
    var from = params.get('from');
    var to = params.get('to');

    if (from || to) {
      if (!setArchiveRange(from, to, false)) {
        showArchiveRangeError('The archive link contains an invalid date range.');
      }
    } else if (range && ['24h', '7d', '30d'].indexOf(range) !== -1) {
      var preset = PublicData.presetRange(state.timeseries, range);
      setArchiveRange(preset.from, preset.to, false);
    } else if (!from && !to) {
      var defaultRange = PublicData.presetRange(state.timeseries, '7d');
      setArchiveRange(defaultRange.from, defaultRange.to, false);
    }

    if (officeId) {
      var found = state.offices.some(function (o) { return o.id === officeId; });
      if (found) {
        selectOffice(officeId, true, false); // do not push state again
      } else {
        showArchiveRangeError('This office is not available in the current fixture.');
      }
    } else {
      state.selectedOfficeId = null;
      var details = document.getElementById('office-inspection-section');
      if (details) details.classList.add('hidden');
      PublicBandCharts.destroyAll();
      updatePermalinkInput(window.location.href);
    }
  }

  function updatePermalink(officeId) {
    var url = new URL(window.location.href);
    if (officeId) {
      url.searchParams.set('office', officeId);
    } else {
      url.searchParams.delete('office');
    }
    url.searchParams.delete('range');
    url.searchParams.set('from', state.dateFrom);
    url.searchParams.set('to', state.dateTo);
    window.history.pushState({ officeId: officeId }, '', url.toString());
    updatePermalinkInput(url.toString());
  }

  function updatePermalinkInput(value) {
    var permalinkInput = document.getElementById('permalink-input');
    if (permalinkInput) {
      permalinkInput.value = value || window.location.href;
    }
  }

  function showArchiveRangeError(message) {
    var messageElement = document.getElementById('archive-range-message');
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  function setArchiveRange(from, to, updateHistory) {
    if (!PublicData.isDate(from) || !PublicData.isDate(to) || from > to) {
      return false;
    }

    state.dateFrom = from;
    state.dateTo = to;
    state.currentRange = ['24h', '7d', '30d'].find(function (range) {
      var preset = PublicData.presetRange(state.timeseries, range);
      return preset.from === from && preset.to === to;
    }) || 'custom';

    var fromInput = document.getElementById('archive-from-date');
    var toInput = document.getElementById('archive-to-date');
    if (fromInput) fromInput.value = from;
    if (toInput) toInput.value = to;
    showArchiveRangeError('');
    updateRangeButtons();

    if (updateHistory) {
      updatePermalink(state.selectedOfficeId);
    }
    if (state.selectedOfficeId) {
      renderTimeseriesCharts(state.selectedOfficeId);
    }
    return true;
  }

  function renderNationalOverview() {
    var totalOffices = state.offices.length;
    var onlineOffices = state.offices.filter(function (o) { return o.status === 'online'; }).length;
    var degradedOffices = state.offices.filter(function (o) { return o.status === 'degraded'; }).length;
    var silentOffices = state.offices.filter(function (o) { return o.status === 'silent'; }).length;

    var totalEnrolled = state.offices.reduce(function (acc, o) { return acc + o.enrolledComputers; }, 0);
    var totalLimit = state.offices.reduce(function (acc, o) { return acc + o.computerLimit; }, 0);
    var coveragePercent = totalLimit > 0 ? Math.round((totalEnrolled / totalLimit) * 100) : 0;

    // National median download & latency (excluding silent)
    var activeOffices = state.offices.filter(function (o) { return o.status !== 'silent'; });
    var downloadMedians = activeOffices.map(function (office) {
      return office.metrics.download.median;
    }).sort(function (a, b) { return a - b; });
    var middle = Math.floor(downloadMedians.length / 2);
    var medianSpeed = downloadMedians.length === 0
      ? '—'
      : (downloadMedians.length % 2
        ? downloadMedians[middle]
        : (downloadMedians[middle - 1] + downloadMedians[middle]) / 2).toFixed(1);

    var container = document.getElementById('national-summary-stats');
    if (!container) return;

    container.innerHTML = [
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">',
      '  <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">',
      '    <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Participating Offices</p>',
      '    <div class="mt-2 flex items-baseline gap-2">',
      '      <span class="font-display text-2xl font-bold text-slate-900">' + totalOffices + '</span>',
      '      <span class="text-xs text-slate-500">government sites</span>',
      '    </div>',
      '    <div class="mt-2 flex items-center gap-1.5 text-xs">',
      '      <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> ' + onlineOffices + ' online',
      '      <span class="text-slate-300">|</span>',
      '      <span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span> ' + degradedOffices + ' slow',
      '      <span class="text-slate-300">|</span>',
      '      <span class="inline-block w-2 h-2 rounded-sm bg-purple-600"></span> <strong class="text-purple-700">' + silentOffices + ' silent</strong>',
      '    </div>',
      '  </div>',

      '  <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">',
      '    <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">National Coverage (FR6a)</p>',
      '    <div class="mt-2 flex items-baseline gap-2">',
      '      <span class="font-display text-2xl font-bold text-slate-900">' + totalEnrolled + '</span>',
      '      <span class="text-xs text-slate-500">/ ' + totalLimit + ' terminals (' + coveragePercent + '%)</span>',
      '    </div>',
      '    <div class="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">',
      '      <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ' + coveragePercent + '%"></div>',
      '    </div>',
      '  </div>',

      '  <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">',
      '    <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Typical Download Speed (FR22)</p>',
      '    <div class="mt-2 flex items-baseline gap-2">',
      '      <span class="font-display text-2xl font-bold text-sky-600">' + medianSpeed + '</span>',
      '      <span class="text-xs text-slate-500">Mbps (Median of office medians)</span>',
      '    </div>',
      '    <p class="mt-2 text-xs text-slate-400">Strictly median figures, never peak bursts</p>',
      '  </div>',

      '  <div class="bg-white rounded-xl p-4 border border-purple-200 bg-purple-50/50 shadow-sm">',
      '    <div class="flex items-center justify-between">',
      '      <p class="text-xs font-semibold uppercase tracking-wider text-purple-900">Silent Offices (FR23)</p>',
      '      <span class="px-2 py-0.5 text-xs font-bold rounded bg-purple-200 text-purple-900 font-mono">NEVER OMITTED</span>',
      '    </div>',
      '    <div class="mt-2 flex items-baseline gap-2">',
      '      <span class="font-display text-2xl font-bold text-purple-900">' + silentOffices + '</span>',
      '      <span class="text-xs text-purple-700">unreachable locations</span>',
      '    </div>',
      '    <p class="mt-2 text-xs text-purple-800">Rendered visibly in distinct purple</p>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function renderOfficeList() {
    var container = document.getElementById('office-cards-container');
    if (!container) return;

    var filtered = state.offices.filter(function (office) {
      if (state.statusFilter !== 'all' && office.status !== state.statusFilter) {
        return false;
      }
      if (state.districtFilter !== 'all' && office.district.toLowerCase() !== state.districtFilter.toLowerCase()) {
        return false;
      }
      if (state.searchQuery) {
        var query = state.searchQuery.toLowerCase();
        var matchesName = office.name.toLowerCase().indexOf(query) !== -1;
        var matchesDistrict = office.district.toLowerCase().indexOf(query) !== -1;
        var matchesCategory = office.category.toLowerCase().indexOf(query) !== -1;
        return matchesName || matchesDistrict || matchesCategory;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">No participating offices match your criteria.</div>';
      return;
    }

    var html = filtered.map(function (office) {
      var isSilent = office.status === 'silent';
      var isDegraded = office.status === 'degraded';

      var badgeClass, badgeText;
      if (isSilent) {
        badgeClass = 'bg-purple-100 text-purple-900 border-purple-300 font-semibold';
        badgeText = '✕ Explicitly Silent (0 reporting)';
      } else if (isDegraded) {
        badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
        badgeText = '▲ Degraded Connection';
      } else {
        badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        badgeText = '● Online & Reporting';
      }

      var isSelected = office.id === state.selectedOfficeId;
      var cardBorder = isSelected ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-slate-300';

      return [
        '<div class="office-card bg-white rounded-xl p-5 border ' + cardBorder + ' shadow-sm transition flex flex-col justify-between" data-office-id="' + PublicData.escapeHtml(office.id) + '">',
        '  <div>',
        '    <div class="flex items-start justify-between gap-2 mb-2">',
        '      <span class="inline-block px-2.5 py-0.5 text-xs rounded-full border ' + badgeClass + '">' + badgeText + '</span>',
        '      <span class="text-xs text-slate-400">' + PublicData.escapeHtml(office.district) + '</span>',
        '    </div>',
        '    <h3 class="font-display font-semibold text-base text-slate-900 mb-1 leading-snug">' + PublicData.escapeHtml(office.name) + '</h3>',
        '    <p class="text-xs text-slate-500 mb-3">' + PublicData.escapeHtml(office.category) + ' &bull; ' + PublicData.escapeHtml(office.province) + '</p>',
        '    <div class="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 mb-3">',
        '      <div>',
        '        <span class="text-slate-400 block">Coverage (FR6a)</span>',
        '        <strong class="text-slate-800">' + office.enrolledComputers + ' / ' + office.computerLimit + '</strong> <span class="text-slate-400">enrolled</span>',
        '      </div>',
        '      <div>',
        '        <span class="text-slate-400 block">Last Active</span>',
        '        <span class="text-slate-800 font-medium">' + PublicData.escapeHtml(office.lastReported) + '</span>',
        '      </div>',
        '    </div>',
        isSilent
          ? '<div class="text-xs text-purple-700 bg-purple-50 p-2 rounded mb-3 font-medium">Power loss or connectivity fault. Shown explicitly silent per FR23.</div>'
          : '<div class="grid grid-cols-2 gap-2 text-xs mb-3">' +
            '  <div><span class="text-slate-400 block">Median Download</span><strong class="text-sky-700 text-sm">' + office.metrics.download.median + ' Mbps</strong> <span class="text-[10px] text-slate-400">(p10: ' + office.metrics.download.p10 + ')</span></div>' +
            '  <div><span class="text-slate-400 block">Median Latency</span><strong class="text-slate-800 text-sm">' + office.metrics.latency.median + ' ms</strong></div>' +
            '</div>',
        '  </div>',
        '  <div class="pt-2">',
        '    <button type="button" class="select-office-btn w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-indigo-600 transition cursor-pointer text-center" data-office-id="' + PublicData.escapeHtml(office.id) + '">',
        '      Inspect Connectivity History &rarr;',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }).join('\n');

    container.innerHTML = html;

    // Attach click handlers to cards and buttons
    container.querySelectorAll('.select-office-btn, .office-card').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var id = el.getAttribute('data-office-id');
        if (id) {
          selectOffice(id, true);
        }
      });
    });
  }

  function selectOffice(officeId, scrollToDetails, shouldPushState) {
    if (shouldPushState !== false) {
      updatePermalink(officeId);
    }

    state.selectedOfficeId = officeId;
    renderOfficeList(); // update active highlight

    PublicMap.selectOffice(officeId, true);

    var office = state.offices.find(function (o) { return o.id === officeId; });
    if (!office) return;

    renderOfficeDetails(office);

    if (scrollToDetails) {
      var detailsEl = document.getElementById('office-inspection-section');
      if (detailsEl) {
        detailsEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function renderOfficeDetails(office) {
    var section = document.getElementById('office-inspection-section');
    if (!section) return;

    section.classList.remove('hidden');

    // Header information
    document.getElementById('detail-office-name').textContent = office.name;
    document.getElementById('detail-office-meta').textContent = office.category + ' • ' + office.district + ', ' + office.province + ' • Last report: ' + office.lastReported;

    // Status Badge
    var badgeEl = document.getElementById('detail-office-status');
    if (office.status === 'online') {
      badgeEl.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
      badgeEl.textContent = '● Online & Reporting';
    } else if (office.status === 'degraded') {
      badgeEl.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
      badgeEl.textContent = '▲ Degraded Connection';
    } else {
      badgeEl.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300 font-mono';
      badgeEl.textContent = '✕ EXPLICITLY SILENT (0 Reporting)';
    }

    // Permalink share input
    updatePermalinkInput(window.location.href);

    // Coverage widget (FR6a)
    var coveragePct = Math.round((office.enrolledComputers / office.computerLimit) * 100);
    document.getElementById('coverage-numbers').textContent = office.enrolledComputers + ' of ' + office.computerLimit + ' computers enrolled (' + coveragePct + '%)';
    document.getElementById('coverage-bar').style.width = coveragePct + '%';

    // HEIMDALL Overhead widget (FR33)
    document.getElementById('heimdall-data-used').textContent = office.heimdallDataUse.monthBytes;
    document.getElementById('heimdall-percent-bw').textContent = office.heimdallDataUse.percentOfBandwidth + '% of total bandwidth';
    document.getElementById('heimdall-daily-avg').textContent = office.heimdallDataUse.dailyAverage;

    // Key Performance Metrics (FR22: Medians with p10 to p90 band)
    if (office.status !== 'silent') {
      document.getElementById('metric-download-median').textContent = office.metrics.download.median + ' Mbps';
      document.getElementById('metric-download-band').textContent = 'p10: ' + office.metrics.download.p10 + ' • p90: ' + office.metrics.download.p90 + ' Mbps';

      document.getElementById('metric-upload-median').textContent = office.metrics.upload.median + ' Mbps';
      document.getElementById('metric-upload-band').textContent = 'p10: ' + office.metrics.upload.p10 + ' • p90: ' + office.metrics.upload.p90 + ' Mbps';

      document.getElementById('metric-latency-median').textContent = office.metrics.latency.median + ' ms';
      document.getElementById('metric-latency-band').textContent = 'p10: ' + office.metrics.latency.p10 + ' • p90: ' + office.metrics.latency.p90 + ' ms';
    } else {
      document.getElementById('metric-download-median').textContent = '—';
      document.getElementById('metric-download-band').textContent = 'No measurement reported';
      document.getElementById('metric-upload-median').textContent = '—';
      document.getElementById('metric-upload-band').textContent = 'No measurement reported';
      document.getElementById('metric-latency-median').textContent = '—';
      document.getElementById('metric-latency-band').textContent = 'No measurement reported';
    }

    // Render Charts
    renderTimeseriesCharts(office.id);

    // Render Anonymised Per-Computer Breakdown (FR20, SR-H1, SR-H2)
    renderPerComputerBreakdown(office);

    // Render Enrolment History (FR21)
    renderEnrolmentTimeline(office);
  }

  function renderTimeseriesCharts(officeId) {
    var office = state.offices.find(function (entry) { return entry.id === officeId; });
    var message = document.getElementById('archive-data-message');
    var points = office && office.status !== 'silent'
      ? PublicData.getFixturePoints(state.timeseries, officeId, state.currentRange, state.dateFrom, state.dateTo)
      : [];

    if (points.length === 0) {
      PublicBandCharts.destroyAll();
      if (message) {
        message.textContent = office && office.status === 'silent'
          ? 'This office is silent; no performance measurements are available.'
          : 'No fixture measurements are available for this office and date range.';
        message.classList.remove('hidden');
      }
      return;
    }

    if (message) {
      message.textContent = '';
      message.classList.add('hidden');
    }
    var labels = points.map(function (point) { return point.label; });
    function values(metric, percentile) {
      return points.map(function (point) {
        return point[metric] ? point[metric][percentile] : null;
      });
    }

    [
      ['public-bandwidth-chart', 'download', 'Mbps'],
      ['public-upload-chart', 'upload', 'Mbps'],
      ['public-latency-chart', 'latency', 'ms'],
      ['public-jitter-chart', 'jitter', 'ms'],
      ['public-loss-chart', 'packetLoss', '%'],
      ['public-uptime-chart', 'uptime', '%']
    ].forEach(function (chart) {
      PublicBandCharts.render(chart[0], {
        type: chart[1],
        labels: labels,
        p10: values(chart[1], 'p10'),
        median: values(chart[1], 'median'),
        p90: values(chart[1], 'p90'),
        unit: chart[2]
      });
    });
  }

  /**
   * SR-H1: Privacy protection for small offices.
   * Withholds per-computer breakdown below minimum office size (<3 computers).
   */
  function renderPerComputerBreakdown(office) {
    var container = document.getElementById('per-computer-table-container');
    if (!container) return;

    // SR-H1 Enforcement: < 3 computers -> WITHHELD TO PROTECT INDIVIDUAL PRIVACY
    if (office.enrolledComputers < 3 || office.reportingComputers < 3) {
      container.innerHTML = [
        '<div class="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">',
        '  <div class="flex items-center gap-3 mb-2">',
        '    <svg class="h-6 w-6 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        '    <h4 class="font-display font-semibold text-base text-amber-950">Privacy Protection Rule (SR-H1) Active</h4>',
        '  </div>',
        '  <p class="text-sm leading-relaxed mb-3">',
        '    Per-computer rows are withheld because this office has fewer than three enrolled and reporting computers. Under <strong>SR-H1</strong>, the fixture and exports omit device rows below this threshold.',
        '  </p>',
        '  <p class="text-xs text-amber-800">',
        '    Individual rows could be correlated to a person or workstation in a small office. Only office-level aggregates are published.',
        '  </p>',
        '</div>'
      ].join('\n');
      return;
    }

    // FR20 & SR-H2: Anonymised per-computer breakdown ("Computer 3")
    // Labels assigned randomly and kept stable, never in install order
    var rows = office.computers.map(function (c) {
      var isOnline = c.status === 'online';
      return [
        '<tr class="border-b border-slate-100 hover:bg-slate-50 transition">',
        '  <td class="py-3 px-4 font-mono font-medium text-slate-900">' + PublicData.escapeHtml(c.label) + '</td>',
        '  <td class="py-3 px-4">',
        isOnline
          ? '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Online</span>'
          : '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Silent</span>',
        '  </td>',
        '  <td class="py-3 px-4 text-right font-medium text-slate-800">' + (isOnline ? c.downloadMedian + ' Mbps' : '—') + '</td>',
        '  <td class="py-3 px-4 text-right font-medium text-slate-800">' + (isOnline ? c.uploadMedian + ' Mbps' : '—') + '</td>',
        '  <td class="py-3 px-4 text-right font-medium text-slate-800">' + (isOnline ? c.latencyMedian + ' ms' : '—') + '</td>',
        '  <td class="py-3 px-4 text-right text-xs text-slate-500 font-mono">' + (isOnline ? c.packetLoss + '%' : '100%') + '</td>',
        '</tr>'
      ].join('\n');
    }).join('\n');

    container.innerHTML = [
      '<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">',
      '  <table class="w-full text-left text-sm">',
      '    <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">',
      '      <tr>',
      '        <th class="py-3 px-4">Anonymised Identifier (FR20)</th>',
      '        <th class="py-3 px-4">State</th>',
      '        <th class="py-3 px-4 text-right">Median Download</th>',
      '        <th class="py-3 px-4 text-right">Median Upload</th>',
      '        <th class="py-3 px-4 text-right">Median Latency</th>',
      '        <th class="py-3 px-4 text-right">Packet Loss</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + rows + '</tbody>',
      '  </table>',
      '</div>',
      '<p class="mt-2 text-xs text-slate-400">',
      '  * Fixture labels are illustrative only. Production labels must be generated server-side and must not reveal install order or device identifiers.',
      '</p>'
    ].join('\n');
  }

  /**
   * FR21: Enrolment history, anonymised and dated.
   */
  function renderEnrolmentTimeline(office) {
    var container = document.getElementById('enrolment-timeline-container');
    if (!container) return;

    var events = office.enrolmentHistory || [];
    if (events.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-500">No enrolment events recorded.</p>';
      return;
    }

    var html = events.map(function (ev) {
      var dotColor = 'bg-indigo-600';
      if (ev.type === 'stopped') dotColor = 'bg-rose-500';
      if (ev.type === 'resumed') dotColor = 'bg-emerald-500';

      return [
        '<li class="relative flex gap-x-4 pl-2">',
        '  <div class="absolute left-0 top-1.5 -ml-1 h-2.5 w-2.5 rounded-full ' + dotColor + ' ring-4 ring-white"></div>',
        '  <div class="flex-auto py-0.5">',
        '    <div class="flex justify-between gap-x-4">',
        '      <span class="text-xs font-semibold text-slate-900">' + PublicData.escapeHtml(ev.type.toUpperCase()) + '</span>',
        '      <time class="text-xs text-slate-400 font-mono">' + PublicData.escapeHtml(ev.date) + '</time>',
        '    </div>',
        '  </div>',
        '</li>'
      ].join('\n');
    }).join('\n');

    container.innerHTML = '<ul class="space-y-4 border-l-2 border-slate-200 ml-2.5 pl-4">' + html + '</ul>';
  }

  function setupEventListeners() {
    // Status filters (All, Online, Degraded, Silent)
    var filterBtns = document.querySelectorAll('[data-status-filter]');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) {
          b.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
          b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        });
        btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');

        state.statusFilter = btn.getAttribute('data-status-filter');
        PublicMap.setFilter(state.statusFilter, state.offices, selectOffice);
        renderOfficeList();
      });
    });

    // District filters (All, Trincomalee, Batticaloa, Ampara)
    var districtBtns = document.querySelectorAll('[data-district-filter]');
    districtBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        districtBtns.forEach(function (b) {
          b.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600');
          b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        });
        btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');

        state.districtFilter = btn.getAttribute('data-district-filter');
        PublicMap.setDistrictFilter(state.districtFilter, state.offices, selectOffice);
        renderOfficeList();
      });
    });

    // Search bar
    var searchInput = document.getElementById('office-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value.trim();
        renderOfficeList();
      });
    }

    // Time range toggle buttons (24h, 7d, 30d)
    var rangeBtns = document.querySelectorAll('[data-range-btn]');
    rangeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var range = btn.getAttribute('data-range-btn');
        var dates = PublicData.presetRange(state.timeseries, range);
        setArchiveRange(dates.from, dates.to, true);
      });
    });

    var applyRangeButton = document.getElementById('apply-archive-range');
    if (applyRangeButton) {
      applyRangeButton.addEventListener('click', function () {
        var from = document.getElementById('archive-from-date').value;
        var to = document.getElementById('archive-to-date').value;
        if (!setArchiveRange(from, to, true)) {
          showArchiveRangeError('Choose valid dates, with the start date on or before the end date.');
        }
      });
    }

    // Copy permalink button
    var copyBtn = document.getElementById('copy-permalink-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var input = document.getElementById('permalink-input');
        if (input) {
          input.select();
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            showArchiveRangeError('The permalink could not be copied automatically. Select and copy it manually.');
            return;
          }
          navigator.clipboard.writeText(input.value).then(function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy Link'; }, 2000);
          }).catch(function (error) {
            console.error('Could not copy the archive permalink:', error);
            showArchiveRangeError('The permalink could not be copied. Select and copy it manually.');
          });
        }
      });
    }

    // Open Data Download buttons (FR24)
    var downloadCsvBtn = document.getElementById('download-csv-btn');
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', downloadCsvDataset);
    }

    var downloadJsonBtn = document.getElementById('download-json-btn');
    if (downloadJsonBtn) {
      downloadJsonBtn.addEventListener('click', downloadJsonDataset);
    }
  }

  function updateRangeButtons() {
    var rangeBtns = document.querySelectorAll('[data-range-btn]');
    rangeBtns.forEach(function (b) {
      if (b.getAttribute('data-range-btn') === state.currentRange) {
        b.className = 'px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white';
      } else {
        b.className = 'px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    });
  }

  /**
   * FR24: Open Data Download (CSV)
   */
  function downloadCsvDataset() {
    var csv = PublicData.createCsvDataset(state.offices);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'heimdall_open_connectivity_data_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /**
   * FR24: Open Data Download (JSON)
   */
  function downloadJsonDataset() {
    var exportPayload = PublicData.createOpenDataPayload(state.offices, new Date().toISOString());

    var blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'heimdall_open_connectivity_dataset_' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Self initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PublicPortal = {
    selectOffice: selectOffice
  };
})();

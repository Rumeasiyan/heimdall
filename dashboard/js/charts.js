/*
 * Charts for the Heimdall dashboard.
 *
 * The server (or the mock files) returns plain HTML. Each chart is a <canvas>
 * with its data stored in data-* attributes, for example:
 *
 *   <canvas data-chart="line"
 *           data-labels='["10:00","10:05"]'
 *           data-datasets='[{"label":"CPU","data":[35,48],"color":"indigo"}]'
 *           data-unit="%" data-max="100"></canvas>
 *
 * After HTMX swaps new HTML into the page, app.js calls HeimdallCharts.init()
 * and every canvas inside the new HTML becomes a chart.
 */
(function () {
  'use strict';

  var PALETTE = {
    indigo: '#4F46E5',
    teal: '#0D9488',
    emerald: '#10B981',
    rose: '#F43F5E',
    amber: '#F59E0B',
    sky: '#0EA5E9',
    slate: '#E2E8F0'
  };

  var defaultsSet = false;

  function color(name) {
    return PALETTE[name] || name || PALETTE.indigo;
  }

  function readJSON(el, attr, fallback) {
    try {
      return JSON.parse(el.getAttribute(attr));
    } catch (err) {
      console.error('Invalid chart data in ' + attr, err);
      return fallback;
    }
  }

  function legendStyle(extra) {
    var base = { usePointStyle: true, boxWidth: 8, boxHeight: 8 };
    for (var key in extra) { base[key] = extra[key]; }
    return base;
  }

  function lineConfig(canvas) {
    var labels = readJSON(canvas, 'data-labels', []);
    var sets = readJSON(canvas, 'data-datasets', []);
    var unit = canvas.getAttribute('data-unit') || '';
    var max = canvas.getAttribute('data-max');

    return {
      type: 'line',
      data: {
        labels: labels,
        datasets: sets.map(function (s) {
          return {
            label: s.label,
            data: s.data,
            borderColor: color(s.color),
            backgroundColor: color(s.color) + '22',
            fill: !!s.fill,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: legendStyle({}) },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + unit;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
          y: {
            beginAtZero: true,
            max: max ? Number(max) : undefined,
            grid: { color: '#EEF0F5' },
            border: { display: false },
            ticks: {
              maxTicksLimit: 5,
              callback: function (value) { return value + unit; }
            }
          }
        }
      }
    };
  }

  function doughnutConfig(canvas) {
    var labels = readJSON(canvas, 'data-labels', []);
    var sets = readJSON(canvas, 'data-datasets', []);
    var unit = canvas.getAttribute('data-unit') || '';
    var first = sets[0] || { data: [], colors: [] };

    return {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: first.data,
          backgroundColor: (first.colors || []).map(color),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: legendStyle({ padding: 16 }) },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.label + ': ' + ctx.parsed + unit;
              }
            }
          }
        }
      }
    };
  }

  function init(root) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js did not load, so charts are skipped.');
      return;
    }

    if (!defaultsSet) {
      Chart.defaults.font.family = "Figtree, ui-sans-serif, system-ui, sans-serif";
      Chart.defaults.color = '#64748B';
      defaultsSet = true;
    }

    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('canvas[data-chart]').forEach(function (canvas) {
      var existing = Chart.getChart(canvas);
      if (existing) { existing.destroy(); }

      var type = canvas.getAttribute('data-chart');
      var config = type === 'doughnut' ? doughnutConfig(canvas) : lineConfig(canvas);
      new Chart(canvas, config);
    });
  }

  window.HeimdallCharts = { init: init };
})();

/**
 * Heimdall Public Portal - Band Charts (FR22: Medians with p10 to p90 band)
 * Strictly enforces that performance is presented as medians with variability bands,
 * NEVER maximums or best moments.
 */
(function () {
  'use strict';

  var chartInstances = {};

  var PALETTE = {
    download: {
      line: '#0284C7', // sky-600
      fill: 'rgba(2, 132, 199, 0.16)',
      pLine: 'rgba(2, 132, 199, 0.35)'
    },
    upload: {
      line: '#0D9488', // teal-600
      fill: 'rgba(13, 148, 136, 0.16)',
      pLine: 'rgba(13, 148, 136, 0.35)'
    },
    latency: {
      line: '#D97706', // amber-600
      fill: 'rgba(217, 119, 6, 0.16)',
      pLine: 'rgba(217, 119, 6, 0.35)'
    },
    jitter: {
      line: '#7C3AED',
      fill: 'rgba(124, 58, 237, 0.16)',
      pLine: 'rgba(124, 58, 237, 0.35)'
    },
    packetLoss: {
      line: '#E11D48',
      fill: 'rgba(225, 29, 72, 0.16)',
      pLine: 'rgba(225, 29, 72, 0.35)'
    },
    uptime: {
      line: '#059669',
      fill: 'rgba(5, 150, 105, 0.16)',
      pLine: 'rgba(5, 150, 105, 0.35)'
    }
  };

  function createBandChart(canvasId, options) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }

    var theme = PALETTE[options.type] || PALETTE.download;
    var labels = options.labels || [];
    var p10 = options.p10 || [];
    var median = options.median || [];
    var p90 = options.p90 || [];
    var unit = options.unit || '';

    var datasets = [
      {
        label: 'p90 (Upper 90th percentile)',
        data: p90,
        borderColor: theme.pLine,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false
      },
      {
        label: 'p10–p90 band',
        data: p10,
        borderColor: theme.pLine,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        backgroundColor: theme.fill,
        fill: '-1' // fills to dataset 0 (p90)
      },
      {
        label: 'Median (Typical performance)',
        data: median,
        borderColor: theme.line,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: theme.line,
        fill: false,
        tension: 0.3
      }
    ];

    var chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              filter: function (item) {
                // Keep legend clean: show Median and p10–p90 band
                return item.text !== 'p90 (Upper 90th percentile)';
              }
            }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            padding: 10,
            callbacks: {
              label: function (ctx) {
                var idx = ctx.dataIndex;
                if (ctx.datasetIndex === 2) {
                  return ' Median: ' + median[idx] + ' ' + unit + ' (p10: ' + p10[idx] + ', p90: ' + p90[idx] + ')';
                }
                return null;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748B', font: { family: 'Figtree' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            border: { display: false },
            ticks: {
              color: '#64748B',
              font: { family: 'Figtree' },
              callback: function (val) {
                return val + ' ' + unit;
              }
            }
          }
        }
      }
    });

    chartInstances[canvasId] = chart;
    return chart;
  }

  window.PublicBandCharts = {
    render: createBandChart,
    destroyAll: function () {
      Object.keys(chartInstances).forEach(function (k) {
        chartInstances[k].destroy();
      });
      chartInstances = {};
    }
  };
})();

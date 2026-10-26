(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PublicData = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  var MONTHS = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    var date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function presetRange(timeseries, range) {
    var asOf = timeseries.asOf;
    if (!isDate(asOf)) {
      throw new Error('The timeseries fixture must include a valid asOf date.');
    }

    var end = new Date(asOf + 'T00:00:00Z');
    var days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 0;
    if (!days) {
      return null;
    }

    if (range === '7d') {
      end.setUTCDate(end.getUTCDate() - 1);
    }
    var start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (range === '24h' ? 1 : days - 1));
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10)
    };
  }

  function timestampForLabel(range, label, index, labels, asOf) {
    if (range === '24h') {
      var asOfDate = new Date(asOf + 'T00:00:00Z');
      var dayOffset = -1;
      var previousMinutes = -1;
      var hour;
      var minute;

      for (var i = 0; i <= index; i += 1) {
        var parts = labels[i].split(':');
        hour = Number(parts[0]);
        minute = Number(parts[1]);
        var minutes = hour * 60 + minute;
        if (minutes < previousMinutes) {
          dayOffset += 1;
        }
        previousMinutes = minutes;
      }

      asOfDate.setUTCDate(asOfDate.getUTCDate() + dayOffset);
      return asOfDate.toISOString().slice(0, 10) + 'T' +
        String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00Z';
    }

    var dayMatch = range === '7d' ? label.match(/^[A-Za-z]{3}\s+(\d{1,2})$/) : null;
    var monthDayMatch = range === '30d' ? label.match(/^([A-Za-z]{3})\s+(\d{1,2})$/) : null;
    if (!dayMatch && !monthDayMatch) {
      return null;
    }

    var reference = new Date(asOf + 'T00:00:00Z');
    var year = reference.getUTCFullYear();
    var month = reference.getUTCMonth();
    var day;

    if (dayMatch) {
      day = Number(dayMatch[1]);
      if (day > reference.getUTCDate()) {
        month -= 1;
      }
    } else {
      month = MONTHS[monthDayMatch[1]];
      day = Number(monthDayMatch[2]);
      if (month > reference.getUTCMonth()) {
        year -= 1;
      }
    }

    var date = new Date(Date.UTC(year, month, day));
    return date.toISOString().slice(0, 10) + 'T12:00:00Z';
  }

  function getFixturePoints(timeseries, officeId, range, from, to) {
    if (!isDate(from) || !isDate(to) || from > to) {
      throw new Error('Choose a valid archive start and end date.');
    }

    var ranges = timeseries.ranges || {};
    var selectedRanges = range && ranges[range]
      ? [range]
      : Object.keys(ranges);
    var points = [];

    selectedRanges.forEach(function (rangeName) {
      var rangeData = ranges[rangeName];
      var officeData = rangeData[officeId] || rangeData.default;
      if (!officeData || !Array.isArray(rangeData.labels)) {
        return;
      }

      rangeData.labels.forEach(function (label, index) {
        var timestamp = timestampForLabel(rangeName, label, index, rangeData.labels, timeseries.asOf);
        if (!timestamp || timestamp.slice(0, 10) < from || timestamp.slice(0, 10) > to) {
          return;
        }

        var point = {
          timestamp: timestamp,
          label: rangeName === '24h' ? timestamp.slice(5, 16).replace('T', ' ') : timestamp.slice(0, 10),
          download: {},
          upload: {},
          latency: {},
          jitter: {},
          packetLoss: {},
          uptime: {}
        };

        ['download', 'upload', 'latency', 'jitter', 'packetLoss', 'uptime'].forEach(function (metric) {
          var series = officeData[metric];
          if (series) {
            point[metric] = {
              p10: series.p10[index],
              median: series.median[index],
              p90: series.p90[index]
            };
          }
        });
        points.push(point);
      });
    });

    return points.sort(function (a, b) {
      return a.timestamp.localeCompare(b.timestamp);
    });
  }

  function createOpenDataPayload(offices, publishedAt) {
    return {
      specVersion: 'HEIMDALL-OPEN-DATA-v1',
      publishedAt: publishedAt,
      license: 'ODbL-1.0 (Open Database License)',
      dataSource: 'Synthetic development fixtures; not live measurements.',
      offices: offices.map(function (office) {
        var result = Object.assign({}, office);
        var mayPublishRows = office.enrolledComputers >= 3 && office.reportingComputers >= 3;

        if (!mayPublishRows || !Array.isArray(office.computers)) {
          delete result.computers;
        } else {
          result.computers = office.computers.map(function (computer) {
            return Object.assign({}, computer);
          });
        }

        result.enrolmentHistory = (office.enrolmentHistory || []).map(function (event) {
          return {
            date: event.date,
            type: event.type
          };
        });
        return result;
      })
    };
  }

  function createCsvDataset(offices) {
    var headers = [
      'office_id', 'office_name', 'district', 'status',
      'enrolled_computers', 'reporting_computers',
      'download_p10_mbps', 'download_median_mbps', 'download_p90_mbps',
      'upload_p10_mbps', 'upload_median_mbps', 'upload_p90_mbps',
      'latency_p10_ms', 'latency_median_ms', 'latency_p90_ms',
      'jitter_p10_ms', 'jitter_median_ms', 'jitter_p90_ms',
      'packet_loss_p10_percent', 'packet_loss_median_percent', 'packet_loss_p90_percent',
      'uptime_p10_percent', 'uptime_median_percent', 'uptime_p90_percent',
      'heimdall_overhead_mb'
    ];

    function cell(value) {
      if (value === null || value === undefined) return '';
      return '"' + String(value).replace(/"/g, '""') + '"';
    }

    var lines = [headers.join(',')];
    offices.forEach(function (office) {
      var metrics = office.metrics || {};
      var row = [
        cell(office.id),
        cell(office.name),
        cell(office.district),
        cell(office.status),
        office.enrolledComputers,
        office.reportingComputers
      ];
      ['download', 'upload', 'latency', 'jitter', 'packetLoss', 'uptime']
        .forEach(function (metricName) {
          var metric = metrics[metricName];
          row.push(metric ? metric.p10 : '');
          row.push(metric ? metric.median : '');
          row.push(metric ? metric.p90 : '');
        });
      row.push(cell(office.heimdallDataUse.monthBytes));
      lines.push(row.join(','));
    });
    return lines.join('\r\n');
  }

  function validateOffices(offices) {
    if (!Array.isArray(offices)) {
      throw new Error('Office fixtures must be an array.');
    }

    offices.forEach(function (office) {
      if (!office.id || !office.name || !Array.isArray(office.coordinates) ||
          !['online', 'degraded', 'silent'].includes(office.status)) {
        throw new Error('An office fixture is missing required public fields.');
      }
      if (!Number.isInteger(office.enrolledComputers) ||
          !Number.isInteger(office.reportingComputers) ||
          office.enrolledComputers < 0 ||
          office.reportingComputers < 0 ||
          office.reportingComputers > office.enrolledComputers) {
        throw new Error('Office fixture coverage counts are invalid.');
      }
      if (!Array.isArray(office.coordinates) ||
          office.coordinates.length !== 2 ||
          !office.coordinates.every(Number.isFinite)) {
        throw new Error('Office fixture coordinates are invalid.');
      }
      if (office.status === 'silent') {
        if (office.reportingComputers !== 0 || office.metrics !== null) {
          throw new Error('Silent offices must not publish performance measurements.');
        }
      } else if (!office.metrics) {
        throw new Error('Reporting offices must include aggregate metrics.');
      } else {
        ['download', 'upload', 'latency', 'jitter', 'packetLoss', 'uptime'].forEach(function (metricName) {
          var metric = office.metrics[metricName];
          if (!metric ||
              !Number.isFinite(metric.p10) ||
              !Number.isFinite(metric.median) ||
              !Number.isFinite(metric.p90) ||
              metric.p10 > metric.median ||
              metric.median > metric.p90) {
            throw new Error('Office aggregate percentiles are invalid.');
          }
        });
      }

      if ((office.enrolledComputers < 3 || office.reportingComputers < 3) &&
          Object.prototype.hasOwnProperty.call(office, 'computers')) {
        throw new Error('Small or non-reporting offices must not contain computer rows.');
      }
      (office.enrolmentHistory || []).forEach(function (event) {
        if (Object.keys(event).sort().join(',') !== 'date,type' ||
            !isDate(event.date) ||
            !['enrolled', 'stopped', 'removed', 'resumed'].includes(event.type)) {
          throw new Error('Enrolment events must contain only a date and an allowed event type.');
        }
      });
    });
    return true;
  }

  function validateTimeseries(timeseries) {
    if (!timeseries || !isDate(timeseries.asOf) ||
        !timeseries.ranges || typeof timeseries.ranges !== 'object') {
      throw new Error('The timeseries fixture is missing its date or ranges.');
    }

    Object.keys(timeseries.ranges).forEach(function (rangeName) {
      var range = timeseries.ranges[rangeName];
      if (!Array.isArray(range.labels)) {
        throw new Error('A timeseries fixture range has no labels.');
      }
      Object.keys(range).filter(function (key) { return key !== 'labels'; })
        .forEach(function (officeId) {
          ['download', 'upload', 'latency', 'jitter', 'packetLoss', 'uptime'].forEach(function (metricName) {
            var metric = range[officeId][metricName];
            if (!metric) return;
            ['p10', 'median', 'p90'].forEach(function (percentile) {
              if (!Array.isArray(metric[percentile]) ||
                  metric[percentile].length !== range.labels.length ||
                  metric[percentile].some(function (value) {
                    return !Number.isFinite(value);
                  })) {
                throw new Error('A timeseries percentile series has invalid values.');
              }
            });
            metric.p10.forEach(function (value, index) {
              if (value > metric.median[index] || metric.median[index] > metric.p90[index]) {
                throw new Error('Timeseries percentiles must be ordered p10 <= median <= p90.');
              }
            });
          });
        });
    });
    return true;
  }

  return {
    createCsvDataset: createCsvDataset,
    createOpenDataPayload: createOpenDataPayload,
    escapeHtml: escapeHtml,
    getFixturePoints: getFixturePoints,
    isDate: isDate,
    presetRange: presetRange,
    validateOffices: validateOffices,
    validateTimeseries: validateTimeseries
  };
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const PublicData = require('../js/public-data.js');

const dataDirectory = path.join(__dirname, '..', 'data');
const offices = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'public-offices.json'), 'utf8'));
const timeseries = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'timeseries-fixture.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('fixtures never publish device rows for small or non-reporting offices', () => {
  assert.equal(PublicData.validateOffices(offices), true);
  assert.equal(PublicData.validateTimeseries(timeseries), true);

  for (const office of offices) {
    if (office.enrolledComputers < 3 || office.reportingComputers < 3) {
      assert.equal(Object.hasOwn(office, 'computers'), false, office.id);
    }
  }
});

test('enrolment history fixtures contain no device or workstation descriptions', () => {
  for (const office of offices) {
    for (const event of office.enrolmentHistory) {
      assert.deepEqual(Object.keys(event).sort(), ['date', 'type'], office.id);
    }
  }
});

test('published aggregate percentiles are ordered and silent metrics are absent', () => {
  for (const office of offices) {
    if (office.status === 'silent') {
      assert.equal(office.metrics, null, office.id);
      continue;
    }

    for (const metric of Object.values(office.metrics)) {
      assert.ok(metric.p10 <= metric.median, office.id);
      assert.ok(metric.median <= metric.p90, office.id);
    }
  }
});

test('custom archive ranges return only fixture observations in the requested interval', () => {
  const points = PublicData.getFixturePoints(
    timeseries,
    'ep-chief-sec-trinco',
    null,
    '2026-10-14',
    '2026-10-15'
  );

  assert.ok(points.length > 0);
  for (const point of points) {
    assert.ok(point.timestamp.slice(0, 10) >= '2026-10-14');
    assert.ok(point.timestamp.slice(0, 10) <= '2026-10-15');
  }
});

test('archive presets resolve to the expected inclusive fixture dates', () => {
  assert.deepEqual(PublicData.presetRange(timeseries, '7d'), {
    from: '2026-10-14',
    to: '2026-10-20'
  });
  assert.deepEqual(PublicData.presetRange(timeseries, '30d'), {
    from: '2026-09-22',
    to: '2026-10-21'
  });
});

test('invalid archive dates are rejected', () => {
  assert.throws(
    () => PublicData.getFixturePoints(timeseries, 'ep-chief-sec-trinco', null, '2026-02-30', '2026-03-01'),
    /valid archive/
  );
  assert.throws(
    () => PublicData.getFixturePoints(timeseries, 'ep-chief-sec-trinco', null, '2026-10-21', '2026-10-20'),
    /valid archive/
  );
});

test('the public scope has no admin entry point and excludes out-of-scope metrics', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'admin.html')), false);
  assert.doesNotMatch(html, /admin\.html|CPU|memory|Alerts view/i);
  for (const canvasId of [
    'public-bandwidth-chart',
    'public-upload-chart',
    'public-latency-chart',
    'public-jitter-chart',
    'public-loss-chart',
    'public-uptime-chart'
  ]) {
    assert.match(html, new RegExp(`id="${canvasId}"`));
  }
});

test('open-data export applies privacy filtering and makes no false proof claim', () => {
  const payload = PublicData.createOpenDataPayload(offices, '2026-10-21T00:00:00.000Z');
  const smallOffice = payload.offices.find((office) => office.id === 'kattankudy-sub-post');
  const silentOffice = payload.offices.find((office) => office.status === 'silent');

  assert.equal(Object.hasOwn(smallOffice, 'computers'), false);
  assert.equal(Object.hasOwn(silentOffice, 'computers'), false);
  assert.ok(payload.offices.every((office) =>
    office.enrolmentHistory.every((event) => !('computer' in event) && !('notes' in event))
  ));
  assert.equal(Object.hasOwn(payload, 'merkleRoot'), false);
});

test('CSV export contains matching columns and leaves silent metrics empty', () => {
  const rows = PublicData.createCsvDataset(offices).split('\r\n');
  const columnCount = rows[0].split(',').length;
  const silentRow = rows.find((row) => row.includes('"silent"')).split(',');

  assert.ok(rows.every((row) => row.split(',').length === columnCount));
  assert.equal(silentRow[3], '"silent"');
  assert.ok(silentRow.slice(6, 24).every((value) => value === ''));
});

test('HTML values are escaped before fixture data is inserted into markup', () => {
  assert.equal(
    PublicData.escapeHtml(`<office & "desk">`),
    '&lt;office &amp; &quot;desk&quot;&gt;'
  );
});

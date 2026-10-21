/**
 * Heimdall Public Portal - Interactive Office Map (FR18, FR23)
 * Renders participating government offices with fixture status and performance.
 * Offices with no reporting computers are rendered as EXPLICITLY SILENT in a distinct color,
 * and are NEVER omitted (FR23).
 */
(function () {
  'use strict';

  var map = null;
  var markerGroup = null;
  var markersById = {};
  var currentFilter = 'all';
  var currentDistrict = 'all';
  var selectOfficeHandler = null;

  function escapeHtml(value) {
    return PublicData.escapeHtml(value);
  }

  function getMarkerIcon(status) {
    var bg, border, iconHtml;
    if (status === 'online') {
      bg = '#10B981'; // emerald-500
      border = '#065F46';
      iconHtml = '<span class="status-pulse-emerald"></span><div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:2px solid #ffffff;box-shadow:0 0 8px rgba(16,185,129,0.7);"></div>';
    } else if (status === 'degraded') {
      bg = '#F59E0B'; // amber-500
      border = '#92400E';
      iconHtml = '<span class="status-pulse-amber"></span><div style="width:14px;height:14px;border-radius:50%;background:#F59E0B;border:2px solid #ffffff;box-shadow:0 0 8px rgba(245,158,11,0.7);"></div>';
    } else {
      // SILENT (FR23) - Distinct purple/slate styling, never omitted
      bg = '#7C3AED'; // violet-600
      border = '#4C1D95';
      iconHtml = '<div style="width:16px;height:16px;border-radius:4px;background:#6D28D9;border:2px solid #F3E8FF;box-shadow:0 0 10px rgba(109,40,217,0.8);display:flex;align-items:center;justify-content:center;"><span style="color:#FFF;font-size:9px;font-weight:bold;">✕</span></div>';
    }

    return L.divIcon({
      className: 'custom-office-pin',
      html: '<div class="pin-wrapper pin-' + status + '">' + iconHtml + '</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }

  function initMap(containerId, offices, onSelectOffice) {
    if (map) {
      map.remove();
      map = null;
      markersById = {};
    }
    selectOfficeHandler = onSelectOffice;

    var mapEl = document.getElementById(containerId);
    if (!mapEl) return;

    // Centered over Eastern Province (Trincomalee, Batticaloa, Ampara)
    map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true
    }).setView([7.78, 81.65], 8.5);

    // Standard OpenStreetMap tiles (100% free, no API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    markerGroup = L.featureGroup().addTo(map);
    map.on('popupopen', function (event) {
      var popup = event.popup.getElement();
      var button = popup && popup.querySelector('.view-office-btn');
      if (!button) return;
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-office-id');
        if (id && typeof selectOfficeHandler === 'function') {
          selectOfficeHandler(id, true);
        }
      });
    });

    renderMarkers(offices, onSelectOffice);

    // Invalidate size to guarantee tiles load without blank/gray areas
    setTimeout(function () {
      if (map) { map.invalidateSize(); }
    }, 200);

    window.addEventListener('resize', function () {
      if (map) { map.invalidateSize(); }
    });

    return map;
  }

  function renderMarkers(offices, onSelectOffice) {
    if (!markerGroup) return;
    markerGroup.clearLayers();
    markersById = {};

    offices.forEach(function (office) {
      if (currentFilter !== 'all' && office.status !== currentFilter) {
        return;
      }
      if (currentDistrict !== 'all' && office.district.toLowerCase() !== currentDistrict.toLowerCase()) {
        return;
      }

      var icon = getMarkerIcon(office.status);
      var marker = L.marker(office.coordinates, { icon: icon });

      var statusBadge = '';
      if (office.status === 'online') {
        statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">● Online</span>';
      } else if (office.status === 'degraded') {
        statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">▲ Degraded</span>';
      } else {
        statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-900 font-mono">✕ SILENT (0 reporting)</span>';
      }

      var popupContent =
        '<div class="p-2 font-sans text-slate-900" style="min-width: 210px;">' +
        '<div class="flex items-center justify-between gap-2 mb-1.5">' +
        statusBadge +
        '<span class="text-xs text-slate-500">' + escapeHtml(office.district) + '</span>' +
        '</div>' +
        '<h3 class="font-semibold text-sm mb-1 text-slate-900 leading-tight">' + escapeHtml(office.name) + '</h3>' +
        '<div class="text-xs text-slate-600 mb-2">' +
        '<div>Coverage: <strong>' + office.enrolledComputers + ' / ' + office.computerLimit + '</strong> computers</div>' +
        (office.status !== 'silent'
          ? '<div>Median Download: <strong>' + office.metrics.download.median + ' Mbps</strong></div>' +
            '<div>Median Latency: <strong>' + office.metrics.latency.median + ' ms</strong></div>'
          : '<div class="text-purple-700 font-semibold mt-1">No active reports received</div>') +
        '</div>' +
        '<button type="button" class="view-office-btn w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition cursor-pointer text-center" data-office-id="' + escapeHtml(office.id) + '">' +
        'View Office Details & History &rarr;' +
        '</button>' +
        '</div>';

      marker.bindPopup(popupContent, { maxWidth: 280 });

      marker.on('click', function () {
        if (typeof onSelectOffice === 'function') {
          onSelectOffice(office.id, false); // select without closing popup
        }
      });

      markerGroup.addLayer(marker);
      markersById[office.id] = marker;
    });

  }

  function selectOffice(id, zoom) {
    var marker = markersById[id];
    if (marker && map) {
      if (zoom) {
        map.setView(marker.getLatLng(), 11, { animate: true });
      }
      marker.openPopup();
    }
  }

  function setFilter(status, offices, onSelectOffice) {
    currentFilter = status;
    renderMarkers(offices, onSelectOffice);
  }

  function setDistrictFilter(district, offices, onSelectOffice) {
    currentDistrict = district;
    renderMarkers(offices, onSelectOffice);
  }

  window.PublicMap = {
    init: initMap,
    selectOffice: selectOffice,
    setFilter: setFilter,
    setDistrictFilter: setDistrictFilter
  };
})();

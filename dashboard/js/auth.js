/*
 * Admin sign-in for the dashboard (MOCK).
 *
 * This only checks a demo username and password in the browser, so we can build
 * and show the screens before the backend exists. It is NOT real security:
 * anyone can read this file. When the backend is ready, the login must be
 * checked by the backend and every API request must be authorized there.
 */
(function () {
  'use strict';

  var KEY = 'heimdall_admin';
  var DEMO_USERNAME = 'admin';
  var DEMO_PASSWORD = 'admin123';

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  // Pretend to wait for a server, so the "Signing in" state can be seen.
  function login(username, password) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var ok = username === DEMO_USERNAME && password === DEMO_PASSWORD;
        if (ok) {
          try { sessionStorage.setItem(KEY, '1'); } catch (err) { ok = false; }
        }
        resolve(ok);
      }, 600);
    });
  }

  function logout() {
    try { sessionStorage.removeItem(KEY); } catch (err) { /* nothing to remove */ }
    window.location.href = 'login.html';
  }

  window.HeimdallAuth = { isLoggedIn: isLoggedIn, login: login, logout: logout };

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('logout-btn');
    if (button) { button.addEventListener('click', logout); }
  });
})();

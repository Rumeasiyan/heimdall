/* Behaviour of login.html: validation, "Signing in" state, error message. */
(function () {
  'use strict';

  // Already signed in? Go straight to the dashboard.
  if (HeimdallAuth.isLoggedIn()) {
    window.location.replace('index.html');
    return;
  }

  var form = document.getElementById('login-form');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  var showPassword = document.getElementById('show-password');
  var button = document.getElementById('login-btn');
  var error = document.getElementById('login-error');

  function showError(message) {
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? 'Signing in' : 'Sign in';
    button.classList.toggle('opacity-70', busy);
  }

  showPassword.addEventListener('change', function () {
    password.type = showPassword.checked ? 'text' : 'password';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = username.value.trim();
    var pass = password.value;

    if (!name || !pass) {
      showError('Enter your username and password.');
      (name ? password : username).focus();
      return;
    }

    showError('');
    setBusy(true);
    HeimdallAuth.login(name, pass).then(function (ok) {
      if (ok) {
        window.location.href = 'index.html';
      } else {
        setBusy(false);
        showError('The username or password is incorrect. Check them and try again.');
        password.value = '';
        password.focus();
      }
    });
  });
})();

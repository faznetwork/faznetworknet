(function customerSubmenuRecovery() {
  'use strict';

  function showCustomerRecoveryError(error) {
    const message = String(error && error.message || error || 'The customer page could not be opened. Reload the admin panel and try again.');
    let dynamic = document.getElementById('dynamicPageContent');
    if (!dynamic) {
      dynamic = document.createElement('div');
      dynamic.id = 'dynamicPageContent';
      dynamic.className = 'container-fluid py-3';
      const host = document.querySelector('.main-content') || document.body;
      host.appendChild(dynamic);
    }

    let view = document.getElementById('view-customer-filter');
    if (!view) {
      view = document.createElement('section');
      view.id = 'view-customer-filter';
      view.className = 'admin-view';
      dynamic.appendChild(view);
    }

    document.querySelectorAll('.admin-view').forEach(function (item) {
      item.style.display = 'none';
      item.classList.add('hidden');
    });
    dynamic.style.display = 'block';
    dynamic.hidden = false;
    view.style.display = 'block';
    view.hidden = false;
    view.classList.remove('hidden');
    view.replaceChildren();

    const alert = document.createElement('div');
    alert.className = 'alert alert-danger m-3';
    alert.setAttribute('role', 'alert');
    const heading = document.createElement('strong');
    heading.textContent = 'Customer page could not load.';
    const detail = document.createElement('div');
    detail.className = 'mt-1';
    detail.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-outline-danger btn-sm mt-3';
    retry.textContent = 'Try again';
    retry.addEventListener('click', function () {
      window.location.reload();
    });
    alert.append(heading, detail, retry);
    view.appendChild(alert);
    console.error('[Customer submenu recovery] Navigation failed:', error);
  }

  function invokeSafely(handler, args, isCustomerList) {
    if (typeof handler !== 'function') {
      showCustomerRecoveryError('The admin navigation script did not initialize correctly. Reload the page; if this repeats, report the browser console error.');
      return;
    }
    Promise.resolve().then(function () {
      return handler.apply(window, args);
    }).then(function (result) {
      if (result === false) {
        showCustomerRecoveryError('The requested customer view was not available. Please reload the admin panel and try again.');
        return;
      }
      if (isCustomerList) {
        const dynamic = document.getElementById('dynamicPageContent');
        const view = document.getElementById('view-customer-filter');
        if (dynamic && view) {
          dynamic.style.display = 'block';
          dynamic.hidden = false;
          view.style.display = 'block';
          view.hidden = false;
          view.classList.remove('hidden');
        }
      }
    }).catch(showCustomerRecoveryError);
  }

  document.addEventListener('click', function (event) {
    const link = event.target && event.target.closest
      ? event.target.closest('#sidebar .submenu a[onclick*="loadCustomerSection"], #sidebar .submenu a[onclick*="showAddCustomerForm"]')
      : null;
    if (!link) return;

    // Replace fragile inline-handler execution with an explicit, guarded call.
    event.preventDefault();
    event.stopImmediatePropagation();

    const onclick = String(link.getAttribute('onclick') || '');
    const listMatch = onclick.match(/loadCustomerSection\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (listMatch) {
      invokeSafely(window.loadCustomerSection, [listMatch[1], listMatch[2]], true);
      return;
    }
    if (onclick.indexOf('showAddCustomerForm') !== -1) {
      invokeSafely(window.showAddCustomerForm, [], false);
      return;
    }
    showCustomerRecoveryError('This customer menu item is not connected to a valid view.');
  }, true);

  window.addEventListener('error', function (event) {
    if (event && /loadCustomerSection|showAddCustomerForm|customer/i.test(String(event.message || ''))) {
      // Global error handling is intentionally limited to customer navigation errors.
      console.error('[Customer submenu recovery] Client error:', event.error || event.message);
    }
  });
})();
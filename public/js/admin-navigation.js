(function () {
    'use strict';

    function toggleSubmenu(event, button) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!button) return;

        const submenu = button.nextElementSibling;
        const isOpen = Boolean(submenu && !submenu.classList.contains('show'));
        if (submenu) submenu.classList.toggle('show', isOpen);

        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const arrow = button.querySelector('.arrow-icon');
        if (arrow) {
            arrow.classList.toggle('bi-chevron-up', isOpen);
            arrow.classList.toggle('bi-chevron-down', !isOpen);
        }
    }

    window.toggleSubmenu = toggleSubmenu;

    // Delegated fallback: the sidebar buttons also carry an inline
    // onclick="toggleSubmenu(event, this)". The inline handler stops
    // propagation, so this listener only fires when the inline handler
    // did not run (for example a stale cached page, or an attribute that
    // was stripped). Without it a single failed load silently kills
    // every sidebar menu. The guard below also makes double-toggling
    // impossible: a click already handled inline never reaches here.
    document.addEventListener('click', function (event) {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const button = target.closest('#sidebar button.dropdown-toggle');
        if (!button) return;
        toggleSubmenu(event, button);
    });
})();
